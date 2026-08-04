-- ============================================================
-- Migration: Points/Rewards, VTpass Bill Payments, Pay-for-Me Links
-- Run this in Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Add points_balance to profiles ───────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS points_balance INTEGER NOT NULL DEFAULT 0;

-- ── 2. points_transactions table ────────────────────────────
CREATE TABLE IF NOT EXISTS points_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('earned', 'spent')),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  reference   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id
  ON points_transactions(user_id);

-- RLS
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own points_transactions"
  ON points_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own points_transactions"
  ON points_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 3. RPC: increment_points(uid, delta) ────────────────────
-- Safely increments (or decrements with negative delta) points_balance.
CREATE OR REPLACE FUNCTION increment_points(uid UUID, delta INTEGER)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE profiles
  SET points_balance = GREATEST(0, points_balance + delta)
  WHERE id = uid;
$$;

-- ── 4. payment_links table (Pay-for-me) ─────────────────────
CREATE TABLE IF NOT EXISTS payment_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  items           JSONB NOT NULL DEFAULT '[]',
  amount_ngn      NUMERIC(12,2) NOT NULL,
  subtotal_ngn    NUMERIC(12,2) NOT NULL DEFAULT 0,
  promo_code      TEXT,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  requester_name  TEXT,
  payer_email     TEXT,
  paystack_ref    TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_token
  ON payment_links(token);

CREATE INDEX IF NOT EXISTS idx_payment_links_user_id
  ON payment_links(user_id);

-- RLS
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payment_links"
  ON payment_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment_links"
  ON payment_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment_links"
  ON payment_links FOR UPDATE
  USING (auth.uid() = user_id);

-- Public SELECT on token (for the web payment page)
CREATE POLICY "Anyone can read payment_link by token"
  ON payment_links FOR SELECT
  USING (true);  -- restrict further in your API if needed

-- ── 5. vtpass_transactions table ────────────────────────────
CREATE TABLE IF NOT EXISTS vtpass_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_type      TEXT NOT NULL CHECK (service_type IN ('airtime', 'electricity', 'data', 'cable')),
  service_provider  TEXT NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  payment_source    TEXT NOT NULL CHECK (payment_source IN ('points', 'wallet')),
  points_used       INTEGER NOT NULL DEFAULT 0,
  vtpass_reference  TEXT NOT NULL UNIQUE,
  vtpass_response   JSONB,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'success', 'failed')),
  beneficiary       TEXT,   -- phone number or meter number
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vtpass_transactions_user_id
  ON vtpass_transactions(user_id);

-- RLS
ALTER TABLE vtpass_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vtpass_transactions"
  ON vtpass_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vtpass_transactions"
  ON vtpass_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 6. Award points when a review is inserted ───────────────
-- This trigger fires whenever a new review is added and awards 1 point.
CREATE OR REPLACE FUNCTION award_review_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add 1 point to the reviewer
  PERFORM increment_points(NEW.user_id, 1);

  -- Insert a points_transaction record
  INSERT INTO points_transactions (user_id, type, amount, description, reference)
  VALUES (NEW.user_id, 'earned', 1, 'Review reward', NEW.id::TEXT);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_review_points ON reviews;
CREATE TRIGGER trg_award_review_points
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION award_review_points();

-- ── 7. Auto-expire payment_links older than their expiry ─────
-- Optional: run a scheduled job or cron to call this function.
CREATE OR REPLACE FUNCTION expire_payment_links()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE payment_links
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
$$;
