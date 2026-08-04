-- ── Stock Management ──────────────────────────────────────────────────────────
-- 1. validate_stock_availability  - called from app before inserting an order
-- 2. reduce_stock_on_paid_order   - trigger that fires when order is paid

-- ── 1. Validate stock ─────────────────────────────────────────────────────────
-- order_items is the JSONB array stored in orders.items
-- Each element must have: productId (or product_id) and quantity
DROP FUNCTION IF EXISTS validate_stock_availability(jsonb);
CREATE OR REPLACE FUNCTION validate_stock_availability(order_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item       jsonb;
  pid        uuid;
  qty        integer;
  avail      integer;
  prod_name  text;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(order_items)
  LOOP
    pid := COALESCE(
      (item->>'productId')::uuid,
      (item->>'product_id')::uuid
    );
    qty := COALESCE((item->>'quantity')::integer, 1);

    SELECT stock, name INTO avail, prod_name
    FROM products
    WHERE id = pid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', pid;
    END IF;

    IF avail < qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%". Available: %, requested: %',
        prod_name, avail, qty;
    END IF;
  END LOOP;
END;
$$;

-- ── 2. Reduce stock when an order becomes paid ────────────────────────────────
CREATE OR REPLACE FUNCTION reduce_stock_on_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item  jsonb;
  pid   uuid;
  qty   integer;
BEGIN
  -- Fire only when payment_status transitions to 'paid'
  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status <> 'paid') THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      pid := COALESCE(
        (item->>'productId')::uuid,
        (item->>'product_id')::uuid
      );
      qty := COALESCE((item->>'quantity')::integer, 1);

      UPDATE products
      SET
        stock      = GREATEST(stock - qty, 0),
        updated_at = now()
      WHERE id = pid;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger (drop first to allow re-running this migration)
DROP TRIGGER IF EXISTS trg_reduce_stock_on_paid_order ON orders;
CREATE TRIGGER trg_reduce_stock_on_paid_order
  AFTER INSERT OR UPDATE OF payment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION reduce_stock_on_paid_order();
