-- Shipment tracking + a 7-day delivery guarantee: if an order isn't marked
-- Delivered within 7 days of being Confirmed, the customer gets a flat
-- ₦1,000 wallet credit (checked by a cron job) - admin can also grant it
-- manually as goodwill at any time via credit_wallet().
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_link text,
  ADD COLUMN IF NOT EXISTS late_delivery_credit_at timestamptz;

-- Stamp status timestamps automatically whenever order_status changes,
-- regardless of which code path performs the update, so the 7-day clock
-- and the "days remaining" figure in shipped emails are always accurate.
CREATE OR REPLACE FUNCTION public.stamp_order_status_timestamps()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    IF NEW.order_status = 'confirmed' AND NEW.confirmed_at IS NULL THEN NEW.confirmed_at := now(); END IF;
    IF NEW.order_status = 'shipped' AND NEW.shipped_at IS NULL THEN NEW.shipped_at := now(); END IF;
    IF NEW.order_status = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_stamp_status_timestamps ON public.orders;
CREATE TRIGGER orders_stamp_status_timestamps BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_order_status_timestamps();

-- Atomic wallet credit: balance update + transaction record in one
-- statement, so concurrent credits (admin click racing the cron job, or two
-- cron runs) can't clobber each other the way a client-side
-- read-balance-then-write would.
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_reference text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, description, reference, status)
  VALUES (p_user_id, 'credit', p_amount, p_description, p_reference, 'completed');
END;
$$;
