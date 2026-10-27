DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');

-- Minimal stand-in for the parts of the live Supabase schema the two
-- 202610270001/2 migrations touch. Not a copy of production.
CREATE TABLE profiles (
  id uuid PRIMARY KEY, email text, full_name text, phone text,
  role text DEFAULT 'customer', wallet_balance numeric DEFAULT 0, points_balance integer DEFAULT 0,
  referral_code text, referred_by_user_id uuid, preferred_currency text, updated_at timestamptz);
CREATE TABLE products (id uuid PRIMARY KEY, name text, price numeric, stock integer DEFAULT 100, updated_at timestamptz);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, items jsonb, subtotal numeric, service_fee numeric,
  delivery_fee numeric, tax numeric, customization_fee numeric, total numeric, payment_method text,
  payment_status text, order_status text, delivery_address text, delivery_state text, delivery_country text,
  contact_phone text, currency text, original_amount numeric, promo_code text, promo_code_id uuid,
  discount_amount numeric, notes text, description text, paystack_reference text, created_at timestamptz DEFAULT now());
CREATE TABLE payment_links (token text PRIMARY KEY, order_id uuid, user_id uuid, amount_ngn numeric, status text,
  requester_name text, items jsonb, expires_at timestamptz, paystack_ref text, payer_email text, paid_at timestamptz);
CREATE TABLE transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, amount numeric,
  currency text DEFAULT 'NGN', description text, reference text, status text, payment_provider text, original_amount numeric);
CREATE TABLE points_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, amount int, description text, reference text);
CREATE TABLE custom_requests (id uuid PRIMARY KEY, user_id uuid, title text, status text, updated_at timestamptz);
CREATE TABLE invoices (id uuid PRIMARY KEY, custom_request_id uuid, user_id uuid, amount numeric, description text,
  status text DEFAULT 'sent', updated_at timestamptz);
CREATE TABLE referrals (referrer_user_id uuid, referred_user_id uuid UNIQUE, referral_code_used text);
CREATE TABLE promo_codes (id uuid PRIMARY KEY, code text, max_usage int, used_count int DEFAULT 0, first_time_only boolean);
CREATE TABLE notifications (user_id uuid, title text, message text, type text, data jsonb);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- The existing (insecure) policies the migration has to neutralise.
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can create own orders" ON orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can read own orders" ON orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can read all orders" ON orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update orders" ON orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can update own order payment status" ON orders FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Anon can update order status to in_review" ON orders FOR UPDATE TO anon USING (payment_status = 'pending_payment') WITH CHECK (payment_status = 'paid');
CREATE POLICY "Anyone can read payment_link by token" ON payment_links FOR SELECT USING (true);
CREATE POLICY "Anon can mark payment_link paid by token" ON payment_links FOR UPDATE TO anon USING (status = 'pending') WITH CHECK (status = 'paid');
CREATE POLICY "System can create transactions" ON transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can read own invoices" ON invoices FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Stand-in for the dashboard-only policies that let customers accept invoices.
CREATE POLICY "dashboard invoices update" ON invoices FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "dashboard custom_requests update" ON custom_requests FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read own custom requests" ON custom_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read own transactions" ON transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Old function bodies (signatures as in the migrations).
CREATE FUNCTION increment_points(uid uuid, delta integer) RETURNS void LANGUAGE sql SECURITY DEFINER AS
  $$ UPDATE profiles SET points_balance = GREATEST(0, points_balance + delta) WHERE id = uid $$;
CREATE FUNCTION award_points_once(p_user_id uuid, p_amount integer, p_description text, p_reference text DEFAULT NULL, p_event_key text DEFAULT NULL)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN PERFORM increment_points(p_user_id, p_amount); RETURN true; END $$;
CREATE FUNCTION generate_unique_referral_code() RETURNS text LANGUAGE sql AS $$ SELECT substr(md5(random()::text), 1, 8) $$;
CREATE FUNCTION fund_wallet(uid uuid, amount numeric) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE profiles SET wallet_balance = wallet_balance + amount WHERE id = uid $$;
CREATE FUNCTION update_wallet_balance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE profiles SET wallet_balance = wallet_balance + CASE WHEN NEW.type = 'credit' THEN NEW.amount ELSE -NEW.amount END WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER update_wallet_on_transaction AFTER INSERT OR UPDATE ON transactions FOR EACH ROW EXECUTE PROCEDURE update_wallet_balance();

-- Stock trigger: same contract as reduce_stock_on_paid_order (raises on sold out).
CREATE FUNCTION reduce_stock_on_paid_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE it jsonb;
BEGIN
  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status <> 'paid') THEN
    FOR it IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
      UPDATE products SET stock = stock - (it->>'quantity')::int WHERE id = (it->>'product_id')::uuid;
      IF (SELECT stock FROM products WHERE id = (it->>'product_id')::uuid) < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for %', it->>'name';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reduce_stock_on_paid_order AFTER INSERT OR UPDATE OF payment_status ON orders FOR EACH ROW EXECUTE FUNCTION reduce_stock_on_paid_order();

-- Old restore_stock_on_refund (restores on ANY move to refunded); part 1 replaces it.
CREATE FUNCTION restore_stock_on_refund() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE it jsonb;
BEGIN
  IF NEW.payment_status = 'refunded' AND OLD.payment_status IS DISTINCT FROM 'refunded' THEN
    FOR it IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
      UPDATE products SET stock = stock + (it->>'quantity')::int WHERE id = (it->>'product_id')::uuid;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_restore_stock_on_refund AFTER UPDATE OF payment_status ON orders FOR EACH ROW EXECUTE FUNCTION restore_stock_on_refund();
