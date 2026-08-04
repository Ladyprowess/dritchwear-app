ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_on_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_label text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_sale_label_length;

ALTER TABLE public.products
  ADD CONSTRAINT products_sale_label_length
  CHECK (sale_label IS NULL OR char_length(sale_label) <= 14);
