-- needed_by was typed DATE, but the /corporate form's field is free text
-- (placeholder example: "December 2026") - any non-ISO input, which is the
-- normal case, made every submission fail outright with a Postgres date
-- parse error. Store it as plain text instead.
ALTER TABLE public.quote_requests
  ALTER COLUMN needed_by TYPE TEXT USING needed_by::TEXT;
