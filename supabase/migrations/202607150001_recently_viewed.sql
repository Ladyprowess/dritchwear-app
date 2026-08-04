-- Account-synced "Recently viewed" so it follows the shopper across devices and
-- survives a browser/storage clear (guests still use on-device storage).
create table if not exists public.recently_viewed (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists recently_viewed_user_idx
  on public.recently_viewed(user_id, viewed_at desc);

alter table public.recently_viewed enable row level security;

drop policy if exists "Users manage own recently viewed" on public.recently_viewed;
create policy "Users manage own recently viewed" on public.recently_viewed
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
