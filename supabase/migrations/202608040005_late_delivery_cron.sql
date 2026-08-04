-- Schedules the check-late-deliveries edge function, which enforces the
-- 7-day delivery guarantee (₦1,000 wallet credit for any paid order not
-- delivered within 7 days of confirmation). Runs every 6 hours so
-- compensation doesn't lag a full day behind eligibility.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$ BEGIN PERFORM cron.unschedule('dritchwear-check-late-deliveries'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-check-late-deliveries',
  '0 */6 * * *',
  $$SELECT net.http_post(
    url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/check-late-deliveries',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"source":"database-cron"}'::jsonb
  );$$
);
