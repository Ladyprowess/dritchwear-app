-- ============================================================
-- Migration: Phase 2 - Pay-for-Me, Bill Payments, Currency,
--            Reviews, Rewards, Wallet RPCs
-- Run AFTER: 20250626201942_fragrant_grass.sql
--            20260315_points_bills_paylinks.sql
-- ============================================================

-- ── 1. profiles: preferred_currency ─────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'NGN'
    CHECK (preferred_currency IN ('NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR'));

-- ── 2. orders: extra columns needed by checkout ──────────────

-- Delivery fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_state   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_country TEXT;

-- Multi-currency support
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS currency         TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS original_amount  DECIMAL(12,2);

-- Promo code string (separate from FK)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code TEXT;

-- ── 3. orders: extend payment_method constraint ───────────────
-- Adds 'pay_link' (Pay-for-Me) and other provider names.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('wallet', 'paystack', 'pay_link', 'card', 'bank_transfer'));

-- ── 4. orders: extend payment_status constraint ───────────────
-- Adds 'pending_payment' (order created, awaiting external payment).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending', 'pending_payment', 'paid', 'failed', 'refunded'));

-- ── 5. orders: extend order_status constraint ────────────────
-- Adds 'pending_payment' and 'in_review'.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_order_status_check
    CHECK (order_status IN (
      'pending', 'pending_payment', 'in_review',
      'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
    ));

-- ── 6. orders: allow authenticated users to update own orders ─
-- Needed so in-app Pay-for-Me success can mark order paid.
DROP POLICY IF EXISTS "Users can update own order payment status" ON orders;
CREATE POLICY "Users can update own order payment status"
  ON orders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- ── 7. payment_links: add order_id FK ────────────────────────
ALTER TABLE payment_links
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_links_order_id
  ON payment_links(order_id);

-- ── 8. payment_links: allow anon to mark as paid ─────────────
-- The web payment page (Edge Function) calls Supabase REST with
-- the anon key from the browser to flip status → 'paid'.
DROP POLICY IF EXISTS "Anon can mark payment_link paid by token" ON payment_links;
CREATE POLICY "Anon can mark payment_link paid by token"
  ON payment_links FOR UPDATE
  TO anon
  USING  (status = 'pending')
  WITH CHECK (status = 'paid');

-- ── 9. orders: allow anon to update order status ─────────────
-- Web payment page marks linked order → in_review via anon key.
DROP POLICY IF EXISTS "Anon can update order status to in_review" ON orders;
CREATE POLICY "Anon can update order status to in_review"
  ON orders FOR UPDATE
  TO anon
  USING  (payment_status = 'pending_payment')
  WITH CHECK (
    payment_status = 'paid'
    AND order_status = 'in_review'
  );

-- ── 10. transactions: multi-currency columns ─────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS currency        TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(12,2);

-- ── 11. Wallet RPCs ───────────────────────────────────────────

-- fund_wallet: safely adds to wallet (called after Paystack success)
CREATE OR REPLACE FUNCTION fund_wallet(uid UUID, amount NUMERIC)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE profiles
  SET wallet_balance = wallet_balance + amount
  WHERE id = uid;
$$;

-- deduct_wallet: only deducts if balance is sufficient, returns success flag
CREATE OR REPLACE FUNCTION deduct_wallet(uid UUID, amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  SELECT wallet_balance INTO current_balance FROM profiles WHERE id = uid FOR UPDATE;
  IF current_balance < amount THEN
    RETURN FALSE;
  END IF;
  UPDATE profiles SET wallet_balance = wallet_balance - amount WHERE id = uid;
  RETURN TRUE;
END;
$$;

-- ── 12. reviews table ─────────────────────────────────────────
-- Required for the award_review_points trigger in migration 2.
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id    ON reviews(user_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reviews"    ON reviews;
DROP POLICY IF EXISTS "Users can insert own review" ON reviews;
DROP POLICY IF EXISTS "Users can update own review" ON reviews;

CREATE POLICY "Anyone can read reviews"
  ON reviews FOR SELECT USING (true);

CREATE POLICY "Users can insert own review"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own review"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 13. Re-attach award_review_points trigger ────────────────
-- Ensures the trigger exists now that the reviews table is created.
DROP TRIGGER IF EXISTS trg_award_review_points ON reviews;
CREATE TRIGGER trg_award_review_points
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION award_review_points();

-- ── 14. vtpass_transactions: service role insert policy ───────
-- The bill-pay Edge Function uses SERVICE_ROLE_KEY which bypasses
-- RLS automatically - no extra policy needed. Documented here for
-- clarity only.

-- ── 15. Indexes for performance ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status   ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_user_created   ON orders(user_id, created_at DESC);
