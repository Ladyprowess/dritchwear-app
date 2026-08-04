-- Admin-configurable commerce settings: delivery fees, service/tax rates,
-- minimum order and a master store open/closed switch.
--
-- Extends the existing commerce_settings singleton (see 202607030005_cart_abandonment.sql)
-- and adds a delivery_zones table so the admin can define per-location delivery fees
-- without a code change. Seeds reproduce today's hardcoded behaviour in lib/fees.ts.

-- 1. Global scalar settings on the commerce_settings singleton -----------------
ALTER TABLE public.commerce_settings
  ADD COLUMN IF NOT EXISTS free_delivery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold_ngn numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_percentage numeric NOT NULL DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS tax_percentage numeric NOT NULL DEFAULT 0.075,
  ADD COLUMN IF NOT EXISTS minimum_order_ngn numeric(12,2) NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS store_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS store_closed_message text NOT NULL
    DEFAULT 'We are briefly closed. Please check back soon.';

-- 2. Per-location delivery zones ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  match_keywords text[] NOT NULL DEFAULT '{}',
  fee_ngn numeric(12,2) NOT NULL DEFAULT 0 CHECK (fee_ngn >= 0),
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one zone may act as the fallback (matches when no keyword matches).
CREATE UNIQUE INDEX IF NOT EXISTS delivery_zones_single_default
  ON public.delivery_zones (is_default) WHERE is_default = true;

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads delivery zones" ON public.delivery_zones;
CREATE POLICY "Anyone reads delivery zones" ON public.delivery_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins insert delivery zones" ON public.delivery_zones;
CREATE POLICY "Admins insert delivery zones" ON public.delivery_zones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins update delivery zones" ON public.delivery_zones;
CREATE POLICY "Admins update delivery zones" ON public.delivery_zones FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins delete delivery zones" ON public.delivery_zones;
CREATE POLICY "Admins delete delivery zones" ON public.delivery_zones FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Seed zones reproducing the current lib/fees.ts behaviour ------------------
-- Lagos = 3500, rest of Nigeria = 5000, everywhere else (default) = 15000.
INSERT INTO public.delivery_zones (name, match_keywords, fee_ngn, is_default, sort_order)
SELECT * FROM (VALUES
  ('Lagos', ARRAY['lagos'], 3500::numeric, false, 10),
  ('Rest of Nigeria', ARRAY[
    'nigeria','abia','adamawa','akwa ibom','anambra','bauchi','bayelsa','benue','borno',
    'cross river','delta','ebonyi','edo','ekiti','enugu','gombe','imo','jigawa','kaduna',
    'kano','katsina','kebbi','kogi','kwara','nasarawa','niger','ogun','ondo','osun','oyo',
    'plateau','rivers','sokoto','taraba','yobe','zamfara','abuja','fct','ibadan',
    'port harcourt','benin','maiduguri','zaria','aba','jos','ilorin','onitsha','warri',
    'okene','calabar','uyo','ado-ekiti','awka','akure','makurdi','lafia','yenagoa',
    'jalingo','owerri','abakaliki','dutse','damaturu','gusau','yola','minna',
    'birnin kebbi','lokoja','osogbo'
  ], 5000::numeric, false, 20),
  ('International', ARRAY[]::text[], 15000::numeric, true, 30)
) AS seed(name, match_keywords, fee_ngn, is_default, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones);
