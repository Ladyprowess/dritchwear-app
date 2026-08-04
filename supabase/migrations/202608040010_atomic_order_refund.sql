-- handleRefund() previously did 3 separate client-side writes (credit
-- wallet_balance using a value read earlier on-screen, insert a transaction
-- row, then flip payment_status to 'refunded'). Two real bugs from that:
--   1. If step 2 or 3 failed after step 1 succeeded, the customer's wallet
--      was already credited but payment_status still read 'paid' - so
--      admin's cancel attempt shows an error and retrying calls handleRefund
--      again, crediting the wallet a SECOND time.
--   2. wallet_balance was computed as (value read when the screen loaded) +
--      total, not the live balance - anything else touching that wallet in
--      between (a bill payment, another refund) gets silently overwritten.
-- One atomic function closes both: single transaction, all-or-nothing, and
-- the balance update is a real increment, not an overwrite.
CREATE OR REPLACE FUNCTION refund_order_to_wallet(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_total numeric;
  v_payment_status text;
BEGIN
  SELECT user_id, total, payment_status INTO v_user_id, v_total, v_payment_status
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  -- Idempotent: if it's already refunded (e.g. a retry after a UI hiccup on
  -- a call that actually succeeded), do nothing rather than double-credit.
  IF v_payment_status IS DISTINCT FROM 'paid' THEN
    RETURN FALSE;
  END IF;

  UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + v_total WHERE id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, description, reference, status)
  VALUES (v_user_id, 'credit', v_total, 'Refund for cancelled order #' || substring(p_order_id::text, 1, 8), p_order_id::text, 'completed');

  UPDATE orders SET payment_status = 'refunded' WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;
