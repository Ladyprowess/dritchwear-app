-- Optional short marketing detail line shown under the product name
-- on shop cards, e.g. "220 GSM • Oversized Fit" or "100% Cotton".
alter table public.products
  add column if not exists subtitle text;
