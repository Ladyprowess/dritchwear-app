-- Schedules retry-stuck-alerts: a safety net for customer_order_alerts whose
-- fire-and-forget pg_net dispatch never landed (redeploy timing, transient
-- network blip, cold start), leaving push/in-app/email notifications
-- silently never sent. Runs every 10 minutes.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$ BEGIN PERFORM cron.unschedule('dritchwear-retry-stuck-alerts'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-retry-stuck-alerts',
  '*/10 * * * *',
  $$SELECT net.http_post(
    url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/retry-stuck-alerts',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"source":"database-cron"}'::jsonb
  );$$
);
