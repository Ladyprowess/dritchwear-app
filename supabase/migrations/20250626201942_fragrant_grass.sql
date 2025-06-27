/*
  # Dritchwear E-commerce Database Schema

  1. New Tables
    - `profiles` - User profiles with wallet and role management
    - `products` - Product catalog with variants and stock
    - `orders` - Order management with payment and status tracking
    - `custom_requests` - Custom order requests from customers
    - `invoices` - Invoice system for custom requests
    - `promo_codes` - Promotional code management
    - `promo_code_usage` - Track promo code usage per user
    - `transactions` - Wallet transaction history
    - `notifications` - Push notification management

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Secure admin-only operations
    - Customer data privacy protection

  3. Features
    - Role-based authentication (customer/admin)
    - Wallet system with transaction tracking
    - Order management with status updates
    - Promo code system with usage limits
    - Custom request and invoice workflow
    - Notification system for real-time updates
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table for user management
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text,
  phone text,
  location text,
  wallet_balance decimal(10,2) DEFAULT 0.00,
  role text DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  price decimal(10,2) NOT NULL,
  image_url text NOT NULL,
  category text NOT NULL,
  sizes text[] DEFAULT '{}',
  colors text[] DEFAULT '{}',
  stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  items jsonb NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  service_fee decimal(10,2) NOT NULL,
  delivery_fee decimal(10,2) NOT NULL,
  total decimal(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('wallet', 'paystack')),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  order_status text DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  promo_code_id uuid,
  discount_amount decimal(10,2) DEFAULT 0.00,
  delivery_address text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Custom requests table
CREATE TABLE IF NOT EXISTS custom_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL,
  budget_range text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'quoted', 'accepted', 'rejected', 'completed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_request_id uuid REFERENCES custom_requests(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount decimal(10,2) NOT NULL,
  description text NOT NULL,
  admin_notes text,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'rejected', 'paid')),
  user_response text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_percentage integer DEFAULT 0,
  discount_amount decimal(10,2),
  min_order_amount decimal(10,2),
  max_usage integer,
  used_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Promo code usage tracking
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(promo_code_id, user_id)
);

-- Transactions table for wallet
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount decimal(10,2) NOT NULL,
  description text NOT NULL,
  reference text,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('order', 'promo', 'system', 'custom')),
  is_read boolean DEFAULT false,
  data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Products policies
CREATE POLICY "Anyone can read active products"
  ON products FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Orders policies
CREATE POLICY "Users can read own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Custom requests policies
CREATE POLICY "Users can read own custom requests"
  ON custom_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create custom requests"
  ON custom_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all custom requests"
  ON custom_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update custom requests"
  ON custom_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Invoices policies
CREATE POLICY "Users can read own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Promo codes policies
CREATE POLICY "Users can read active promo codes"
  ON promo_codes FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage promo codes"
  ON promo_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Promo code usage policies
CREATE POLICY "Users can read own promo usage"
  ON promo_code_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create promo usage"
  ON promo_code_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Transactions policies
CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Notifications policies
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  admin_emails text[] := ARRAY[
    'dritchwear@gmail.com',
    'admin@dritchwear.com',
    'support@dritchwear.com',
    'info@dritchwear.com'
  ];
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id,
    new.email,
    CASE
      WHEN new.email = ANY(admin_emails) THEN 'admin'
      ELSE 'customer'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
END $$;

-- Function to update wallet balance
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    IF NEW.type = 'credit' THEN
      UPDATE profiles 
      SET wallet_balance = wallet_balance + NEW.amount
      WHERE id = NEW.user_id;
    ELSE
      UPDATE profiles 
      SET wallet_balance = wallet_balance - NEW.amount
      WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update wallet on transaction
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_wallet_on_transaction'
  ) THEN
    CREATE TRIGGER update_wallet_on_transaction
      AFTER INSERT OR UPDATE ON transactions
      FOR EACH ROW EXECUTE PROCEDURE update_wallet_balance();
  END IF;
END $$;

-- Insert sample products
INSERT INTO products (name, description, price, image_url, category, sizes, colors, stock) VALUES
('Dritchwear Classic Tee', 'Premium cotton t-shirt with signature Dritchwear logo', 15000, 'https://images.pexels.com/photos/8532616/pexels-photo-8532616.jpeg', 'T-Shirts', ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL'], ARRAY['Black', 'White', 'Navy', 'Grey'], 50),
('Premium Joggers', 'Comfortable joggers perfect for casual wear', 25000, 'https://images.pexels.com/photos/7679720/pexels-photo-7679720.jpeg', 'Bottoms', ARRAY['S', 'M', 'L', 'XL', 'XXL'], ARRAY['Black', 'Grey', 'Navy'], 30),
('Oversized Hoodie', 'Cozy oversized hoodie with premium fabric', 35000, 'https://images.pexels.com/photos/8532612/pexels-photo-8532612.jpeg', 'Hoodies', ARRAY['S', 'M', 'L', 'XL', 'XXL'], ARRAY['Black', 'White', 'Grey', 'Beige'], 25),
('Dritchwear Cap', 'Stylish cap with embroidered logo', 8000, 'https://images.pexels.com/photos/1722255/pexels-photo-1722255.jpeg', 'Accessories', ARRAY['One Size'], ARRAY['Black', 'White', 'Navy'], 40);

-- Insert sample promo codes
INSERT INTO promo_codes (code, discount_percentage, min_order_amount, max_usage, is_active, expires_at) VALUES
('WELCOME10', 10, 10000, 100, true, now() + interval '30 days'),
('FIRST20', 20, 15000, 50, true, now() + interval '60 days'),
('BULK50', 50, 100000, 10, true, now() + interval '90 days');