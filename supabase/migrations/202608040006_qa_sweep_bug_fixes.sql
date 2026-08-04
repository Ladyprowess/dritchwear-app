-- Batch of fixes from a full-app QA sweep:
--   1. promo_codes.used_count was written nowhere, making max_usage
--      unenforceable and the admin "Used: X/Y" counter permanently stale.
--   2. Stock was never restored when a paid order got refunded/cancelled,
--      permanently shrinking visible inventory on every admin cancellation.
--   3. Stock decrement silently clamped at 0 instead of rejecting the order,
--      so two concurrent buyers of the last unit could both "successfully"
--      pay for it (TOCTOU race between the client's pre-check and the
--      actual decrement). Now the decrement itself is the authoritative,
--      atomic check.
--   4. Bill-pay's points deduction (increment_points with a negative delta)
--      floors at 0 instead of rejecting insufficient balance, so two
--      concurrent bill payments could both "succeed" off one balance.
--      Wallet already had this protection via deduct_wallet(); points didn't.

-- ── 1. Track promo code usage ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_promo_usage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.promo_code_id IS NOT NULL
     AND NEW.payment_status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    UPDATE public.promo_codes SET used_count = COALESCE(used_count, 0) + 1 WHERE id = NEW.promo_code_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_increment_promo_usage ON public.orders;
CREATE TRIGGER orders_increment_promo_usage
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.increment_promo_usage();

-- ── 2. Restore stock when a paid order is refunded ───────────────────────
CREATE OR REPLACE FUNCTION public.restore_stock_on_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  item jsonb;
  pid  uuid;
  qty  integer;
BEGIN
  IF NEW.payment_status = 'refunded' AND OLD.payment_status IS DISTINCT FROM 'refunded' THEN
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

DROP TRIGGER IF EXISTS orders_restore_stock_on_refund ON public.orders;
CREATE TRIGGER orders_restore_stock_on_refund
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_refund();

-- ── 3. Close the stock-oversell race: reject instead of clamping ─────────
CREATE OR REPLACE FUNCTION reduce_stock_on_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item  jsonb;
  pid   uuid;
  qty   integer;
  prod_name text;
BEGIN
  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status <> 'paid') THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      pid := COALESCE((item->>'productId')::uuid, (item->>'product_id')::uuid);
      qty := COALESCE((item->>'quantity')::integer, 1);

      UPDATE products
      SET stock = stock - qty, updated_at = now()
      WHERE id = pid AND stock >= qty;

      IF NOT FOUND THEN
        SELECT name INTO prod_name FROM products WHERE id = pid;
        RAISE EXCEPTION 'Insufficient stock for %: someone else just bought the last unit(s). Please try again.', COALESCE(prod_name, pid::text);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4. Atomic points deduction (mirrors deduct_wallet) ───────────────────
CREATE OR REPLACE FUNCTION deduct_points(uid UUID, amount INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT points_balance INTO current_balance FROM profiles WHERE id = uid FOR UPDATE;
  IF current_balance < amount THEN
    RETURN FALSE;
  END IF;
  UPDATE profiles SET points_balance = points_balance - amount WHERE id = uid;
  RETURN TRUE;
END;
$$;

-- ── 5. Atomic outfit product-list replace ────────────────────────────────
-- Admin's outfit editor used to delete all outfit_items then insert the new
-- selection as two separate client calls - if the insert failed for any
-- reason, the delete had already committed, silently dropping every product
-- from a live "Shop the Look" outfit. Doing both in one function makes them
-- one transaction: either the whole replace succeeds or nothing changes.
CREATE OR REPLACE FUNCTION public.replace_outfit_items(p_outfit_id uuid, p_product_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.outfit_items WHERE outfit_id = p_outfit_id;
  INSERT INTO public.outfit_items (outfit_id, product_id, position)
  SELECT p_outfit_id, pid, ord - 1
  FROM unnest(p_product_ids) WITH ORDINALITY AS t(pid, ord);
END;
$$;
