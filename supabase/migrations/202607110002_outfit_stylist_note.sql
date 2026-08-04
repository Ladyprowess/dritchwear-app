-- Editorial "Why this works" stylist note shown on the look/edit page.
-- Optional per outfit; the look page renders the section only when it is set.
alter table public.outfits
  add column if not exists stylist_note text;
