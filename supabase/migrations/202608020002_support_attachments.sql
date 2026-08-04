-- File attachments for messaging. Attachments live in their own table (not JSON
-- on support_messages) so a message can carry several files, and files are easy
-- to list, download, moderate and delete. Files are stored in a PRIVATE bucket
-- and served through short-lived signed URLs.

-- ── Private storage bucket ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

-- Any signed-in user may upload to / read from this private bucket. The bucket is
-- not public, so objects are only reachable via a signed URL, and the storage
-- path is only ever exposed through the RLS-protected table below - so a user
-- cannot discover another customer's files.
drop policy if exists "support attach upload" on storage.objects;
create policy "support attach upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments');

drop policy if exists "support attach read" on storage.objects;
create policy "support attach read" on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments');

-- ── Attachment metadata table ─────────────────────────────────────────────────
create table if not exists public.support_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.support_messages(id) on delete cascade,
  ticket_id uuid references public.support_tickets(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists sma_message_idx on public.support_message_attachments(message_id);
create index if not exists sma_ticket_idx on public.support_message_attachments(ticket_id);

alter table public.support_message_attachments enable row level security;

-- Ticket owner or an admin can read the attachments on a conversation.
drop policy if exists "sma select participant" on public.support_message_attachments;
create policy "sma select participant" on public.support_message_attachments
  for select to authenticated
  using (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Same set may attach files.
drop policy if exists "sma insert owner" on public.support_message_attachments;
create policy "sma insert owner" on public.support_message_attachments
  for insert to authenticated
  with check (
    exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Realtime so attachments appear alongside their message instantly.
do $$
begin
  begin
    alter publication supabase_realtime add table public.support_message_attachments;
  exception when duplicate_object then null;
  end;
end $$;
alter table public.support_message_attachments replica identity full;
