-- Admin-set photos for the shop category tiles (keyed by category name).
create table if not exists public.category_images (
  category text primary key,
  image_url text,
  updated_at timestamptz not null default now()
);

alter table public.category_images enable row level security;

drop policy if exists "Anyone reads category images" on public.category_images;
create policy "Anyone reads category images" on public.category_images for select using (true);

drop policy if exists "Admins manage category images" on public.category_images;
create policy "Admins manage category images" on public.category_images for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
