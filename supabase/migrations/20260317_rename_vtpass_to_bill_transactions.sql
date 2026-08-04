-- ============================================================
-- Migration: Ensure bill_transactions exists with correct setup
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Rename vtpass_transactions → bill_transactions only if needed ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vtpass_transactions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bill_transactions'
  ) THEN
    ALTER TABLE vtpass_transactions RENAME TO bill_transactions;
  END IF;
END $$;

-- ── 2. Rename the index (safe) ────────────────────────────────
ALTER INDEX IF EXISTS idx_vtpass_transactions_user_id
  RENAME TO idx_bill_transactions_user_id;

-- ── 3. Rename the constraint (safe) ──────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'bill_transactions'
      AND constraint_name = 'vtpass_transactions_payment_source_check'
  ) THEN
    ALTER TABLE bill_transactions
      RENAME CONSTRAINT vtpass_transactions_payment_source_check
      TO bill_transactions_payment_source_check;
  END IF;
END $$;

-- ── 4. Create bill_transactions if it still doesn't exist ─────
CREATE TABLE IF NOT EXISTS bill_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_type     text NOT NULL CHECK (service_type IN ('airtime','data','electricity','cable')),
  service_provider text NOT NULL,
  amount           numeric(12,2) NOT NULL,
  payment_source   text NOT NULL CHECK (payment_source IN ('points','wallet','mixed')),
  points_used      integer NOT NULL DEFAULT 0,
  vtpass_reference text UNIQUE,
  vtpass_response  jsonb,
  status           text NOT NULL DEFAULT 'pending',
  beneficiary      text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_transactions_user_id
  ON bill_transactions(user_id);

-- ── 5. Enable RLS ─────────────────────────────────────────────
ALTER TABLE bill_transactions ENABLE ROW LEVEL SECURITY;

-- ── 6. Drop old/duplicate policies and recreate cleanly ──────
DROP POLICY IF EXISTS "Users can read own vtpass_transactions"      ON bill_transactions;
DROP POLICY IF EXISTS "Users can insert own vtpass_transactions"    ON bill_transactions;
DROP POLICY IF EXISTS "Admin can read all vtpass_transactions"      ON bill_transactions;
DROP POLICY IF EXISTS "Service role can manage vtpass_transactions" ON bill_transactions;
DROP POLICY IF EXISTS "Users can read own bill_transactions"        ON bill_transactions;
DROP POLICY IF EXISTS "Users can insert own bill_transactions"      ON bill_transactions;
DROP POLICY IF EXISTS "Admin can read all bill_transactions"        ON bill_transactions;

CREATE POLICY "Users can read own bill_transactions"
  ON bill_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bill_transactions"
  ON bill_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can read all bill_transactions"
  ON bill_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
