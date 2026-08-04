-- Push a notification to the customer on order placement AND every status
-- change, across regular orders, custom orders, bills, and pay-for-me links.
-- Mirrors the existing admin_alerts -> dispatch_admin_order_alert pattern
-- (202607030006/7): a staging table is inserted by per-table triggers, and a
-- second trigger on that staging table fans out to an edge function via
-- pg_net so delivery logic lives in one place.

CREATE TABLE IF NOT EXISTS public.customer_order_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('order','custom_order','bill','payment_link')),
  entity_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  url text,
  delivered_at timestamptz,
  push_sent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_order_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_order_alerts_undelivered_idx ON public.customer_order_alerts(delivered_at) WHERE delivered_at IS NULL;

-- ── orders: placed + every order_status/payment_status change ──────────
CREATE OR REPLACE FUNCTION public.notify_customer_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_status = 'paid' THEN
      v_title := 'Order placed successfully 🎉';
      v_message := 'Your Dritchwear order is confirmed. Delivery usually takes 2–7 days.';
    ELSE
      v_title := 'Payment link created';
      v_message := 'Your order is waiting for payment. Open your orders to complete or share the payment link.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
      CASE NEW.order_status
        WHEN 'confirmed'  THEN v_title := 'Order confirmed';     v_message := 'Your order has been confirmed and is being prepared.';
        WHEN 'processing' THEN v_title := 'Order processing';    v_message := 'Your order is being processed.';
        WHEN 'shipped'    THEN v_title := 'Order shipped 🚚';    v_message := 'Your order is on its way!';
        WHEN 'delivered'  THEN v_title := 'Order delivered 📦';  v_message := 'Your order has been delivered. Enjoy!';
        WHEN 'cancelled'  THEN v_title := 'Order cancelled';     v_message := 'Your order has been cancelled.';
        WHEN 'in_review'  THEN v_title := 'Payment received';    v_message := 'Your payment was received. Your order is now in review.';
        ELSE v_title := NULL;
      END CASE;
    ELSIF NEW.payment_status = 'failed' AND OLD.payment_status IS DISTINCT FROM 'failed' THEN
      v_title := 'Payment failed'; v_message := 'Your order payment could not be completed. Please try again.';
    ELSIF NEW.payment_status = 'refunded' AND OLD.payment_status IS DISTINCT FROM 'refunded' THEN
      v_title := 'Order refunded'; v_message := 'Your order payment has been refunded.';
    ELSE
      v_title := NULL;
    END IF;
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.customer_order_alerts(user_id, entity_type, entity_id, title, message, url)
    VALUES (NEW.user_id, 'order', NEW.id, v_title, v_message, '/orders');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify_customer_insert ON public.orders;
CREATE TRIGGER orders_notify_customer_insert AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_order_change();

DROP TRIGGER IF EXISTS orders_notify_customer_update ON public.orders;
CREATE TRIGGER orders_notify_customer_update AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_order_change();

-- ── custom_requests: submitted + every status change ────────────────────
CREATE OR REPLACE FUNCTION public.notify_customer_custom_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'Custom order request received';
    v_message := 'We''ve received your custom order request. We''ll review it and get back to you soon.';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'under_review' THEN v_title := 'Custom order under review'; v_message := 'Your custom order request is being reviewed.';
      WHEN 'quoted'        THEN v_title := 'Custom order quote ready';  v_message := 'We''ve prepared a quote for your custom order. Check it out!';
      WHEN 'accepted'      THEN v_title := 'Custom order accepted';     v_message := 'Your custom order has been accepted and is moving forward.';
      WHEN 'rejected'      THEN v_title := 'Custom order update';       v_message := 'We''re unable to proceed with this custom order request.';
      WHEN 'completed'     THEN v_title := 'Custom order completed 🎉'; v_message := 'Your custom order is complete!';
      ELSE v_title := NULL;
    END CASE;
  ELSE
    v_title := NULL;
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.customer_order_alerts(user_id, entity_type, entity_id, title, message, url)
    VALUES (NEW.user_id, 'custom_order', NEW.id, v_title, v_message, '/orders');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_requests_notify_customer_insert ON public.custom_requests;
CREATE TRIGGER custom_requests_notify_customer_insert AFTER INSERT ON public.custom_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_custom_order_change();

DROP TRIGGER IF EXISTS custom_requests_notify_customer_update ON public.custom_requests;
CREATE TRIGGER custom_requests_notify_customer_update AFTER UPDATE ON public.custom_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_custom_order_change();

-- ── bill_transactions: result is set once, synchronously ────────────────
CREATE OR REPLACE FUNCTION public.notify_customer_bill_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_message text; v_service text;
BEGIN
  v_service := CASE NEW.service_type
    WHEN 'airtime' THEN 'Airtime' WHEN 'data' THEN 'Data'
    WHEN 'electricity' THEN 'Electricity' WHEN 'cable' THEN 'Cable TV'
    ELSE 'Bill'
  END;
  CASE NEW.status
    WHEN 'success' THEN v_title := 'Bill payment successful'; v_message := v_service || ' payment of ₦' || to_char(NEW.amount, 'FM999,999,999,990.00') || ' was successful.';
    WHEN 'failed'  THEN v_title := 'Bill payment failed';     v_message := v_service || ' payment of ₦' || to_char(NEW.amount, 'FM999,999,999,990.00') || ' could not be completed.';
    ELSE                v_title := 'Bill payment processing'; v_message := v_service || ' payment is being processed.';
  END CASE;

  INSERT INTO public.customer_order_alerts(user_id, entity_type, entity_id, title, message, url)
  VALUES (NEW.user_id, 'bill', NEW.id, v_title, v_message, '/wallet-history');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bill_transactions_notify_customer ON public.bill_transactions;
CREATE TRIGGER bill_transactions_notify_customer AFTER INSERT ON public.bill_transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_bill_transaction();

-- ── payment_links: only expiry/cancellation (the "paid" transition is
-- already covered by the linked orders row moving to in_review above) ───
CREATE OR REPLACE FUNCTION public.notify_customer_payment_link_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_message text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'expired'   THEN v_title := 'Payment link expired';   v_message := 'Your payment link has expired.';
      WHEN 'cancelled' THEN v_title := 'Payment link cancelled'; v_message := 'Your payment link has been cancelled.';
      ELSE v_title := NULL;
    END CASE;
  ELSE
    v_title := NULL;
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.customer_order_alerts(user_id, entity_type, entity_id, title, message, url)
    VALUES (NEW.user_id, 'payment_link', NEW.id, v_title, v_message, '/orders');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_links_notify_customer_update ON public.payment_links;
CREATE TRIGGER payment_links_notify_customer_update AFTER UPDATE ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.notify_customer_payment_link_change();

-- ── Fan-out dispatcher (same pg_net pattern as dispatch_admin_order_alert) ─
CREATE OR REPLACE FUNCTION public.dispatch_customer_order_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/send-customer-order-alert',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('alertId', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_order_alerts_dispatch ON public.customer_order_alerts;
CREATE TRIGGER customer_order_alerts_dispatch AFTER INSERT ON public.customer_order_alerts
FOR EACH ROW EXECUTE FUNCTION public.dispatch_customer_order_alert();
