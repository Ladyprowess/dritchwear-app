CREATE TABLE IF NOT EXISTS public.scheduled_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  payload jsonb NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_communications_due_idx ON public.scheduled_communications(status, scheduled_at);
ALTER TABLE public.scheduled_communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage scheduled communications" ON public.scheduled_communications;
CREATE POLICY "Admins manage scheduled communications" ON public.scheduled_communications FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ BEGIN PERFORM cron.unschedule('dritchwear-scheduled-communications'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-scheduled-communications', '* * * * *',
  $$SELECT net.http_post(url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/process-scheduled-communications', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{"source":"database-cron"}'::jsonb);$$
);
