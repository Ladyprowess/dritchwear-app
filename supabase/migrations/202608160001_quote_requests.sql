-- B2B/corporate lead capture: companies submit a quote request from the
-- public /corporate page (no account required) instead of going through the
-- retail cart. Feature 2 (admin quote-to-invoice) will read/update this
-- table later - this migration only adds the intake side.
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name        TEXT NOT NULL,
  contact_name        TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  product_interest    TEXT,
  estimated_quantity  TEXT NOT NULL,
  needed_by           DATE,
  logo_url            TEXT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'paid', 'rejected')),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON public.quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON public.quote_requests(created_at DESC);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a quote request, including logged-out visitors - this is
-- a public lead-capture form, the same trust level as a marketing contact form.
DROP POLICY IF EXISTS "Anyone can submit a quote request" ON public.quote_requests;
CREATE POLICY "Anyone can submit a quote request"
  ON public.quote_requests FOR INSERT
  WITH CHECK (true);

-- Admins can see and manage every request.
DROP POLICY IF EXISTS "Admins can view quote requests" ON public.quote_requests;
CREATE POLICY "Admins can view quote requests"
  ON public.quote_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "Admins can update quote requests" ON public.quote_requests;
CREATE POLICY "Admins can update quote requests"
  ON public.quote_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- A logged-in submitter can see their own past requests.
DROP POLICY IF EXISTS "Users can view their own quote requests" ON public.quote_requests;
CREATE POLICY "Users can view their own quote requests"
  ON public.quote_requests FOR SELECT
  USING (auth.uid() = user_id);
