\set QUIET on
\pset tuples_only on
\set C '''11111111-1111-1111-1111-111111111111'''
\set A '''22222222-2222-2222-2222-222222222222'''

INSERT INTO profiles (id, email, role, wallet_balance, points_balance, referral_code) VALUES
  (:C, 'c@x.com', 'customer', 1000, 10, 'CCC'),
  (:A, 'a@x.com', 'admin', 0, 0, 'AAA');
INSERT INTO products VALUES ('33333333-3333-3333-3333-333333333333', 'Tee', 300, 2);
INSERT INTO custom_requests VALUES ('44444444-4444-4444-4444-444444444444', :C, 'Jersey', 'quoted');
INSERT INTO invoices (id, custom_request_id, user_id, amount, description) VALUES
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', :C, 500, 'inv');
INSERT INTO orders (id, user_id, total, payment_status, order_status) VALUES
  ('66666666-6666-6666-6666-666666666666', :C, 5000, 'pending_payment', 'pending_payment');
INSERT INTO payment_links (token, order_id, user_id, amount_ngn, status, requester_name, items)
  VALUES ('tok123', '66666666-6666-6666-6666-666666666666', :C, 5000, 'pending', 'Ada', '[]');

CREATE FUNCTION pg_temp.check(name text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN RAISE NOTICE '% %', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, name; END $$;

-- Runs sql as a PostgREST request from role/uid and reports whether it raised.
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
GRANT EXECUTE ON FUNCTION pg_temp.attempt(text, text, text) TO PUBLIC;

BEGIN;
-- 1. Customer can't self-promote or edit balances (silently reverted)
SELECT pg_temp.attempt('authenticated', :C, $q$UPDATE profiles SET role='admin', wallet_balance=9999999, points_balance=99999, full_name='Ada' WHERE id='11111111-1111-1111-1111-111111111111'$q$);
SELECT pg_temp.check('customer self-update reverted role/balances, kept full_name',
  (SELECT role='customer' AND wallet_balance=1000 AND points_balance=10 AND full_name='Ada' FROM profiles WHERE id=:C));

-- 2. Customer can't insert orders (paid or otherwise)
SELECT pg_temp.check('customer order insert blocked',
  pg_temp.attempt('authenticated', :C, $q$INSERT INTO orders (user_id,total,payment_status) VALUES ('11111111-1111-1111-1111-111111111111',1,'paid')$q$) LIKE 'error:%Orders must be placed%');

-- 3. Customer / anon can't flip orders to paid
SELECT pg_temp.attempt('authenticated', :C, $q$UPDATE orders SET payment_status='paid' WHERE id='66666666-6666-6666-6666-666666666666'$q$);
SELECT pg_temp.check('customer order update had no effect',
  (SELECT payment_status FROM orders WHERE id='66666666-6666-6666-6666-666666666666') = 'pending_payment');
SELECT pg_temp.attempt('anon', NULL, $q$UPDATE orders SET payment_status='paid', order_status='in_review' WHERE payment_status='pending_payment'$q$);
SELECT pg_temp.check('anon mass mark-paid had no effect',
  (SELECT payment_status FROM orders WHERE id='66666666-6666-6666-6666-666666666666') = 'pending_payment');

-- 4. Payment links: no table read/update for anon; RPC returns the one link
SELECT pg_temp.attempt('anon', NULL, $q$UPDATE payment_links SET status='paid'$q$);
SELECT pg_temp.check('anon payment_link update had no effect', (SELECT status FROM payment_links WHERE token='tok123')='pending');
SELECT pg_temp.check('anon cannot list payment_links',
  pg_temp.attempt('anon', NULL, $q$DO $d$ BEGIN IF (SELECT count(*) FROM payment_links) > 0 THEN RAISE EXCEPTION 'leak'; END IF; END $d$$q$) = 'ok');
SELECT pg_temp.check('anon get_payment_link works',
  pg_temp.attempt('anon', NULL, $q$DO $d$ BEGIN IF (SELECT public.get_payment_link('tok123')->>'requester_name') IS DISTINCT FROM 'Ada' THEN RAISE EXCEPTION 'missing'; END IF; END $d$$q$) = 'ok');

-- 5. Money RPCs
SELECT pg_temp.check('customer fund_wallet denied',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.fund_wallet('11111111-1111-1111-1111-111111111111', 100000)$q$) LIKE 'error:%permission denied%');
SELECT pg_temp.check('customer deduct_wallet denied',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.deduct_wallet('11111111-1111-1111-1111-111111111111', -50000)$q$) LIKE 'error:%permission denied%');
SELECT pg_temp.check('customer increment_points denied',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.increment_points('11111111-1111-1111-1111-111111111111', 1000)$q$) LIKE 'error:%permission denied%');
SELECT pg_temp.check('customer credit_wallet denied',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.credit_wallet('11111111-1111-1111-1111-111111111111', 1000000, 'x', null)$q$) LIKE 'error:%Not allowed%');
SELECT pg_temp.check('anon credit_wallet denied',
  pg_temp.attempt('anon', NULL, $q$SELECT public.credit_wallet('11111111-1111-1111-1111-111111111111', 1000000, 'x', null)$q$) LIKE 'error:%Not allowed%');
SELECT pg_temp.check('admin credit_wallet allowed',
  pg_temp.attempt('authenticated', :A, $q$SELECT public.credit_wallet('11111111-1111-1111-1111-111111111111', 1000, 'late delivery', null)$q$) = 'ok');
SELECT pg_temp.check('admin credit landed once (legacy trigger gone)', (SELECT wallet_balance FROM profiles WHERE id=:C) = 2000);
SELECT pg_temp.check('service deduct_wallet negative rejected',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.deduct_wallet('11111111-1111-1111-1111-111111111111', -5)$q$) LIKE 'error:%positive%');
SELECT pg_temp.check('customer refund_order_to_wallet denied',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.refund_order_to_wallet('66666666-6666-6666-6666-666666666666')$q$) LIKE 'error:%Not allowed%');

-- 6. Ledgers
SELECT pg_temp.check('customer transactions insert blocked',
  pg_temp.attempt('authenticated', :C, $q$INSERT INTO transactions (user_id,type,amount,status) VALUES ('11111111-1111-1111-1111-111111111111','credit',5,'completed')$q$) LIKE 'error:%');

-- 7. Wallet checkout (service role, as place-order calls it)
SELECT pg_temp.check('place_wallet_order insufficient balance raises',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.place_wallet_order('{"user_id":"11111111-1111-1111-1111-111111111111","total":999999,"items":[]}')$q$) LIKE 'error:%insufficient_wallet_balance%');
SELECT pg_temp.check('place_wallet_order sold out rolls back debit',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.place_wallet_order('{"user_id":"11111111-1111-1111-1111-111111111111","total":900,"items":[{"product_id":"33333333-3333-3333-3333-333333333333","name":"Tee","quantity":3}]}')$q$) LIKE 'error:%Insufficient stock%'
  AND (SELECT wallet_balance FROM profiles WHERE id=:C) = 2000);
SELECT pg_temp.check('place_wallet_order returned ok',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.place_wallet_order('{"user_id":"11111111-1111-1111-1111-111111111111","total":600,"subtotal":600,"items":[{"product_id":"33333333-3333-3333-3333-333333333333","name":"Tee","quantity":2}]}')$q$) = 'ok');
SELECT pg_temp.check('place_wallet_order debited, paid order + ledger written', (SELECT wallet_balance FROM profiles WHERE id=:C) = 1400
  AND (SELECT count(*) FROM orders WHERE user_id=:C AND payment_status='paid' AND payment_method='wallet') = 1
  AND (SELECT count(*) FROM transactions WHERE user_id=:C AND type='debit' AND amount=600) = 1);
SELECT pg_temp.check('customer cannot call place_wallet_order',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.place_wallet_order('{"user_id":"11111111-1111-1111-1111-111111111111","total":1}')$q$) LIKE 'error:%permission denied%');

-- 8. Wallet funding idempotency
SELECT pg_temp.attempt('service_role', NULL, $q$SELECT public.credit_wallet_from_paystack('11111111-1111-1111-1111-111111111111', 500, 'ref_A')$q$);
SELECT pg_temp.attempt('service_role', NULL, $q$SELECT public.credit_wallet_from_paystack('11111111-1111-1111-1111-111111111111', 500, 'ref_A')$q$);
SELECT pg_temp.check('wallet funding credited exactly once', (SELECT wallet_balance FROM profiles WHERE id=:C) = 1900);

-- 9. Invoices: accept ok, mark paid blocked, server settle works once
SELECT pg_temp.check('customer accept invoice runs',
  pg_temp.attempt('authenticated', :C, $q$UPDATE invoices SET status='accepted' WHERE id='55555555-5555-5555-5555-555555555555'$q$) = 'ok');
SELECT pg_temp.check('customer accept invoice applied',
  (SELECT status FROM invoices WHERE id='55555555-5555-5555-5555-555555555555') = 'accepted');
SELECT pg_temp.check('customer cannot mark invoice paid',
  pg_temp.attempt('authenticated', :C, $q$UPDATE invoices SET status='paid' WHERE id='55555555-5555-5555-5555-555555555555'$q$) LIKE 'error:%');
SELECT pg_temp.check('customer cannot set custom request payment_made',
  pg_temp.attempt('authenticated', :C, $q$UPDATE custom_requests SET status='payment_made' WHERE id='44444444-4444-4444-4444-444444444444'$q$) LIKE 'error:%');
SELECT pg_temp.attempt('service_role', NULL, $q$SELECT public.settle_invoice_payment('55555555-5555-5555-5555-555555555555', 'wallet')$q$);
SELECT pg_temp.attempt('service_role', NULL, $q$SELECT public.settle_invoice_payment('55555555-5555-5555-5555-555555555555', 'wallet')$q$);
SELECT pg_temp.check('invoice settled once from wallet',
  (SELECT wallet_balance FROM profiles WHERE id=:C) = 1400
  AND (SELECT status FROM invoices WHERE id='55555555-5555-5555-5555-555555555555') = 'paid'
  AND (SELECT status FROM custom_requests WHERE id='44444444-4444-4444-4444-444444444444') = 'payment_made');
INSERT INTO invoices (id, custom_request_id, user_id, amount, description) VALUES
  ('55555555-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', :C, 500, 'inv2');
SELECT pg_temp.check('paystack reference already used for wallet funding rejected for invoice',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.settle_invoice_payment('55555555-0000-0000-0000-000000000002', 'paystack', 'ref_A')$q$) LIKE 'error:%already been used%');

-- 11. Unsettleable card / Pay for Me charge: refunded atomically, once, no phantom stock
INSERT INTO orders (id, user_id, total, payment_status, order_status, items) VALUES
  ('88888888-0000-0000-0000-000000000001', :C, 700, 'pending_payment', 'pending_payment', '[{"product_id":"33333333-3333-3333-3333-333333333333","quantity":1}]'),
  ('88888888-0000-0000-0000-000000000002', :C, 800, 'pending_payment', 'pending_payment', '[{"product_id":"33333333-3333-3333-3333-333333333333","quantity":1}]');
INSERT INTO payment_links (token, order_id, user_id, amount_ngn, status, requester_name, items)
  VALUES ('tokR2', '88888888-0000-0000-0000-000000000002', :C, 800, 'pending', 'Ada', '[]');
SELECT pg_temp.attempt('service_role', NULL, $q$SELECT public.refund_unsettleable_payment('88888888-0000-0000-0000-000000000001', 'ref_R1', 'item sold out')$q$);
SELECT pg_temp.attempt('service_role', NULL, $q$SELECT public.refund_unsettleable_payment('88888888-0000-0000-0000-000000000001', 'ref_R1', 'item sold out')$q$);
SELECT pg_temp.check('sold-out card refund credited exactly once',
  (SELECT wallet_balance FROM profiles WHERE id=:C) = 2100
  AND (SELECT count(*) FROM transactions WHERE reference='ref_R1') = 1);
SELECT pg_temp.check('sold-out card order marked refunded/cancelled with reference',
  (SELECT payment_status='refunded' AND order_status='cancelled' AND paystack_reference='ref_R1' FROM orders WHERE id='88888888-0000-0000-0000-000000000001'));
SELECT pg_temp.check('refunding a never-paid order does not restore stock', (SELECT stock FROM products) = 0);
SELECT pg_temp.attempt('service_role', NULL, $q$SELECT public.refund_unsettleable_payment('88888888-0000-0000-0000-000000000002', 'ref_R2', 'item sold out', 'tokR2', 'payer@x.com')$q$);
SELECT pg_temp.check('pay-link refund credits requester and closes link',
  (SELECT wallet_balance FROM profiles WHERE id=:C) = 2900
  AND (SELECT status='paid' AND paystack_ref='ref_R2' FROM payment_links WHERE token='tokR2'));
SELECT pg_temp.check('customer cannot call refund_unsettleable_payment',
  pg_temp.attempt('authenticated', :C, $q$SELECT public.refund_unsettleable_payment('88888888-0000-0000-0000-000000000001', 'x', 'y')$q$) LIKE 'error:%permission denied%');

-- 12. Admin refund of a PAID order still restores its stock
SELECT pg_temp.check('admin refund of paid wallet order allowed',
  pg_temp.attempt('authenticated', :A, $q$SELECT public.refund_order_to_wallet((SELECT id FROM orders WHERE payment_method='wallet' LIMIT 1))$q$) = 'ok');
SELECT pg_temp.check('admin refund of paid order restored stock', (SELECT stock FROM products) = 2);

-- 13. Promo limits enforced at payment time
UPDATE products SET stock = 100;
INSERT INTO promo_codes (id, code, max_usage, used_count, first_time_only) VALUES
  ('99999999-0000-0000-0000-000000000001', 'ONCE', NULL, 0, false),
  ('99999999-0000-0000-0000-000000000002', 'FULL', 1, 1, false);
SELECT pg_temp.check('first wallet order with promo succeeds',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.place_wallet_order('{"user_id":"11111111-1111-1111-1111-111111111111","total":100,"promo_code_id":"99999999-0000-0000-0000-000000000001","items":[]}')$q$) = 'ok');
SELECT pg_temp.check('second wallet order with same promo blocked',
  pg_temp.attempt('service_role', NULL, $q$SELECT public.place_wallet_order('{"user_id":"11111111-1111-1111-1111-111111111111","total":100,"promo_code_id":"99999999-0000-0000-0000-000000000001","items":[]}')$q$) LIKE 'error:%promo_unavailable%');
SELECT pg_temp.check('blocked promo wallet order did not debit', (SELECT wallet_balance FROM profiles WHERE id=:C) = 3400);
INSERT INTO orders (id, user_id, total, payment_status, order_status, items, promo_code_id) VALUES
  ('88888888-0000-0000-0000-000000000003', :C, 100, 'pending_payment', 'pending_payment', '[]', '99999999-0000-0000-0000-000000000001'),
  ('88888888-0000-0000-0000-000000000004', :C, 100, 'pending_payment', 'pending_payment', '[]', '99999999-0000-0000-0000-000000000002');
SELECT pg_temp.check('second pending order with used promo cannot be settled',
  pg_temp.attempt('service_role', NULL, $q$UPDATE orders SET payment_status='paid' WHERE id='88888888-0000-0000-0000-000000000003'$q$) LIKE 'error:%promo_unavailable%');
SELECT pg_temp.check('promo at max_usage cannot be settled',
  pg_temp.attempt('service_role', NULL, $q$UPDATE orders SET payment_status='paid' WHERE id='88888888-0000-0000-0000-000000000004'$q$) LIKE 'error:%usage limit%');
SELECT pg_temp.check('admin can still confirm promo order by hand',
  pg_temp.attempt('authenticated', :A, $q$UPDATE orders SET payment_status='paid' WHERE id='88888888-0000-0000-0000-000000000004'$q$) = 'ok');

-- 10. Admin still updates orders; signup gives customer role
SELECT pg_temp.check('admin order update runs',
  pg_temp.attempt('authenticated', :A, $q$UPDATE orders SET order_status='shipped' WHERE id='66666666-6666-6666-6666-666666666666'$q$) = 'ok');
SELECT pg_temp.check('admin order update applied',
  (SELECT order_status FROM orders WHERE id='66666666-6666-6666-6666-666666666666') = 'shipped');
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO auth.users (id, email) VALUES ('77777777-7777-7777-7777-777777777777', 'admin@dritchwear.com');
SELECT pg_temp.check('signup with old admin email gets customer role',
  (SELECT role FROM profiles WHERE id='77777777-7777-7777-7777-777777777777') = 'customer');
ROLLBACK;
