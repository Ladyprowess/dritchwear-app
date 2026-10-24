-- dritchwear-retry-stuck-alerts and dritchwear-scheduled-communications both
-- fire every minute and unconditionally net.http_post an edge function, even
-- though almost every tick finds nothing to do. Each tick still costs a
-- net._http_response row, an edge function cold path, and that function's own
-- table queries - roughly 2,880 wasted round trips a day feeding the Disk IO
-- budget warning.
--
-- Same schedules, but each job now checks for due work with a cheap indexed
-- EXISTS first and only calls the edge function when there is something to
-- process. The conditions mirror the functions' own queries exactly
-- (GRACE_MINUTES = 1 in retry-stuck-alerts; status = 'pending' AND
-- scheduled_at <= now() in process-scheduled-communications), so no work is
-- ever skipped.
DO $$ BEGIN PERFORM cron.unschedule('dritchwear-retry-stuck-alerts'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-retry-stuck-alerts',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/retry-stuck-alerts',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"source":"database-cron"}'::jsonb
  )
  WHERE EXISTS (SELECT 1 FROM public.customer_order_alerts WHERE delivered_at IS NULL AND created_at < NOW() - INTERVAL '1 minute')
     OR EXISTS (SELECT 1 FROM public.admin_alerts WHERE delivered_at IS NULL AND created_at < NOW() - INTERVAL '1 minute');$$
);

DO $$ BEGIN PERFORM cron.unschedule('dritchwear-scheduled-communications'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-scheduled-communications', '* * * * *',
  $$SELECT net.http_post(url := 'https://nkftulouqozzaxiezbvr.supabase.co/functions/v1/process-scheduled-communications', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{"source":"database-cron"}'::jsonb)
  WHERE EXISTS (SELECT 1 FROM public.scheduled_communications WHERE status = 'pending' AND scheduled_at <= NOW());$$
);
