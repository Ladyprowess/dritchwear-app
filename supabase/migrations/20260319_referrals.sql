-- ============================================================
-- Migration: Referral program + server-side purchase rewards
-- ============================================================

-- ── 1. profiles: referral code support ──────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON profiles(referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_user_id
  ON profiles(referred_by_user_id);

-- ── 2. points_transactions: idempotency key ─────────────────
ALTER TABLE points_transactions
  ADD COLUMN IF NOT EXISTS event_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_points_transactions_event_key
  ON points_transactions(event_key);

-- ── 3. referrals table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id    UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code_used  TEXT NOT NULL,
  signup_rewarded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_paid_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  first_paid_order_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id
  ON referrals(referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id
  ON referrals(referred_user_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own referrals" ON referrals;
CREATE POLICY "Users can read own referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (
    auth.uid() = referrer_user_id
    OR auth.uid() = referred_user_id
  );

-- ── 4. Helper functions ─────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  generated_code TEXT;
BEGIN
  LOOP
    generated_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM profiles
      WHERE referral_code = generated_code
    );
  END LOOP;

  RETURN generated_code;
END;
$$;

-- Backfill referral codes for existing users already in production.
DO $$
DECLARE
  profile_row RECORD;
BEGIN
  FOR profile_row IN
    SELECT id
    FROM profiles
    WHERE referral_code IS NULL OR BTRIM(referral_code) = ''
    ORDER BY created_at, id
  LOOP
    UPDATE profiles
    SET referral_code = generate_unique_referral_code(),
        updated_at = NOW()
    WHERE id = profile_row.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION award_points_once(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_reference TEXT DEFAULT NULL,
  p_event_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO points_transactions (user_id, type, amount, description, reference, event_key)
  VALUES (p_user_id, 'earned', p_amount, p_description, p_reference, p_event_key)
  ON CONFLICT (event_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    RETURN FALSE;
  END IF;

  PERFORM increment_points(p_user_id, p_amount);
  RETURN TRUE;
END;
$$;

-- ── 5. Replace auth signup handler ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  admin_emails text[] := ARRAY[
    'dritchwear@gmail.com',
    'admin@dritchwear.com',
    'support@dritchwear.com',
    'info@dritchwear.com'
  ];
  new_role TEXT;
  new_referral_code TEXT;
  used_referral_code TEXT;
  referrer_id UUID;
  did_award_signup_points BOOLEAN;
  new_display_name TEXT;
BEGIN
  new_role := CASE
    WHEN new.email = ANY(admin_emails) THEN 'admin'
    ELSE 'customer'
  END;

  new_referral_code := generate_unique_referral_code();
  used_referral_code := UPPER(NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'referral_code', '')), ''));
  new_display_name := NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'full_name', '')), '');

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    referral_code
  )
  VALUES (
    new.id,
    new.email,
    new_display_name,
    NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'phone', '')), ''),
    new_role,
    new_referral_code
  );

  IF used_referral_code IS NOT NULL THEN
    SELECT id
    INTO referrer_id
    FROM public.profiles
    WHERE referral_code = used_referral_code
      AND id <> new.id
    LIMIT 1;

    IF referrer_id IS NOT NULL THEN
      UPDATE public.profiles
      SET referred_by_user_id = referrer_id,
          updated_at = NOW()
      WHERE id = new.id;

      INSERT INTO public.referrals (
        referrer_user_id,
        referred_user_id,
        referral_code_used
      )
      VALUES (
        referrer_id,
        new.id,
        used_referral_code
      )
      ON CONFLICT (referred_user_id) DO NOTHING;

      did_award_signup_points := award_points_once(
        referrer_id,
        1,
        'Referral signup reward',
        new.id::TEXT,
        'referral-signup:' || new.id::TEXT
      );

      IF did_award_signup_points THEN
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          referrer_id,
          'New referral joined',
          COALESCE(new_display_name, new.email, 'A new user') || ' signed up with your referral link. You earned 1 point.',
          'system',
          jsonb_build_object(
            'kind', 'referral_signup',
            'referred_user_id', new.id,
            'referral_code', used_referral_code
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Paid-order rewards trigger ───────────────────────────
CREATE OR REPLACE FUNCTION handle_paid_order_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referral_row referrals%ROWTYPE;
BEGIN
  IF NEW.payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.payment_status, '') <> 'paid') THEN

    PERFORM award_points_once(
      NEW.user_id,
      5,
      'Purchase reward',
      NEW.id::TEXT,
      'purchase:' || NEW.id::TEXT
    );

    UPDATE referrals
    SET first_paid_order_id = NEW.id,
        first_paid_order_at = NOW()
    WHERE referred_user_id = NEW.user_id
      AND first_paid_order_id IS NULL
    RETURNING *
    INTO referral_row;

    IF FOUND THEN
      IF award_points_once(
        referral_row.referrer_user_id,
        3,
        'Referral first order reward',
        NEW.id::TEXT,
        'referral-first-order:' || referral_row.id::TEXT
      ) THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          referral_row.referrer_user_id,
          'Referral order completed',
          'Your referred user placed their first paid order. You earned 3 points.',
          'system',
          jsonb_build_object(
            'kind', 'referral_first_order',
            'referred_user_id', NEW.user_id,
            'order_id', NEW.id
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_paid_order_rewards ON orders;
CREATE TRIGGER trg_handle_paid_order_rewards
  AFTER INSERT OR UPDATE OF payment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_paid_order_rewards();
