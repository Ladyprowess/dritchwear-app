-- Minimum order quantity for B2B products dropped from 20 to 10 pieces,
-- across the board: new products default to it, and any existing product
-- still sitting at the old default of 20 (i.e. never customised by admin)
-- moves to 10 too, so the catalogue stays consistent everywhere.
ALTER TABLE public.b2b_products ALTER COLUMN min_qty SET DEFAULT 10;
UPDATE public.b2b_products SET min_qty = 10 WHERE min_qty = 20;
