-- retry-stuck-alerts (now running every minute, see 202608060001) queries
-- `WHERE delivered_at IS NULL AND created_at < cutoff` on this table every
-- run. customer_order_alerts already has a matching partial index; this one
-- never got one, so every run has been a full sequential scan of the whole
-- table - 1,440 scans/day since the cron was sped up. Very likely the
-- primary driver of the Disk IO budget warning.
CREATE INDEX IF NOT EXISTS admin_alerts_undelivered_idx ON public.admin_alerts(delivered_at) WHERE delivered_at IS NULL;
