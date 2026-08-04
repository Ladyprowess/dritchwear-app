CREATE TABLE IF NOT EXISTS public.cart_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_count integer NOT NULL DEFAULT 0,
  subtotal_ngn numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cleared','converted')),
  first_reminder_at timestamptz,
  second_reminder_at timestamptz,
  final_reminder_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cart_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own cart session" ON public.cart_sessions;
CREATE POLICY "Users manage own cart session" ON public.cart_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cart_reminders_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cart_email_reminders_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.commerce_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  cart_reminders_enabled boolean NOT NULL DEFAULT true,
  first_reminder_hours integer NOT NULL DEFAULT 1 CHECK (first_reminder_hours BETWEEN 1 AND 48),
  second_reminder_hours integer NOT NULL DEFAULT 24 CHECK (second_reminder_hours BETWEEN 2 AND 168),
  final_reminder_hours integer NOT NULL DEFAULT 72 CHECK (final_reminder_hours BETWEEN 6 AND 336),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.commerce_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.commerce_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads commerce settings" ON public.commerce_settings;
CREATE POLICY "Anyone reads commerce settings" ON public.commerce_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins update commerce settings" ON public.commerce_settings;
CREATE POLICY "Admins update commerce settings" ON public.commerce_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.cart_reminder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 3),
  channels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stage)
);
ALTER TABLE public.cart_reminder_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own cart reminders" ON public.cart_reminder_events;
CREATE POLICY "Users read own cart reminders" ON public.cart_reminder_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN PERFORM cron.unschedule('dritchwear-cart-reminders'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-cart-reminders',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/process-cart-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"source":"database-cron"}'::jsonb
  );$$
);
