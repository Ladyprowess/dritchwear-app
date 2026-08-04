-- Adds an explicit opt-in flag so the existing customer_order_alerts fan-out
-- (in-app + push, see 202608020004) can also send an email, without turning
-- every alert type (chat, bill payments, link expiry) into an email blast.
-- Scoped to admin-driven order/custom-order status changes specifically -
-- the "in review -> confirmed -> processing -> shipped -> delivered /
-- cancelled" lifecycle - not to order/custom-order creation, which already
-- has its own on-screen confirmation.
ALTER TABLE public.customer_order_alerts ADD COLUMN IF NOT EXISTS should_email boolean NOT NULL DEFAULT false;

-- ── orders: every order_status/payment_status change now emails too ─────
CREATE OR REPLACE FUNCTION public.notify_customer_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_message text; v_should_email boolean := false;
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
      v_should_email := true;
      CASE NEW.order_status
        WHEN 'confirmed'  THEN v_title := 'Order confirmed';     v_message := 'Your order has been confirmed and is being prepared.';
        WHEN 'processing' THEN v_title := 'Order processing';    v_message := 'Your order is being processed.';
        WHEN 'shipped'    THEN v_title := 'Order shipped 🚚';    v_message := 'Your order is on its way!';
        WHEN 'delivered'  THEN v_title := 'Order delivered 📦';  v_message := 'Your order has been delivered. Enjoy!';
        WHEN 'cancelled'  THEN v_title := 'Order cancelled';     v_message := 'Your order has been cancelled.';
        WHEN 'in_review'  THEN v_title := 'Payment received';    v_message := 'Your payment was received. Your order is now in review.';
        ELSE v_title := NULL; v_should_email := false;
      END CASE;
    ELSIF NEW.payment_status = 'failed' AND OLD.payment_status IS DISTINCT FROM 'failed' THEN
      v_title := 'Payment failed'; v_message := 'Your order payment could not be completed. Please try again.'; v_should_email := true;
    ELSIF NEW.payment_status = 'refunded' AND OLD.payment_status IS DISTINCT FROM 'refunded' THEN
      v_title := 'Order refunded'; v_message := 'Your order payment has been refunded.'; v_should_email := true;
    ELSE
      v_title := NULL;
    END IF;
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.customer_order_alerts(user_id, entity_type, entity_id, title, message, url, should_email)
    VALUES (NEW.user_id, 'order', NEW.id, v_title, v_message, '/orders', v_should_email);
  END IF;
  RETURN NEW;
END;
$$;

-- ── custom_requests: every status change now emails too ─────────────────
CREATE OR REPLACE FUNCTION public.notify_customer_custom_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_message text; v_should_email boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'Custom order request received';
    v_message := 'We''ve received your custom order request. We''ll review it and get back to you soon.';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_should_email := true;
    CASE NEW.status
      WHEN 'under_review' THEN v_title := 'Custom order under review'; v_message := 'Your custom order request is being reviewed.';
      WHEN 'quoted'        THEN v_title := 'Custom order quote ready';  v_message := 'We''ve prepared a quote for your custom order. Check it out!';
      WHEN 'accepted'      THEN v_title := 'Custom order accepted';     v_message := 'Your custom order has been accepted and is moving forward.';
      WHEN 'rejected'      THEN v_title := 'Custom order update';       v_message := 'We''re unable to proceed with this custom order request.';
      WHEN 'completed'     THEN v_title := 'Custom order completed 🎉'; v_message := 'Your custom order is complete!';
      ELSE v_title := NULL; v_should_email := false;
    END CASE;
  ELSE
    v_title := NULL;
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.customer_order_alerts(user_id, entity_type, entity_id, title, message, url, should_email)
    VALUES (NEW.user_id, 'custom_order', NEW.id, v_title, v_message, '/orders', v_should_email);
  END IF;
  RETURN NEW;
END;
$$;
