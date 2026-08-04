ALTER TABLE public.admin_alerts ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.admin_alerts ADD COLUMN IF NOT EXISTS push_sent_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.admin_alerts ADD COLUMN IF NOT EXISTS email_sent_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.dispatch_admin_order_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/send-admin-order-alert',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('alertId', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_alerts_dispatch_offline ON public.admin_alerts;
CREATE TRIGGER admin_alerts_dispatch_offline AFTER INSERT ON public.admin_alerts
FOR EACH ROW EXECUTE FUNCTION public.dispatch_admin_order_alert();
