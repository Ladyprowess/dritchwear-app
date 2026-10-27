-- State between deploy steps: ONLY 202610270001 applied. The currently
-- shipped app must keep working (it still writes orders/wallet directly),
-- and the new edge functions' RPCs must already be available.
\set QUIET on
\pset tuples_only on
\set C '''11111111-1111-1111-1111-111111111111'''

INSERT INTO profiles (id, email, role, wallet_balance, referral_code) VALUES (:C, 'c@x.com', 'customer', 1000, 'CCC');
INSERT INTO orders (id, user_id, total, payment_status, order_status) VALUES
  ('66666666-6666-6666-6666-666666666666', :C, 5000, 'pending_payment', 'pending_payment');
INSERT INTO payment_links (token, order_id, user_id, amount_ngn, status, requester_name, items)
  VALUES ('tok123', '66666666-6666-6666-6666-666666666666', :C, 5000, 'pending', 'Ada', '[]');

CREATE FUNCTION pg_temp.check(name text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, name; END $$;

CREATE FUNCTION pg_temp.attempt(role text, uid text, sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(uid, ''), true);
  PERFORM set_config('request.jwt.claim.role', role, true);
  EXECUTE format('SET LOCAL ROLE %I', role);
  BEGIN
    EXECUTE sql;
    RESET ROLE;
    RETURN 'ok';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN 'error: ' || SQLERRM;
  END;
END $$;

BEGIN;
-- Current app paths still work
SELECT pg_temp.check('current app: customer can still create an order',
  pg_temp.attempt('authenticated', :C, $q$INSERT INTO orders (user_id,total,payment_status,order_status) VALUES ('11111111-1111-1111-1111-111111111111',100,'pending_payment','pending_payment')$q$) = 'ok');
SELECT pg_temp.check('current app: customer can still read payment link by table',
  pg_temp.attempt('anon', NULL, $q$DO $d$ BEGIN IF (SELECT count(*) FROM payment_links) = 0 THEN RAISE EXCEPTION 'no rows'; END IF; END $d$$q$) = 'ok');
SELECT pg_temp.check('current app: fund_wallet still callable',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.fund_wallet('11111111-1111-1111-1111-111111111111', 1)$q$) = 'ok');

-- New app / edge function paths already work
SELECT pg_temp.check('new app: get_payment_link available',
  pg_temp.attempt('anon', NULL, $q$DO $d$ BEGIN IF public.get_payment_link('tok123') IS NULL THEN RAISE EXCEPTION 'missing'; END IF; END $d$$q$) = 'ok');
SELECT pg_temp.check('new functions: place_wallet_order available to service_role',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.place_wallet_order('{"user_id":"11111111-1111-1111-1111-111111111111","total":100,"items":[]}')$q$) = 'ok');
SELECT pg_temp.check('new functions: credit_wallet_from_paystack available to service_role',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.credit_wallet_from_paystack('11111111-1111-1111-1111-111111111111', 100, 'ref_X')$q$) = 'ok');
SELECT pg_temp.check('legacy wallet trigger already gone after part 1 (credits land once)',
  -- 1000 + 1 (fund_wallet) - 100 (wallet order) + 100 (top-up), each applied once
  (SELECT wallet_balance FROM profiles WHERE id=:C) = 1001
  AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wallet_on_transaction'));
SELECT pg_temp.check('new functions: still not callable by customers',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.credit_wallet_from_paystack('11111111-1111-1111-1111-111111111111', 100, 'ref_Y')$q$) LIKE 'error:%permission denied%');
ROLLBACK;
