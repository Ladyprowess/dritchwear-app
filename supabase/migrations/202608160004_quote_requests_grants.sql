-- Confirmed by testing directly: an anonymous insert was rejected with
-- "new row violates row-level security policy" even though the INSERT
-- policy is `WITH CHECK (true)`. RLS policies only filter rows on an
-- operation a role already has the underlying SQL privilege to attempt -
-- this table was created via raw SQL without the table-level GRANTs
-- Supabase's Studio normally adds automatically, so anon/authenticated had
-- no privilege to even try an insert, regardless of the policy.
GRANT INSERT ON public.quote_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.quote_requests TO authenticated;
