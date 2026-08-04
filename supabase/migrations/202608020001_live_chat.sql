-- Messaging: upgrade the existing support ticket system to real-time.
-- No new tables or columns - we simply enable Supabase Realtime on the support
-- tables so messages appear instantly for both the customer and the admin.

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.support_tickets;
  exception when duplicate_object then null;
  end;
end $$;

-- Realtime needs full row data for reliable INSERT payloads.
alter table public.support_messages replica identity full;
alter table public.support_tickets replica identity full;
