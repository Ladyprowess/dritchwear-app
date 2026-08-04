-- Photo reviews: customers attach images to their product reviews so others can
-- see the pieces on real people (SHEIN-style trust). NULL/empty = text-only.
alter table public.reviews
  add column if not exists image_urls text[] not null default '{}';
