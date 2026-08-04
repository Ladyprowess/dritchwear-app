-- Fix: column reference "code" is ambiguous in redeem_gift_card
-- The RETURNS TABLE declares columns named `code` and `share_token`,
-- which conflicts with the bare column references in the WHERE clause.
-- Fix: qualify them with the table name `gift_cards.code` / `gift_cards.share_token`.

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
