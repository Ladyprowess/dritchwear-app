-- Quantity-based promo conditions, e.g. "free delivery when you buy 3+ items".
-- NULL = no quantity requirement.
alter table public.promo_codes
  add column if not exists min_quantity integer;
