-- The real disk-IO story: net._http_response (118.5MB) and
-- cron.job_run_details (91MB) together are ~87% of the entire database
-- (0.24GB total). Every pg_cron run and every net.http_post call (every
-- alert dispatch, every retry-stuck-alerts/scheduled-communications tick -
-- two of which fire every single minute) permanently logs a row in these
-- extension-owned tables, and nothing has ever pruned them. That constant,
-- ever-growing write/vacuum activity - not the missing index alone - is the
-- likely primary driver of the Disk IO budget warning.
--
-- This adds a daily cleanup that keeps 3 days of history in each (plenty for
-- debugging a recent failure) and deletes the rest.
CREATE OR REPLACE FUNCTION public.prune_cron_and_net_logs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron, net AS $$
BEGIN
  DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '3 days';
  DELETE FROM net._http_response WHERE created < NOW() - INTERVAL '3 days';
END;
$$;

DO $$ BEGIN PERFORM cron.unschedule('dritchwear-prune-cron-net-logs'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'dritchwear-prune-cron-net-logs',
  '0 3 * * *',
  $$SELECT public.prune_cron_and_net_logs();$$
);

-- One-time immediate cleanup so the fix takes effect right away instead of
-- waiting for tomorrow's 3am run. TRUNCATE rather than the function's DELETE:
-- deleting ~200MB row by row hit the SQL Editor's upstream timeout, while
-- TRUNCATE is instant. Both tables are pure logs, so losing the last 3 days
-- of history once is harmless; the nightly job keeps them small from here.
TRUNCATE net._http_response;
TRUNCATE cron.job_run_details;
