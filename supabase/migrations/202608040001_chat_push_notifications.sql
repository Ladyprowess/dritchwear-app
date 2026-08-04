-- Live chat currently only notifies whoever has the app open (Realtime
-- subscription in useAdminChatAlerts.ts / help-support.tsx). Nobody gets a
-- push when the app is closed/backgrounded. This wires support_messages into
-- the two existing alert pipelines: admin_alerts (customer -> admins) and
-- customer_order_alerts (admin -> customer), both already push-enabled.

ALTER TABLE public.admin_alerts DROP CONSTRAINT IF EXISTS admin_alerts_type_check;
ALTER TABLE public.admin_alerts
  ADD CONSTRAINT admin_alerts_type_check CHECK (type IN ('order','custom_order','system','chat'));

ALTER TABLE public.customer_order_alerts DROP CONSTRAINT IF EXISTS customer_order_alerts_entity_type_check;
ALTER TABLE public.customer_order_alerts
  ADD CONSTRAINT customer_order_alerts_entity_type_check CHECK (entity_type IN ('order','custom_order','bill','payment_link','chat'));

CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender_role text;
  v_customer_id uuid;
  v_preview text;
BEGIN
  SELECT role INTO v_sender_role FROM public.profiles WHERE id = NEW.sender_id;
  SELECT user_id INTO v_customer_id FROM public.support_tickets WHERE id = NEW.ticket_id;

  v_preview := left(coalesce(NEW.message, ''), 120);
  IF v_preview = '' THEN v_preview := 'Sent an attachment'; END IF;

  IF v_sender_role = 'admin' THEN
    IF v_customer_id IS NOT NULL THEN
      INSERT INTO public.customer_order_alerts(user_id, entity_type, entity_id, title, message, url)
      VALUES (v_customer_id, 'chat', NEW.ticket_id, 'New message from support', v_preview, '/help-support');
    END IF;
  ELSE
    INSERT INTO public.admin_alerts(type, title, message, entity_id)
    VALUES ('chat', 'New customer message', v_preview, NEW.ticket_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_notify ON public.support_messages;
CREATE TRIGGER support_messages_notify AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();
