-- The stuck-alert safety net ran every 10 minutes with a 5-minute grace
-- period, so a genuinely dropped dispatch (customer_order_alerts OR
-- admin_alerts - retry-stuck-alerts now covers both, see the updated
-- function) could take up to ~15 minutes to recover, which is enough delay
-- for a customer/admin to notice something's wrong. Tightened to run every
-- minute; the function's own grace period is now 1 minute, so a real drop
-- self-heals within roughly 1-2 minutes instead.
DO $$ BEGIN PERFORM cron.unschedule('dritchwear-retry-stuck-alerts'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-retry-stuck-alerts',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/retry-stuck-alerts',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"source":"database-cron"}'::jsonb
  );$$
);
