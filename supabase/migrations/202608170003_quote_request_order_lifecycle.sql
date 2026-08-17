-- Bridges B2B quote_requests into the existing custom_requests order
-- lifecycle (admin pricing via invoices, customer wallet/Paystack payment,
-- status-change emails) instead of building a parallel system. A logged-in
-- quote submission auto-creates a linked custom_requests row so it shows up
-- in both the admin and customer Orders tab immediately. Anonymous
-- submissions (no account) stay email-only, same as before, since
-- custom_requests.user_id is NOT NULL and there's no account to attach it to.

ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS custom_request_id UUID REFERENCES public.custom_requests(id);

-- Referenced by the CustomRequest type/admin UI but never actually existed
-- on the table (confirmed via direct schema query - selecting it 400s).
ALTER TABLE public.custom_requests ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- The original CHECK constraint only allowed pending/under_review/quoted/
-- accepted/rejected/completed - it never included 'payment_made', which
-- useCustomOrderPayment.ts has been setting on every successful custom-order
-- payment since that feature shipped. That INSERT/UPDATE has been silently
-- failing the CHECK constraint. Widening it to the full order lifecycle
-- fixes that pre-existing bug and adds processing/shipped/delivered/
-- cancelled so custom orders (including bridged B2B quotes) can move through
-- the same granular stages regular orders do.
ALTER TABLE public.custom_requests DROP CONSTRAINT IF EXISTS custom_requests_status_check;
ALTER TABLE public.custom_requests ADD CONSTRAINT custom_requests_status_check
  CHECK (status IN ('pending', 'under_review', 'quoted', 'accepted', 'payment_made', 'processing', 'shipped', 'delivered', 'completed', 'rejected', 'cancelled'));

CREATE OR REPLACE FUNCTION public.notify_customer_custom_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_message text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'Custom order request received';
    v_message := 'We''ve received your custom order request. We''ll review it and get back to you soon.';
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'under_review'  THEN v_title := 'Custom order under review'; v_message := 'Your custom order request is being reviewed.';
      WHEN 'quoted'        THEN v_title := 'Custom order quote ready';  v_message := 'We''ve prepared a quote for your custom order. Check it out!';
      WHEN 'accepted'      THEN v_title := 'Custom order accepted';     v_message := 'Your custom order has been accepted and is moving forward.';
      WHEN 'payment_made'  THEN v_title := 'Payment received';         v_message := 'We''ve received your payment. Your order is moving into production.';
      WHEN 'processing'    THEN v_title := 'Order processing';         v_message := 'Your order is now being processed.';
      WHEN 'shipped'       THEN v_title := 'Order shipped';            v_message := 'Your order is on its way.';
      WHEN 'delivered'     THEN v_title := 'Order delivered';          v_message := 'Your order has been delivered. We hope you love it!';
      WHEN 'rejected'      THEN v_title := 'Custom order update';       v_message := 'We''re unable to proceed with this custom order request.';
      WHEN 'cancelled'     THEN v_title := 'Order cancelled';          v_message := 'This order has been cancelled.';
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

-- Parses a leading integer out of free-text quantity estimates like
-- "100+" or "20 - 50" (falls back to 20, the catalogue's own minimum, when
-- nothing numeric is found).
CREATE OR REPLACE FUNCTION public.parse_leading_quantity(txt TEXT)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m TEXT;
BEGIN
  m := substring(txt FROM '\d+');
  IF m IS NULL THEN RETURN 20; END IF;
  RETURN GREATEST(1, m::INTEGER);
END;
$$;

CREATE OR REPLACE FUNCTION public.bridge_quote_request_to_custom_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_custom_request_id UUID;
  v_deadline TIMESTAMPTZ;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- needed_by is free text from the quote form ("December 2026", "ASAP") -
  -- only use it if it happens to parse as a real date/timestamp, otherwise
  -- leave deadline NULL rather than let a cast error abort the whole quote
  -- submission (this trigger runs inside the same transaction as the insert).
  BEGIN
    v_deadline := NEW.needed_by::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    v_deadline := NULL;
  END;

  INSERT INTO public.custom_requests(
    user_id, title, description, quantity, budget_range,
    business_name, logo_url, delivery_address, deadline, contact_phone, status
  ) VALUES (
    NEW.user_id,
    'Corporate Quote - ' || NEW.company_name,
    COALESCE(NEW.product_interest, 'Bulk/corporate merchandise inquiry')
      || CASE WHEN NEW.branding_type IS NOT NULL THEN E'\nBranding: ' || NEW.branding_type ELSE '' END
      || CASE WHEN NEW.needed_by IS NOT NULL AND v_deadline IS NULL THEN E'\nNeeded by: ' || NEW.needed_by ELSE '' END
      || CASE WHEN NEW.notes IS NOT NULL THEN E'\nNotes: ' || NEW.notes ELSE '' END,
    public.parse_leading_quantity(NEW.estimated_quantity),
    NEW.estimated_quantity,
    NEW.company_name,
    NEW.logo_url,
    NEW.delivery_address,
    v_deadline,
    NEW.phone,
    'pending'
  )
  RETURNING id INTO v_custom_request_id;

  UPDATE public.quote_requests SET custom_request_id = v_custom_request_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_requests_bridge_to_custom_order ON public.quote_requests;
CREATE TRIGGER quote_requests_bridge_to_custom_order AFTER INSERT ON public.quote_requests
FOR EACH ROW EXECUTE FUNCTION public.bridge_quote_request_to_custom_order();
