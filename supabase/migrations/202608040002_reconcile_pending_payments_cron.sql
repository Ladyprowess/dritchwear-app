-- Schedules the reconcile-pending-payments edge function, the safety net
-- behind the Paystack webhook: catches any pay-link payment Paystack
-- confirms as successful that our system never heard about (webhook
-- downtime/misconfiguration, or a payment made before the webhook was
-- registered in the Paystack dashboard).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$ BEGIN PERFORM cron.unschedule('dritchwear-reconcile-pending-payments'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-reconcile-pending-payments',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/reconcile-pending-payments',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"source":"database-cron"}'::jsonb
  );$$
);
