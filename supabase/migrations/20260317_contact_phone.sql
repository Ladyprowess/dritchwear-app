-- ============================================================
-- Migration: Add contact_phone to orders
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Add contact_phone column to orders ─────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- ── 2. Index for admin lookups by phone ───────────────────
CREATE INDEX IF NOT EXISTS idx_orders_contact_phone
  ON orders (contact_phone)
  WHERE contact_phone IS NOT NULL;
