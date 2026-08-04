-- ============================================================
-- Migration: Gift cards backed by wallet balance
-- ============================================================

-- ── 1. Gift card templates ──────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_card_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  image_path   TEXT,
  start_color  TEXT NOT NULL DEFAULT '#1F7A5B',
  end_color    TEXT NOT NULL DEFAULT '#0F3D2E',
  accent_color TEXT NOT NULL DEFAULT '#F4D35E',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gift_card_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read gift card templates" ON gift_card_templates;
CREATE POLICY "Authenticated users can read gift card templates"
  ON gift_card_templates FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

INSERT INTO gift_card_templates (slug, name, category, image_path, start_color, end_color, accent_color, sort_order)
VALUES
  ('golden-hour', 'Golden Hour', 'Celebration', '/gift-cards/golden-hour.jpg', '#B45309', '#7C2D12', '#FDE68A', 1),
  ('velvet-bloom', 'Velvet Bloom', 'Birthday', '/gift-cards/velvet-bloom.jpg', '#9D174D', '#4C0519', '#F9A8D4', 2),
  ('lagos-afterglow', 'Lagos Afterglow', 'Thank You', '/gift-cards/lagos-afterglow.jpg', '#0F766E', '#134E4A', '#99F6E4', 3),
  ('monarch', 'Monarch', 'Luxury', '/gift-cards/monarch.jpg', '#312E81', '#111827', '#C4B5FD', 4),
  ('soft-petals', 'Soft Petals', 'Love', '/gift-cards/soft-petals.jpg', '#BE185D', '#831843', '#FBCFE8', 5),
  ('celebration-silk', 'Celebration Silk', 'Any Occasion', '/gift-cards/celebration-silk.jpg', '#166534', '#052E16', '#BBF7D0', 6)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  image_path = EXCLUDED.image_path,
  start_color = EXCLUDED.start_color,
  end_color = EXCLUDED.end_color,
  accent_color = EXCLUDED.accent_color,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

-- ── 2. Gift cards ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaser_user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_user_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  redeemed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  template_id         UUID NOT NULL REFERENCES gift_card_templates(id) ON DELETE RESTRICT,
  code                TEXT NOT NULL UNIQUE,
  share_token         TEXT NOT NULL UNIQUE,
  amount_ngn          DECIMAL(12,2) NOT NULL CHECK (amount_ngn > 0),
  original_amount     DECIMAL(12,2) NOT NULL CHECK (original_amount > 0),
  currency            TEXT NOT NULL CHECK (currency IN ('NGN', 'GHS', 'ZAR', 'USD', 'KES')),
  recipient_name      TEXT NOT NULL,
  sender_name         TEXT NOT NULL,
  recipient_email     TEXT,
  delivery_method     TEXT NOT NULL CHECK (delivery_method IN ('link', 'email')),
  message             TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'cancelled', 'expired')),
  redeemed_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_purchaser_user_id
  ON gift_cards(purchaser_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient_user_id
  ON gift_cards(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient_email
  ON gift_cards(LOWER(recipient_email));

CREATE INDEX IF NOT EXISTS idx_gift_cards_status
  ON gift_cards(status, created_at DESC);

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read relevant gift cards" ON gift_cards;
CREATE POLICY "Users can read relevant gift cards"
  ON gift_cards FOR SELECT
  TO authenticated
  USING (
    purchaser_user_id = auth.uid()
    OR recipient_user_id = auth.uid()
    OR LOWER(COALESCE(recipient_email, '')) = LOWER(COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), ''))
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 3. Helpers ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION convert_supported_currency_to_ngn(
  p_amount NUMERIC,
  p_currency TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Gift card amount must be greater than zero.';
  END IF;

  CASE UPPER(COALESCE(p_currency, 'NGN'))
    WHEN 'NGN' THEN RETURN ROUND(p_amount::NUMERIC, 2);
    WHEN 'GHS' THEN RETURN ROUND((p_amount / 0.007)::NUMERIC, 2);
    WHEN 'ZAR' THEN RETURN ROUND((p_amount / 0.012)::NUMERIC, 2);
    WHEN 'USD' THEN RETURN ROUND((p_amount / 0.00067)::NUMERIC, 2);
    WHEN 'KES' THEN RETURN ROUND((p_amount / 0.087)::NUMERIC, 2);
    ELSE
      RAISE EXCEPTION 'Unsupported gift card currency: %', p_currency;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION generate_unique_gift_card_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  generated_code TEXT;
BEGIN
  LOOP
    generated_code := 'DWG' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 9));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM gift_cards
      WHERE code = generated_code
    );
  END LOOP;

  RETURN generated_code;
END;
$$;

CREATE OR REPLACE FUNCTION generate_unique_gift_card_share_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  generated_token TEXT;
BEGIN
  LOOP
    generated_token := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 24));

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM gift_cards
      WHERE share_token = generated_token
    );
  END LOOP;

  RETURN generated_token;
END;
$$;

-- ── 4. Create gift card ─────────────────────────────────────
CREATE OR REPLACE FUNCTION issue_gift_card(
  p_template_slug TEXT,
  p_original_amount NUMERIC,
  p_currency TEXT,
  p_recipient_name TEXT,
  p_sender_name TEXT,
  p_recipient_email TEXT DEFAULT NULL,
  p_delivery_method TEXT DEFAULT 'link',
  p_message TEXT DEFAULT NULL
)
RETURNS TABLE (
  gift_card_id UUID,
  code TEXT,
  share_token TEXT,
  amount_ngn NUMERIC,
  original_amount NUMERIC,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_template gift_card_templates%ROWTYPE;
  v_wallet_balance NUMERIC;
  v_amount_ngn NUMERIC;
  v_code TEXT;
  v_share_token TEXT;
  v_sender_name TEXT;
  v_card_id UUID;
  v_trimmed_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a gift card.';
  END IF;

  IF COALESCE(BTRIM(p_template_slug), '') = '' THEN
    RAISE EXCEPTION 'Select a gift card design.';
  END IF;

  IF COALESCE(BTRIM(p_recipient_name), '') = '' THEN
    RAISE EXCEPTION 'Recipient name is required.';
  END IF;

  IF COALESCE(BTRIM(p_sender_name), '') = '' THEN
    RAISE EXCEPTION 'Sender name is required.';
  END IF;

  IF COALESCE(BTRIM(p_delivery_method), '') NOT IN ('link', 'email') THEN
    RAISE EXCEPTION 'Choose how you want to deliver the gift card.';
  END IF;

  v_trimmed_email := LOWER(NULLIF(BTRIM(COALESCE(p_recipient_email, '')), ''));

  IF p_delivery_method = 'email' AND v_trimmed_email IS NULL THEN
    RAISE EXCEPTION 'Recipient email is required when sending by email.';
  END IF;

  SELECT *
  INTO v_template
  FROM gift_card_templates
  WHERE slug = p_template_slug
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected gift card design is unavailable.';
  END IF;

  SELECT wallet_balance, COALESCE(NULLIF(BTRIM(full_name), ''), email)
  INTO v_wallet_balance, v_sender_name
  FROM profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for gift card purchase.';
  END IF;

  v_amount_ngn := convert_supported_currency_to_ngn(p_original_amount, UPPER(p_currency));

  IF COALESCE(v_wallet_balance, 0) < v_amount_ngn THEN
    RAISE EXCEPTION 'Insufficient wallet balance for this gift card.';
  END IF;

  v_code := generate_unique_gift_card_code();
  v_share_token := generate_unique_gift_card_share_token();

  UPDATE profiles
  SET wallet_balance = wallet_balance - v_amount_ngn
  WHERE id = v_uid;

  INSERT INTO gift_cards (
    purchaser_user_id,
    template_id,
    code,
    share_token,
    amount_ngn,
    original_amount,
    currency,
    recipient_name,
    sender_name,
    recipient_email,
    delivery_method,
    message
  )
  VALUES (
    v_uid,
    v_template.id,
    v_code,
    v_share_token,
    v_amount_ngn,
    ROUND(p_original_amount::NUMERIC, 2),
    UPPER(p_currency),
    BTRIM(p_recipient_name),
    BTRIM(COALESCE(p_sender_name, v_sender_name)),
    v_trimmed_email,
    p_delivery_method,
    NULLIF(BTRIM(COALESCE(p_message, '')), '')
  )
  RETURNING id
  INTO v_card_id;

  INSERT INTO transactions (
    user_id,
    type,
    amount,
    currency,
    original_amount,
    description,
    reference,
    status,
    payment_provider
  )
  VALUES (
    v_uid,
    'debit',
    v_amount_ngn,
    UPPER(p_currency),
    ROUND(p_original_amount::NUMERIC, 2),
    'Gift card purchase',
    v_code,
    'completed',
    'gift_card'
  );

  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    v_uid,
    'Gift card created',
    'Your gift card is ready to share.',
    'system',
    jsonb_build_object(
      'kind', 'gift_card_created',
      'gift_card_id', v_card_id,
      'gift_card_code', v_code,
      'share_token', v_share_token
    )
  );

  RETURN QUERY
  SELECT
    v_card_id,
    v_code,
    v_share_token,
    v_amount_ngn,
    ROUND(p_original_amount::NUMERIC, 2),
    UPPER(p_currency);
END;
$$;

-- ── 5. Gift card preview ────────────────────────────────────
CREATE OR REPLACE FUNCTION get_gift_card_preview(
  p_identifier TEXT
)
RETURNS TABLE (
  gift_card_id UUID,
  code TEXT,
  share_token TEXT,
  template_slug TEXT,
  template_name TEXT,
  category TEXT,
  image_path TEXT,
  start_color TEXT,
  end_color TEXT,
  accent_color TEXT,
  recipient_name TEXT,
  sender_name TEXT,
  recipient_email TEXT,
  message TEXT,
  status TEXT,
  original_amount NUMERIC,
  amount_ngn NUMERIC,
  currency TEXT,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to view this gift card.';
  END IF;

  SELECT email
  INTO v_user_email
  FROM profiles
  WHERE id = v_uid;

  RETURN QUERY
  SELECT
    gc.id,
    gc.code,
    gc.share_token,
    gct.slug,
    gct.name,
    gct.category,
    gct.image_path,
    gct.start_color,
    gct.end_color,
    gct.accent_color,
    gc.recipient_name,
    gc.sender_name,
    gc.recipient_email,
    gc.message,
    gc.status,
    gc.original_amount,
    gc.amount_ngn,
    gc.currency,
    gc.redeemed_at,
    gc.created_at
  FROM gift_cards gc
  JOIN gift_card_templates gct ON gct.id = gc.template_id
  WHERE (
      UPPER(gc.code) = UPPER(COALESCE(p_identifier, ''))
      OR gc.share_token = UPPER(COALESCE(p_identifier, ''))
    )
    AND (
      gc.status = 'active'
      OR gc.purchaser_user_id = v_uid
      OR gc.recipient_user_id = v_uid
      OR LOWER(COALESCE(gc.recipient_email, '')) = LOWER(COALESCE(v_user_email, ''))
    )
  LIMIT 1;
END;
$$;

-- ── 6. Redeem gift card ─────────────────────────────────────
CREATE OR REPLACE FUNCTION redeem_gift_card(
  p_identifier TEXT
)
RETURNS TABLE (
  gift_card_id UUID,
  code TEXT,
  amount_ngn NUMERIC,
  original_amount NUMERIC,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_email TEXT;
  v_card gift_cards%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to redeem a gift card.';
  END IF;

  SELECT email
  INTO v_user_email
  FROM profiles
  WHERE id = v_uid;

  SELECT *
  INTO v_card
  FROM gift_cards
  WHERE (
      UPPER(gift_cards.code) = UPPER(COALESCE(p_identifier, ''))
      OR gift_cards.share_token = UPPER(COALESCE(p_identifier, ''))
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift card not found.';
  END IF;

  IF v_card.status = 'redeemed' THEN
    RAISE EXCEPTION 'This gift card has already been redeemed.';
  END IF;

  IF v_card.status <> 'active' THEN
    RAISE EXCEPTION 'This gift card is unavailable.';
  END IF;

  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < NOW() THEN
    UPDATE gift_cards
    SET status = 'expired'
    WHERE id = v_card.id;

    RAISE EXCEPTION 'This gift card has expired.';
  END IF;

  IF v_card.recipient_email IS NOT NULL
     AND LOWER(v_card.recipient_email) <> LOWER(COALESCE(v_user_email, ''))
     AND v_card.purchaser_user_id <> v_uid THEN
    RAISE EXCEPTION 'This gift card was sent to a different email address.';
  END IF;

  UPDATE profiles
  SET wallet_balance = wallet_balance + v_card.amount_ngn
  WHERE id = v_uid;

  UPDATE gift_cards
  SET
    status = 'redeemed',
    redeemed_at = NOW(),
    redeemed_by_user_id = v_uid,
    recipient_user_id = COALESCE(recipient_user_id, v_uid)
  WHERE id = v_card.id;

  INSERT INTO transactions (
    user_id,
    type,
    amount,
    currency,
    original_amount,
    description,
    reference,
    status,
    payment_provider
  )
  VALUES (
    v_uid,
    'credit',
    v_card.amount_ngn,
    v_card.currency,
    v_card.original_amount,
    'Gift card redemption',
    v_card.code,
    'completed',
    'gift_card'
  );

  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    v_uid,
    'Gift card redeemed',
    'Your wallet has been credited from a gift card.',
    'system',
    jsonb_build_object(
      'kind', 'gift_card_redeemed',
      'gift_card_id', v_card.id,
      'gift_card_code', v_card.code,
      'amount_ngn', v_card.amount_ngn
    )
  );

  INSERT INTO notifications (user_id, title, message, type, data)
  VALUES (
    v_card.purchaser_user_id,
    'Gift card redeemed',
    COALESCE(v_card.recipient_name, 'Your recipient') || ' redeemed your gift card.',
    'system',
    jsonb_build_object(
      'kind', 'gift_card_redeemed_by_recipient',
      'gift_card_id', v_card.id,
      'gift_card_code', v_card.code,
      'redeemed_by_user_id', v_uid
    )
  );

  RETURN QUERY
  SELECT
    v_card.id,
    v_card.code,
    v_card.amount_ngn,
    v_card.original_amount,
    v_card.currency;
END;
$$;
