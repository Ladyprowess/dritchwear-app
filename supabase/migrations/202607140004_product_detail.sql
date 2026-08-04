-- SHEIN-style product detail: real discounts, per-size stock, and fit feedback.

-- 1. Compare-at (original) price → strikethrough + real "-X%" badge.
alter table public.products
  add column if not exists compare_at_price numeric;

-- 2. Per-size stock, e.g. {"M": 3, "L": 0}. Empty = fall back to the single
--    `stock` number (backward compatible).
alter table public.products
  add column if not exists size_stock jsonb not null default '{}'::jsonb;

-- 3. Fit feedback on reviews: 'small' | 'true' | 'large' → "X% true to size".
alter table public.reviews
  add column if not exists fit text;
