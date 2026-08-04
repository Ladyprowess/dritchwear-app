-- ============================================================
-- Migration: Peyflex Bill-Pay fixes
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Fix vtpass_transactions: allow 'mixed' payment_source ─
-- The edge function saves 'mixed' when the user pays with both
-- points AND wallet. The old constraint only allowed 'points'|'wallet'.
ALTER TABLE vtpass_transactions
  DROP CONSTRAINT IF EXISTS vtpass_transactions_payment_source_check;

ALTER TABLE vtpass_transactions
  ADD CONSTRAINT vtpass_transactions_payment_source_check
    CHECK (payment_source IN ('points', 'wallet', 'mixed'));

-- ── 2. Allow service_role to insert/update vtpass_transactions ─
-- The bill-pay Edge Function uses SERVICE_ROLE_KEY which bypasses
-- RLS, but let's make it explicit for clarity.
DROP POLICY IF EXISTS "Service role can manage vtpass_transactions" ON vtpass_transactions;

-- No extra policy needed - service role bypasses RLS automatically.
-- Documented here for reference only.

-- ── 3. Admin read access on vtpass_transactions ───────────────
-- Admins query this table from the rewards dashboard.
DROP POLICY IF EXISTS "Admin can read all vtpass_transactions" ON vtpass_transactions;
CREATE POLICY "Admin can read all vtpass_transactions"
  ON vtpass_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 4. Admin read access on points_transactions ───────────────
DROP POLICY IF EXISTS "Admin can read all points_transactions" ON points_transactions;
CREATE POLICY "Admin can read all points_transactions"
  ON points_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 5. Admin read access on payment_links ────────────────────
DROP POLICY IF EXISTS "Admin can read all payment_links" ON payment_links;
CREATE POLICY "Admin can read all payment_links"
  ON payment_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
