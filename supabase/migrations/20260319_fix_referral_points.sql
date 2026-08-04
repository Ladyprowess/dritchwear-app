-- ============================================================
-- Fix: referral signup points not being awarded
--
-- Root causes:
-- 1. ON CONFLICT (event_key) DO NOTHING silently fails when
--    only a unique INDEX (not a CONSTRAINT) exists on a
--    nullable column - no points row is written, no error raised.
-- 2. increment_points has no SET search_path = public.
-- Both errors were swallowed by EXCEPTION WHEN OTHERS in handle_new_user.
--
-- Fix: replace ON CONFLICT with an explicit existence check,
--      add SET search_path to increment_points,
--      and add a proper partial unique constraint for non-null event_key.
-- ============================================================

-- ── 1. Ensure event_key column exists ───────────────────────
ALTER TABLE public.points_transactions
  ADD COLUMN IF NOT EXISTS event_key TEXT;

-- ── 2. Drop old full unique index (nullable column, unreliable
--       for ON CONFLICT), replace with partial unique constraint
--       covering only non-null values. ────────────────────────
DROP INDEX IF EXISTS public.idx_points_transactions_event_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_points_transactions_event_key_notnull
  ON public.points_transactions(event_key)
  WHERE event_key IS NOT NULL;

-- ── 3. Fix increment_points: add SET search_path ─────────────
CREATE OR REPLACE FUNCTION public.increment_points(uid UUID, delta INTEGER)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET points_balance = GREATEST(0, points_balance + delta)
  WHERE id = uid;
$$;

-- ── 4. Rewrite award_points_once: explicit existence check
--       instead of ON CONFLICT (avoids partial-index mismatch) ─
CREATE OR REPLACE FUNCTION public.award_points_once(
  p_user_id    UUID,
  p_amount     INTEGER,
  p_description TEXT,
  p_reference  TEXT DEFAULT NULL,
  p_event_key  TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Idempotency: skip if this exact event was already recorded
  IF p_event_key IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.points_transactions
    WHERE event_key = p_event_key
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.points_transactions
    (user_id, type, amount, description, reference, event_key)
  VALUES
    (p_user_id, 'earned', p_amount, p_description, p_reference, p_event_key);

  PERFORM public.increment_points(p_user_id, p_amount);

  RETURN TRUE;
END;
$$;

-- ── 5. Re-apply hardened handle_new_user with same fix ────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_emails  text[] := ARRAY[
    'dritchwear@gmail.com',
    'admin@dritchwear.com',
    'support@dritchwear.com',
    'info@dritchwear.com'
  ];
  new_role           TEXT;
  new_referral_code  TEXT;
  used_referral_code TEXT;
  referrer_id        UUID;
  did_award          BOOLEAN;
  new_display_name   TEXT;
BEGIN
  new_role := CASE
    WHEN new.email = ANY(admin_emails) THEN 'admin'
    ELSE 'customer'
  END;

  new_referral_code  := public.generate_unique_referral_code();
  used_referral_code := UPPER(NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'referral_code', '')), ''));
  new_display_name   := NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'full_name', '')), '');

  INSERT INTO public.profiles (id, email, full_name, phone, role, referral_code)
  VALUES (
    new.id,
    new.email,
    new_display_name,
    NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'phone', '')), ''),
    new_role,
    new_referral_code
  );

  IF used_referral_code IS NOT NULL THEN
    BEGIN
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

        INSERT INTO public.referrals (referrer_user_id, referred_user_id, referral_code_used)
        VALUES (referrer_id, new.id, used_referral_code)
        ON CONFLICT (referred_user_id) DO NOTHING;

        -- Award 1 point to the referrer for the signup
        did_award := public.award_points_once(
          referrer_id,
          1,
          'Referral signup reward',
          new.id::TEXT,
          'referral-signup:' || new.id::TEXT
        );

        IF did_award THEN
          INSERT INTO public.notifications (user_id, title, message, type, data)
          VALUES (
            referrer_id,
            'New referral joined',
            COALESCE(new_display_name, new.email, 'A new user') || ' signed up with your referral link. You earned 1 point.',
            'system',
            jsonb_build_object(
              'kind',            'referral_signup',
              'referred_user_id', new.id,
              'referral_code',    used_referral_code
            )
          );
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'handle_new_user referral side-effects failed for user % (code: %): %',
        new.id, used_referral_code, SQLERRM;
    END;
  END IF;

  RETURN new;
END;
$$;
