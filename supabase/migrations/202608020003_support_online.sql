-- Admin-controlled support presence. Reuses the single commerce_settings row so
-- the customer Messaging status chip can show "We're here" vs "Away".
alter table public.commerce_settings
  add column if not exists support_online boolean not null default true;
