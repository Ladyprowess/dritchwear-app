-- "Shop the Look" outfits: curated product bundles tagged by occasion,
-- powering the customer "Where are you going?" stylist experience.

CREATE TABLE IF NOT EXISTS public.outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  occasion text NOT NULL,
  subtitle text,
  cover_image text,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outfit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (outfit_id, product_id)
);

CREATE INDEX IF NOT EXISTS outfits_active_occasion_idx ON public.outfits(is_active, occasion, position);
CREATE INDEX IF NOT EXISTS outfit_items_outfit_idx ON public.outfit_items(outfit_id, position);

ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_items ENABLE ROW LEVEL SECURITY;

-- Everyone can read active looks; admins can read/write everything.
DROP POLICY IF EXISTS "Anyone can read active outfits" ON public.outfits;
CREATE POLICY "Anyone can read active outfits" ON public.outfits
  FOR SELECT
  USING (is_active = true OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins manage outfits" ON public.outfits;
CREATE POLICY "Admins manage outfits" ON public.outfits
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Anyone can read outfit items" ON public.outfit_items;
CREATE POLICY "Anyone can read outfit items" ON public.outfit_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage outfit items" ON public.outfit_items;
CREATE POLICY "Admins manage outfit items" ON public.outfit_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
