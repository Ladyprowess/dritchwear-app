-- Who a look is styled for, so the "Where are you going?" stylist quiz can
-- filter by audience (Men / Women / Unisex).
alter table public.outfits
  add column if not exists gender text not null default 'Unisex';
