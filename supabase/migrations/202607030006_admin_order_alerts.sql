CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('order','custom_order','system')),
  title text NOT NULL,
  message text NOT NULL,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read alerts" ON public.admin_alerts;
CREATE POLICY "Admins read alerts" ON public.admin_alerts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admins update alerts" ON public.admin_alerts;
CREATE POLICY "Admins update alerts" ON public.admin_alerts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.notify_admin_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE customer_name text;
BEGIN
  SELECT COALESCE(full_name, email, 'A customer') INTO customer_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.admin_alerts(type, title, message, entity_id)
  VALUES (
    'order',
    CASE WHEN NEW.payment_status = 'paid' THEN 'New paid order received' ELSE 'New order received' END,
    customer_name || ' placed an order worth ₦' || to_char(COALESCE(NEW.total, 0), 'FM999,999,999,990.00') || '.',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_notify_admin ON public.orders;
CREATE TRIGGER orders_notify_admin AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_order();

CREATE OR REPLACE FUNCTION public.notify_admin_custom_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE customer_name text;
BEGIN
  SELECT COALESCE(full_name, email, 'A customer') INTO customer_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.admin_alerts(type, title, message, entity_id)
  VALUES ('custom_order', 'New custom order request', customer_name || ' submitted “' || COALESCE(NEW.title, 'Custom order') || '”.', NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_orders_notify_admin ON public.custom_requests;
CREATE TRIGGER custom_orders_notify_admin AFTER INSERT ON public.custom_requests FOR EACH ROW EXECUTE FUNCTION public.notify_admin_custom_order();

CREATE INDEX IF NOT EXISTS admin_alerts_unread_created_idx ON public.admin_alerts(is_read, created_at DESC);
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_alerts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
