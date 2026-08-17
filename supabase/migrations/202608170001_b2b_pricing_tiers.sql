-- B2B catalogue: products (with tiered pricing) + event packages, shown on
-- the /corporate landing page. Admin-managed via /(admin)/b2b-catalog.
-- Product photos reuse the existing 'portfolio-media' bucket (prefix
-- 'b2b-products/') so no new storage bucket/policies are needed.

CREATE TABLE IF NOT EXISTS public.b2b_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  photo_url     TEXT,
  colors        TEXT[] NOT NULL DEFAULT '{}',
  sizes         TEXT[] NOT NULL DEFAULT '{}',
  fabric_spec   TEXT,
  min_qty       INTEGER NOT NULL DEFAULT 20,
  price_20_49   INTEGER,
  price_50_99   INTEGER,
  price_100_plus INTEGER,
  branding_note TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.b2b_packages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  price_per_person INTEGER,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS branding_type TEXT;

CREATE INDEX IF NOT EXISTS idx_b2b_products_sort ON public.b2b_products (sort_order);
CREATE INDEX IF NOT EXISTS idx_b2b_packages_sort ON public.b2b_packages (sort_order);

ALTER TABLE public.b2b_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "b2b products public read" ON public.b2b_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "b2b products admin insert" ON public.b2b_products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "b2b products admin update" ON public.b2b_products FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "b2b products admin delete" ON public.b2b_products FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "b2b packages public read" ON public.b2b_packages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "b2b packages admin insert" ON public.b2b_packages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "b2b packages admin update" ON public.b2b_packages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "b2b packages admin delete" ON public.b2b_packages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

GRANT SELECT ON public.b2b_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.b2b_products TO authenticated;
GRANT SELECT ON public.b2b_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.b2b_packages TO authenticated;
