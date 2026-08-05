-- notify_customer_order_change fired "Payment link created" / "share the
-- payment link" on EVERY new unpaid order, regardless of how it was created.
-- That was accurate back when only Pay-for-Me links pre-created a pending
-- order, but regular card checkout now also creates the order as
-- pending_payment before Paystack opens (so there's something to reconcile
-- against) - so every ordinary card checkout attempt was firing a
-- "payment link" notification/email for a link that doesn't exist.
-- Distinguish by payment_method instead.
CREATE OR REPLACE FUNCTION public.notify_customer_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_message text; v_should_email boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_status = 'paid' THEN
      v_title := 'Order placed successfully 🎉';
      v_message := 'Your Dritchwear order is confirmed. Delivery usually takes 2–7 days.';
    ELSIF NEW.payment_method = 'pay_link' THEN
      v_title := 'Payment link created';
      v_message := 'Your order is waiting for payment. Open your orders to complete or share the payment link.';
    ELSE
      v_title := 'Complete your payment';
      v_message := 'Your order is waiting for payment. Open your orders to complete checkout.';
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
        WHEN 'in_review'  THEN
          IF NEW.payment_status = 'paid' THEN
            v_title := 'Payment received'; v_message := 'Your payment was received. Your order is now in review.';
          ELSE
            v_title := NULL; v_should_email := false;
          END IF;
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
