-- Piece-count minimum order (separate from the existing NGN-value minimum),
-- so retail checkout can require e.g. 5 items instead of/in addition to a
-- naira threshold - stops single-piece custom-fit production runs from
-- eating the margin on every order.
ALTER TABLE public.commerce_settings
  ADD COLUMN IF NOT EXISTS minimum_order_quantity INTEGER NOT NULL DEFAULT 5;
