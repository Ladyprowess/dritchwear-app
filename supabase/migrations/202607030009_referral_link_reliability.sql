CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE referral_code = UPPER(NULLIF(BTRIM(p_code), ''))
  );
$$;

REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_points(uid uuid, delta integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET points_balance = GREATEST(0, COALESCE(points_balance, 0) + delta)
  WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION public.award_points_once(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_reference text DEFAULT NULL,
  p_event_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN FALSE; END IF;
  IF p_event_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.points_transactions WHERE event_key = p_event_key
  ) THEN RETURN FALSE; END IF;

  INSERT INTO public.points_transactions (user_id, type, amount, description, reference, event_key)
  VALUES (p_user_id, 'earned', p_amount, p_description, p_reference, p_event_key);
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
  admin_emails text[] := ARRAY['dritchwear@gmail.com','admin@dritchwear.com','support@dritchwear.com','info@dritchwear.com'];
  new_role text;
  new_referral_code text;
  used_referral_code text;
  referrer_id uuid;
  did_award boolean;
  new_display_name text;
BEGIN
  new_role := CASE WHEN new.email = ANY(admin_emails) THEN 'admin' ELSE 'customer' END;
  new_referral_code := public.generate_unique_referral_code();
  used_referral_code := UPPER(NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'referral_code', '')), ''));
  new_display_name := NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'full_name', '')), '');

  INSERT INTO public.profiles (id,email,full_name,phone,role,referral_code)
  VALUES (new.id,new.email,new_display_name,NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'phone','')),''),new_role,new_referral_code);

  IF used_referral_code IS NOT NULL THEN
    SELECT id INTO referrer_id FROM public.profiles
    WHERE referral_code = used_referral_code AND id <> new.id LIMIT 1;

    IF referrer_id IS NOT NULL THEN
      UPDATE public.profiles SET referred_by_user_id = referrer_id, updated_at = now() WHERE id = new.id;
      INSERT INTO public.referrals (referrer_user_id,referred_user_id,referral_code_used)
      VALUES (referrer_id,new.id,used_referral_code) ON CONFLICT (referred_user_id) DO NOTHING;

      did_award := public.award_points_once(referrer_id,1,'Referral signup reward',new.id::text,'referral-signup:' || new.id::text);
      IF did_award THEN
        INSERT INTO public.notifications (user_id,title,message,type,data)
        VALUES (referrer_id,'New referral joined',COALESCE(new_display_name,new.email,'A new user') || ' signed up with your referral link. You earned 1 point.','system',jsonb_build_object('kind','referral_signup','referred_user_id',new.id,'referral_code',used_referral_code));
      END IF;
    END IF;
  END IF;
  RETURN new;
END;
$$;
