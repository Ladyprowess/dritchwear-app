-- Security lockdown for every path that moves money, points or payment
-- status. Before this, the client (or even an anonymous visitor holding the
-- public anon key) could:
--   * set its own profiles.role / wallet_balance / points_balance
--   * call fund_wallet / deduct_wallet(-x) / credit_wallet / increment_points
--     / refund_order_to_wallet on any account
--   * insert orders already marked paid, or with any total it liked
--   * flip any pending order or payment link to paid (anon policies)
--   * read every payment link in the system
--
-- The fixes below are written as triggers wherever possible rather than
-- policy edits, so they hold regardless of any extra RLS policies that were
-- created directly in the dashboard and never made it into migrations.
--
-- "End user" below means a request made directly by a signed-in customer or
-- an anonymous visitor through PostgREST (session role authenticated/anon)
-- who is not an admin. Edge functions (service_role), SECURITY DEFINER
-- functions (run as their owner), cron jobs and admins are all unaffected.
--
-- Part 2 of 2. Apply LAST: after 202610270001_payment_settlement_functions.sql
-- AND after the place-order / confirm-wallet-funding / pay-invoice edge
-- functions and the app update are live, because this blocks the direct
-- writes older app builds still make. Uses the caller helpers from part 1.

-- (The legacy update_wallet_on_transaction trigger is dropped in part 1.)

-- ── 2. profiles: customers can't touch role / balances / referral fields ───

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_is_end_user() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'customer';
    NEW.wallet_balance := 0;
    NEW.points_balance := 0;
    NEW.referred_by_user_id := NULL;
  ELSE
    -- Reverted silently rather than raised, so the app's ordinary profile
    -- saves (which send whole rows in places) keep working.
    NEW.id := OLD.id;
    NEW.role := OLD.role;
    NEW.wallet_balance := OLD.wallet_balance;
    NEW.points_balance := OLD.points_balance;
    NEW.referral_code := OLD.referral_code;
    NEW.referred_by_user_id := OLD.referred_by_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_columns
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- ── 3. orders: created and settled only by the server ──────────────────────

DROP POLICY IF EXISTS "Users can update own order payment status" ON public.orders;
DROP POLICY IF EXISTS "Anon can update order status to in_review" ON public.orders;

CREATE OR REPLACE FUNCTION public.guard_orders_end_user_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_is_end_user() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Orders must be placed through checkout. Please update the app and try again.'
      USING ERRCODE = '42501';
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Orders cannot be changed directly' USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' AND OLD.payment_status IS DISTINCT FROM 'pending_payment' THEN
    RAISE EXCEPTION 'Only unpaid orders can be removed' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS orders_guard_end_user_writes ON public.orders;
CREATE TRIGGER orders_guard_end_user_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_orders_end_user_writes();

-- ── 4. payment_links: written by the server, read by token via RPC ─────────

DROP POLICY IF EXISTS "Anyone can read payment_link by token" ON public.payment_links;
DROP POLICY IF EXISTS "Anon can mark payment_link paid by token" ON public.payment_links;
DROP POLICY IF EXISTS "Users can update own payment_links" ON public.payment_links;
DROP POLICY IF EXISTS "Users can insert own payment_links" ON public.payment_links;

CREATE OR REPLACE FUNCTION public.guard_payment_links_end_user_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.caller_is_end_user() THEN
    RAISE EXCEPTION 'Payment links cannot be changed directly' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payment_links_guard_end_user_writes ON public.payment_links;
CREATE TRIGGER payment_links_guard_end_user_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.guard_payment_links_end_user_writes();

-- ── 5. Ledgers: server-written only ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_ledger_end_user_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.caller_is_end_user() THEN
    RAISE EXCEPTION '% cannot be changed directly', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS transactions_guard_end_user_writes ON public.transactions;
CREATE TRIGGER transactions_guard_end_user_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_ledger_end_user_writes();

DROP TRIGGER IF EXISTS points_transactions_guard_end_user_writes ON public.points_transactions;
CREATE TRIGGER points_transactions_guard_end_user_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.points_transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_ledger_end_user_writes();

-- ── 6. Custom orders: customers may accept/reject, never mark paid ─────────

CREATE OR REPLACE FUNCTION public.guard_invoices_end_user_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_is_end_user() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND (OLD.status = 'paid' OR NEW.status NOT IN ('accepted', 'rejected')) THEN
    RAISE EXCEPTION 'Invoice status cannot be changed to %', NEW.status USING ERRCODE = '42501';
  END IF;
  NEW.amount := OLD.amount;
  NEW.user_id := OLD.user_id;
  NEW.custom_request_id := OLD.custom_request_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_guard_end_user_writes ON public.invoices;
CREATE TRIGGER invoices_guard_end_user_writes
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_invoices_end_user_writes();

CREATE OR REPLACE FUNCTION public.guard_custom_requests_end_user_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.caller_is_end_user() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Order status cannot be changed to %', NEW.status USING ERRCODE = '42501';
  END IF;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_requests_guard_end_user_writes ON public.custom_requests;
CREATE TRIGGER custom_requests_guard_end_user_writes
BEFORE UPDATE ON public.custom_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_requests_end_user_writes();

-- ── 7. Wallet / points RPCs ─────────────────────────────────────────────────

-- Reject zero/negative amounts: deduct_wallet(me, -50000) used to ADD money,
-- since a negative amount always passes the balance check.
CREATE OR REPLACE FUNCTION public.fund_wallet(uid uuid, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + amount WHERE id = uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_wallet(uid uuid, amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  SELECT wallet_balance INTO current_balance FROM public.profiles WHERE id = uid FOR UPDATE;
  IF COALESCE(current_balance, 0) < amount THEN
    RETURN FALSE;
  END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance - amount WHERE id = uid;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_points(uid uuid, amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
BEGIN
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  SELECT points_balance INTO current_balance FROM public.profiles WHERE id = uid FOR UPDATE;
  IF COALESCE(current_balance, 0) < amount THEN
    RETURN FALSE;
  END IF;
  UPDATE public.profiles SET points_balance = points_balance - amount WHERE id = uid;
  RETURN TRUE;
END;
$$;

-- Still callable by admins from the order details screen (late delivery
-- goodwill credit), so guarded inside rather than revoked.
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_reference text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_trusted_caller();
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, description, reference, status)
  VALUES (p_user_id, 'credit', p_amount, p_description, p_reference, 'completed');
END;
$$;

-- Admin-only (cancel order → refund to wallet). Any customer could
-- previously refund their own delivered order and keep the goods.
CREATE OR REPLACE FUNCTION public.refund_order_to_wallet(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_total numeric;
  v_payment_status text;
BEGIN
  PERFORM public.assert_trusted_caller();

  SELECT user_id, total, payment_status INTO v_user_id, v_total, v_payment_status
  FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_payment_status IS DISTINCT FROM 'paid' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_total WHERE id = v_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference, status)
  VALUES (v_user_id, 'credit', v_total, 'Refund for cancelled order #' || substring(p_order_id::text, 1, 8), p_order_id::text, 'completed');

  UPDATE public.orders SET payment_status = 'refunded' WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

-- ── 8. Promo limits enforced when an order becomes paid ────────────────────
-- place-order only counts PAID orders against a promo (so an abandoned
-- Paystack attempt doesn't burn it), which on its own would let a customer
-- open several pending orders with the same once-per-customer promo and pay
-- them all. Rechecked here at the moment of payment, with the promo row
-- locked so concurrent payments (two wallet checkouts at once) queue up and
-- the second sees the first. Raises 'promo_unavailable', which the
-- settlement code treats like a sold-out item: wallet payments roll back,
-- captured card payments are refunded to the wallet.
-- Admins confirming a payment by hand aren't blocked.
CREATE OR REPLACE FUNCTION public.enforce_promo_on_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo jsonb;
BEGIN
  IF NEW.promo_code_id IS NULL OR NEW.payment_status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.payment_status = 'paid' THEN
    RETURN NEW;
  END IF;
  IF public.caller_is_admin() THEN
    RETURN NEW;
  END IF;

  -- to_jsonb so optional columns (first_time_only lives only in the live
  -- schema) read as NULL instead of erroring when absent.
  SELECT to_jsonb(p) INTO v_promo FROM public.promo_codes p WHERE p.id = NEW.promo_code_id FOR UPDATE;
  IF v_promo IS NULL THEN
    RAISE EXCEPTION 'promo_unavailable: offer no longer exists';
  END IF;

  IF (v_promo->>'max_usage') IS NOT NULL
     AND COALESCE((v_promo->>'used_count')::int, 0) >= (v_promo->>'max_usage')::int THEN
    RAISE EXCEPTION 'promo_unavailable: usage limit reached';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE user_id = NEW.user_id AND promo_code_id = NEW.promo_code_id
      AND payment_status = 'paid' AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'promo_unavailable: already used by this customer';
  END IF;

  IF COALESCE((v_promo->>'first_time_only')::boolean, false) AND EXISTS (
    SELECT 1 FROM public.orders
    WHERE user_id = NEW.user_id AND payment_status = 'paid' AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'promo_unavailable: first-time customers only';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enforce_promo_on_paid ON public.orders;
CREATE TRIGGER orders_enforce_promo_on_paid
BEFORE INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_promo_on_paid_order();
-- Lock down execution. Revoked by name across every overload, since the
-- exact live signatures may differ from the migrations. All the SQL callers
-- of these (review reward, referral and signup triggers) are SECURITY
-- DEFINER, so they keep working.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fund_wallet', 'deduct_wallet', 'deduct_points', 'increment_points',
        'award_points_once', 'update_wallet_balance'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ── 9. Signup: no automatic admin by email ─────────────────────────────────
-- handle_new_user used to grant 'admin' to four hard-coded addresses on
-- signup - if any of them wasn't registered yet, whoever signed up with it
-- first became admin. Existing admins are untouched; grant new ones by hand:
--   UPDATE public.profiles SET role = 'admin' WHERE email = '...';
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_referral_code text;
  used_referral_code text;
  referrer_id uuid;
  did_award boolean;
  new_display_name text;
BEGIN
  new_referral_code := public.generate_unique_referral_code();
  used_referral_code := UPPER(NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'referral_code', '')), ''));
  new_display_name := NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'full_name', '')), '');

  INSERT INTO public.profiles (id,email,full_name,phone,role,referral_code)
  VALUES (new.id,new.email,new_display_name,NULLIF(BTRIM(COALESCE(new.raw_user_meta_data->>'phone','')),''),'customer',new_referral_code);

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
