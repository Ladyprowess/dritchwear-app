-- Supports the B2B "quote basket" funnel: products selected while browsing
-- /corporate/products get attached to the quote request as structured data
-- (not just free text), and portfolio items gain case-study fields so
-- "Previous Work" can show what was actually produced, not just photos.

ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS selected_items JSONB;

ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS products_summary TEXT;
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS branding_method TEXT;
