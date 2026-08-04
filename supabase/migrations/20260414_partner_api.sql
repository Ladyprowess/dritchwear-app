-- Partner API support
-- Adds partner_api_keys table and ensures orders has the columns the Edge Function writes to.

-- ── orders: add columns if not present ────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS notes           text,
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS contact_phone   text;

-- ── partner_api_keys ──────────────────────────────────────────────────────────
-- Stores one row per integration partner. The actual secret lives in Supabase
-- Vault / Edge Function secrets as PARTNER_API_KEY. This table is for tracking
-- and auditing purposes (who is integrated, when was the key last used, etc.).
CREATE TABLE IF NOT EXISTS partner_api_keys (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text        NOT NULL,
  key_hint     text        NOT NULL,          -- last 6 chars of the key (for display only)
  is_active    boolean     NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Only admins can read / write this table
ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage partner keys"
  ON partner_api_keys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
