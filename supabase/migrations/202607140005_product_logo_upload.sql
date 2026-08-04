-- Per-product "customer can upload a logo" toggle. When on, the product modal
-- shows a logo upload box; the uploaded logo flows into the order item and
-- shows in the admin Order Details.
alter table public.products
  add column if not exists allow_logo_upload boolean not null default false;
