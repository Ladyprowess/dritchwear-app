-- Tier-gated products: a product with min_tier set is only shoppable by members
-- at or above that wardrobe tier (Silver/Gold/Platinum). NULL = available to all.
alter table public.products
  add column if not exists min_tier text;
