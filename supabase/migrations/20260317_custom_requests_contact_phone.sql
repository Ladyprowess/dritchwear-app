-- Migration: Add contact_phone to custom_requests and backfill from profiles

ALTER TABLE custom_requests
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

UPDATE custom_requests cr
SET contact_phone = p.phone
FROM profiles p
WHERE cr.user_id = p.id
  AND cr.contact_phone IS NULL
  AND p.phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_custom_requests_contact_phone
  ON custom_requests (contact_phone)
  WHERE contact_phone IS NOT NULL;
