-- Public "past work" showcase - builds trust with corporate leads before they
-- submit a quote. Publicly readable (anyone browsing /portfolio, logged in
-- or not), admin-only to create/edit/delete.
--
-- Lessons applied from the quote_requests table: (1) explicit GRANTs, not
-- just RLS policies - a role needs the underlying SQL privilege before a
-- policy is even evaluated. (2) media_urls is a plain jsonb array of
-- {url, type} objects rather than a second table, kept simple since items
-- are only ever written by an admin through one form.
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('corporate', 'event', 'streetwear')),
  description  TEXT,
  client_name  TEXT,
  media_urls   JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{ url, type: 'image' | 'video' }]
  is_featured  BOOLEAN NOT NULL DEFAULT false,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_items_category ON public.portfolio_items(category);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_sort ON public.portfolio_items(sort_order, created_at DESC);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view portfolio items" ON public.portfolio_items;
CREATE POLICY "Anyone can view portfolio items"
  ON public.portfolio_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert portfolio items" ON public.portfolio_items;
CREATE POLICY "Admins can insert portfolio items"
  ON public.portfolio_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "Admins can update portfolio items" ON public.portfolio_items;
CREATE POLICY "Admins can update portfolio items"
  ON public.portfolio_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "Admins can delete portfolio items" ON public.portfolio_items;
CREATE POLICY "Admins can delete portfolio items"
  ON public.portfolio_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Table-level grants - RLS policies alone don't help without these (the
-- quote_requests table hit exactly this gap).
GRANT SELECT ON public.portfolio_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;

-- ── Storage bucket for portfolio photos/videos ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-media', 'portfolio-media', true, 104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "portfolio media public read" ON storage.objects;
CREATE POLICY "portfolio media public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'portfolio-media');

DROP POLICY IF EXISTS "portfolio media admin upload" ON storage.objects;
CREATE POLICY "portfolio media admin upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portfolio-media'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "portfolio media admin delete" ON storage.objects;
CREATE POLICY "portfolio media admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'portfolio-media'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
