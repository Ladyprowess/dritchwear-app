-- Add promo type and item-specific discount support to promo_codes table

ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (type IN ('percentage', 'free_delivery', 'item_percentage')),
  ADD COLUMN IF NOT EXISTS applicable_product_id UUID
    REFERENCES products(id) ON DELETE SET NULL;

-- Backfill existing rows to 'percentage'
UPDATE promo_codes SET type = 'percentage' WHERE type IS NULL OR type = '';

-- Index for looking up item-specific promos
CREATE INDEX IF NOT EXISTS idx_promo_codes_product
  ON promo_codes(applicable_product_id)
  WHERE applicable_product_id IS NOT NULL;
