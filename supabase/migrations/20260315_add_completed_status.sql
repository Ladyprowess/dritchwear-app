-- Add 'completed' to order_status constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_order_status_check
    CHECK (order_status IN (
      'pending', 'pending_payment', 'in_review',
      'confirmed', 'processing', 'shipped', 'delivered',
      'completed', 'cancelled'
    ));
