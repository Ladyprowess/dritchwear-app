-- ============================================================
-- Migration: Harden signup trigger and referral helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_code TEXT;
BEGIN
  LOOP
    generated_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 10));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE referral_code = generated_code
    );
  END LOOP;

  RETURN generated_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_points_once(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_reference TEXT DEFAULT NULL,
  p_event_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.points_transactions (user_id, type, amount, description, reference, event_key)
  VALUES (p_user_id, 'earned', p_amount, p_description, p_reference, p_event_key)
  ON CONFLICT (event_key) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    RETURN FALSE;
  END IF;

  PERFORM public.increment_points(p_user_id, p_amount);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  new_referral_code := public.generate_unique_referral_code();
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

        did_award_signup_points := public.award_points_once(
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
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Referral side-effects failed for user %: %', new.id, SQLERRM;
    END;
  END IF;

  RETURN new;
END;
$$;
