-- Adding a logo/custom design to a product currently costs nothing extra,
-- which is how a customer ended up with a free chest design and no charge
-- for it. Adds an admin-configurable flat fee, applied per customized item,
-- and a column on orders to record what was actually charged (so it survives
-- future rate changes and shows correctly on past orders).
ALTER TABLE public.commerce_settings
  ADD COLUMN IF NOT EXISTS customization_fee_ngn NUMERIC(12,2) NOT NULL DEFAULT 2000;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customization_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
