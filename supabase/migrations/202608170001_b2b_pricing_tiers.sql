-- B2B pricing tiers: admin-managed price table + calculator data for the
-- public /b2b-pricing page. Each row is one quantity band for one product
-- (+ optional print method, since embroidery vs screen print often differ).
CREATE TABLE IF NOT EXISTS public.b2b_pricing_tiers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  print_method TEXT CHECK (print_method IN ('screen_print', 'embroidery')),
  min_qty      INTEGER NOT NULL CHECK (min_qty > 0),
  max_qty      INTEGER CHECK (max_qty IS NULL OR max_qty >= min_qty),
  unit_price   INTEGER NOT NULL CHECK (unit_price >= 0), -- NGN, whole naira
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_pricing_tiers_product ON public.b2b_pricing_tiers (product_name, sort_order);

ALTER TABLE public.b2b_pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "b2b pricing public read" ON public.b2b_pricing_tiers
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "b2b pricing admin insert" ON public.b2b_pricing_tiers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "b2b pricing admin update" ON public.b2b_pricing_tiers
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "b2b pricing admin delete" ON public.b2b_pricing_tiers
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

GRANT SELECT ON public.b2b_pricing_tiers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.b2b_pricing_tiers TO authenticated;
