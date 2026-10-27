-- Part 1 of 2 of the money-path lockdown: ADDITIVE ONLY. Adds the server-side
-- settlement functions the new edge functions (place-order,
-- confirm-wallet-funding, pay-invoice) and the updated app depend on,
-- without taking anything away from the current app - so it's safe to apply
-- first, while older app builds are still in use.
--
-- Deploy order:
--   1. this migration
--   2. edge functions, then the app update (EAS update / web build)
--   3. 202610270002_lock_down_money_paths.sql

-- ── 0. Legacy wallet trigger ────────────────────────────────────────────────
-- From the very first migration and never dropped: it moved wallet_balance
-- on every completed transactions row. Every code path since then -
-- including the current app and the settlement functions below - updates
-- the balance explicitly, so if this was still live it double-counted
-- wallet credits/debits and deducted card order totals from wallets. Dropped
-- here, first, so nothing in either app version runs alongside it.
DROP TRIGGER IF EXISTS update_wallet_on_transaction ON public.transactions;

-- ── 1. Caller helpers (also used by part 2) ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.caller_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- For use inside SECURITY INVOKER trigger functions: there current_user is
-- the session role, so a definer function's own writes (current_user = owner)
-- are correctly treated as trusted.
CREATE OR REPLACE FUNCTION public.caller_is_end_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_user IN ('authenticated', 'anon') AND NOT public.caller_is_admin();
$$;

-- For use inside SECURITY DEFINER functions, where current_user is always
-- the owner - falls back to the JWT role instead.
CREATE OR REPLACE FUNCTION public.assert_trusted_caller()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') AND NOT public.caller_is_admin() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ── 2. Payment link lookup by token ────────────────────────────────────────
-- The public /pay/<token> page used to SELECT the table directly, which is
-- why it needed a USING (true) policy. This returns only the one pending,
-- unexpired link the caller already holds the token for.
CREATE OR REPLACE FUNCTION public.get_payment_link(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'token', token,
    'status', status,
    'amount_ngn', amount_ngn,
    'items', items,
    'requester_name', requester_name,
    'expires_at', expires_at
  )
  FROM public.payment_links
  WHERE token = p_token
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_payment_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payment_link(text) TO anon, authenticated, service_role;

-- ── 3. Settlement functions (service_role only) ────────────────────────────

-- Wallet checkout for place-order: debit, paid order insert and ledger entry
-- in ONE transaction. If the stock trigger rejects the paid insert (sold
-- out), the debit rolls back with it, so there's no "debited but no order"
-- window and no refund step that can fail. p_order holds the totals
-- place-order computed server-side. A replayed checkout_key hits the unique
-- index, which rolls the debit back too; place-order then returns the
-- original order.
CREATE OR REPLACE FUNCTION public.place_wallet_order(p_order jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := (p_order->>'user_id')::uuid;
  v_total numeric := (p_order->>'total')::numeric;
  v_balance numeric;
  v_order_id uuid;
BEGIN
  IF v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'Invalid order total';
  END IF;

  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF COALESCE(v_balance, 0) < v_total THEN
    RAISE EXCEPTION 'insufficient_wallet_balance';
  END IF;

  UPDATE public.profiles SET wallet_balance = wallet_balance - v_total WHERE id = v_user_id;

  INSERT INTO public.orders (
    user_id, items, subtotal, service_fee, delivery_fee, tax, customization_fee, total,
    payment_method, payment_status, order_status, delivery_address, delivery_state,
    delivery_country, contact_phone, currency, original_amount, promo_code, promo_code_id,
    discount_amount, notes, checkout_key
  ) VALUES (
    v_user_id,
    p_order->'items',
    (p_order->>'subtotal')::numeric,
    (p_order->>'service_fee')::numeric,
    (p_order->>'delivery_fee')::numeric,
    (p_order->>'tax')::numeric,
    (p_order->>'customization_fee')::numeric,
    v_total,
    'wallet', 'paid', 'pending',
    p_order->>'delivery_address',
    p_order->>'delivery_state',
    p_order->>'delivery_country',
    p_order->>'contact_phone',
    'NGN',
    v_total,
    p_order->>'promo_code',
    (p_order->>'promo_code_id')::uuid,
    COALESCE((p_order->>'discount_amount')::numeric, 0),
    p_order->>'notes',
    NULLIF(p_order->>'checkout_key', '')
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.transactions (user_id, type, amount, description, reference, status)
  VALUES (v_user_id, 'debit', v_total,
          'Order payment - wallet (order #' || substring(v_order_id::text, 1, 8) || ')',
          v_order_id::text, 'completed');

  RETURN v_order_id;
END;
$$;

-- True if a Paystack reference has already been applied anywhere, so one
-- genuine charge can't be credited twice or reused across purposes.
CREATE OR REPLACE FUNCTION public.paystack_reference_used(p_reference text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.transactions WHERE reference = p_reference)
      OR EXISTS (SELECT 1 FROM public.orders WHERE paystack_reference = p_reference)
      OR EXISTS (SELECT 1 FROM public.payment_links WHERE paystack_ref = p_reference);
$$;

-- Wallet top-up after the fund-wallet edge function has verified the charge
-- with Paystack. Serialised per reference so the client confirm and the
-- webhook racing each other credit exactly once.
CREATE OR REPLACE FUNCTION public.credit_wallet_from_paystack(
  p_user_id uuid,
  p_amount numeric,
  p_reference text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR COALESCE(p_reference, '') = '' THEN
    RAISE EXCEPTION 'Invalid wallet funding';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('paystack:' || p_reference));
  IF public.paystack_reference_used(p_reference) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, currency, description, reference, status, payment_provider)
  VALUES (p_user_id, 'credit', p_amount, 'NGN', 'Wallet funding via Paystack', p_reference, 'completed', 'paystack');
  RETURN TRUE;
END;
$$;

-- Settles a custom-order invoice (wallet or verified Paystack charge):
-- debit (wallet only), ledger entry, invoice paid and request moved to
-- payment_made, all at once. Returns false if it was already paid.
CREATE OR REPLACE FUNCTION public.settle_invoice_payment(
  p_invoice_id uuid,
  p_method text,
  p_reference text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_title text;
  v_balance numeric;
BEGIN
  IF p_method NOT IN ('wallet', 'paystack') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  IF v_invoice.status = 'paid' THEN
    RETURN FALSE;
  END IF;
  IF v_invoice.status NOT IN ('sent', 'accepted') THEN
    RAISE EXCEPTION 'Invoice is %', v_invoice.status;
  END IF;

  IF p_method = 'paystack' THEN
    IF COALESCE(p_reference, '') = '' THEN
      RAISE EXCEPTION 'Missing payment reference';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('paystack:' || p_reference));
    IF public.paystack_reference_used(p_reference) THEN
      RAISE EXCEPTION 'This payment reference has already been used';
    END IF;
  ELSE
    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_invoice.user_id FOR UPDATE;
    IF COALESCE(v_balance, 0) < v_invoice.amount THEN
      RAISE EXCEPTION 'insufficient_wallet_balance';
    END IF;
    UPDATE public.profiles SET wallet_balance = wallet_balance - v_invoice.amount WHERE id = v_invoice.user_id;
  END IF;

  SELECT title INTO v_title FROM public.custom_requests WHERE id = v_invoice.custom_request_id;

  INSERT INTO public.transactions (user_id, type, amount, currency, description, reference, status, payment_provider)
  VALUES (v_invoice.user_id, 'debit', v_invoice.amount, 'NGN',
          'Payment for custom order: ' || COALESCE(v_title, 'Custom order'),
          CASE WHEN p_method = 'paystack' THEN p_reference ELSE p_invoice_id::text END,
          'completed', p_method);

  UPDATE public.invoices SET status = 'paid', updated_at = now() WHERE id = p_invoice_id;
  UPDATE public.custom_requests SET status = 'payment_made', updated_at = now() WHERE id = v_invoice.custom_request_id;

  RETURN TRUE;
END;
$$;

-- Refunds a captured Paystack charge whose order can't be fulfilled (an item
-- sold out, or the promo was used up, between checkout and payment) as
-- wallet credit - atomically and once. The client confirm, the webhook and
-- the reconciliation job can all hit this for the same charge; only the
-- first one that still finds the order pending_payment refunds, and the
-- order is only marked refunded together with the credit actually landing.
-- p_link_token is set for Pay for Me charges: the credit goes to the
-- requester (whose order it is) and the link is closed with the reference.
CREATE OR REPLACE FUNCTION public.refund_unsettleable_payment(
  p_order_id uuid,
  p_reference text,
  p_reason text,
  p_link_token text DEFAULT NULL,
  p_payer_email text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_amount numeric;
BEGIN
  IF COALESCE(p_reference, '') = '' THEN
    RAISE EXCEPTION 'Missing payment reference';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('paystack:' || p_reference));

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.payment_status IS DISTINCT FROM 'pending_payment' THEN
    RETURN FALSE;
  END IF;
  IF public.paystack_reference_used(p_reference) THEN
    RETURN FALSE;
  END IF;

  IF p_link_token IS NOT NULL THEN
    SELECT amount_ngn INTO v_amount FROM public.payment_links
    WHERE token = p_link_token AND order_id = p_order_id FOR UPDATE;
    UPDATE public.payment_links
    SET status = 'paid', paystack_ref = p_reference, payer_email = p_payer_email, paid_at = now()
    WHERE token = p_link_token AND status = 'pending';
  END IF;
  v_amount := COALESCE(v_amount, v_order.total);

  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount WHERE id = v_order.user_id;
  INSERT INTO public.transactions (user_id, type, amount, currency, description, reference, status, payment_provider)
  VALUES (v_order.user_id, 'credit', v_amount, 'NGN',
          'Refund: ' || p_reason || ' (order #' || substring(p_order_id::text, 1, 8) || ')',
          p_reference, 'completed', 'paystack');

  UPDATE public.orders
  SET payment_status = 'refunded', order_status = 'cancelled', paystack_reference = p_reference
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

-- Checkout idempotency: place-order sends one key per checkout attempt, so
-- a retry after a lost response returns the order it already made instead
-- of charging the wallet (or opening Paystack for) a second order.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_key text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_user_checkout_key_key
  ON public.orders (user_id, checkout_key) WHERE checkout_key IS NOT NULL;

-- Card checkout settlement for confirmCheckoutOrder: reference check, paid
-- flip and ledger entry under one lock. The reference lock + the global
-- paystack_reference_used check make every Paystack reference single-use
-- across ALL flows (checkout, Pay for Me, wallet top-up, invoices, refunds),
-- so one charge can never settle two things - with or without metadata.
-- Stock / promo triggers may raise; the whole settlement then rolls back
-- and the caller refunds via refund_unsettleable_payment.
CREATE OR REPLACE FUNCTION public.settle_checkout_order_payment(p_order_id uuid, p_reference text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF COALESCE(p_reference, '') = '' THEN
    RAISE EXCEPTION 'Missing payment reference';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('paystack:' || p_reference));

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF v_order.payment_status = 'paid' AND v_order.paystack_reference = p_reference THEN
    RETURN 'already_paid';
  END IF;
  IF v_order.payment_status IS DISTINCT FROM 'pending_payment' THEN
    RAISE EXCEPTION 'order_not_pending: order is %', v_order.payment_status;
  END IF;
  IF public.paystack_reference_used(p_reference) THEN
    RAISE EXCEPTION 'reference_used: this payment reference has already been used';
  END IF;

  UPDATE public.orders
  SET payment_status = 'paid', order_status = 'pending', paystack_reference = p_reference
  WHERE id = p_order_id;

  INSERT INTO public.transactions (user_id, type, amount, currency, description, reference, status, payment_provider)
  VALUES (v_order.user_id, 'debit', v_order.total, COALESCE(v_order.currency, 'NGN'),
          'Order payment - Paystack', p_reference, 'completed', 'paystack');

  RETURN 'settled';
END;
$$;

-- Pay for Me settlement for confirmPaymentLink: the reference is secured
-- BEFORE anything is marked paid, and the order and link flip together.
CREATE OR REPLACE FUNCTION public.settle_payment_link_payment(
  p_token text,
  p_reference text,
  p_payer_email text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.payment_links%ROWTYPE;
  v_order_status text;
BEGIN
  IF COALESCE(p_reference, '') = '' THEN
    RAISE EXCEPTION 'Missing payment reference';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('paystack:' || p_reference));

  SELECT * INTO v_link FROM public.payment_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'link_not_found';
  END IF;
  IF v_link.status = 'paid' AND v_link.paystack_ref = p_reference THEN
    RETURN 'already_paid';
  END IF;
  IF v_link.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'link_not_pending: link is %', v_link.status;
  END IF;
  IF public.paystack_reference_used(p_reference) THEN
    RAISE EXCEPTION 'reference_used: this payment reference has already been used';
  END IF;

  IF v_link.order_id IS NOT NULL THEN
    SELECT payment_status INTO v_order_status FROM public.orders WHERE id = v_link.order_id FOR UPDATE;
    IF v_order_status IS DISTINCT FROM 'pending_payment' THEN
      RAISE EXCEPTION 'order_not_pending: order is %', v_order_status;
    END IF;
    UPDATE public.orders SET payment_status = 'paid', order_status = 'in_review' WHERE id = v_link.order_id;
  END IF;

  UPDATE public.payment_links
  SET status = 'paid', paystack_ref = p_reference, payer_email = p_payer_email, paid_at = now()
  WHERE token = p_token;

  RETURN 'settled';
END;
$$;

-- ── 4. Only restore stock that was actually taken ──────────────────────────
-- Moving a never-paid order to 'refunded' (the sold-out refund above, which
-- confirmCheckoutOrder already did before this) used to add its items back
-- to stock even though reduce_stock_on_paid_order never took them out.
CREATE OR REPLACE FUNCTION public.restore_stock_on_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item jsonb;
  pid  uuid;
  qty  integer;
BEGIN
  IF NEW.payment_status = 'refunded' AND OLD.payment_status = 'paid' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      pid := COALESCE((item->>'productId')::uuid, (item->>'product_id')::uuid);
      qty := COALESCE((item->>'quantity')::integer, 1);
      UPDATE public.products SET stock = stock + qty, updated_at = now() WHERE id = pid;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

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
        'place_wallet_order', 'paystack_reference_used', 'credit_wallet_from_paystack',
        'settle_invoice_payment', 'refund_unsettleable_payment',
        'settle_checkout_order_payment', 'settle_payment_link_payment'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
