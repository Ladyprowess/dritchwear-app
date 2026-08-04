CREATE OR REPLACE FUNCTION public.get_product_sales_counts()
RETURNS TABLE(product_id text, total_ordered bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(item->>'product_id', item->>'productId') AS product_id,
    SUM(GREATEST(COALESCE(NULLIF(item->>'quantity', '')::integer, 1), 1))::bigint AS total_ordered
  FROM public.orders AS order_row
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(order_row.items::jsonb, '[]'::jsonb)) AS item
  WHERE COALESCE(order_row.order_status, '') <> 'cancelled'
    AND (
      order_row.payment_status IN ('paid', 'success', 'completed')
      OR order_row.order_status IN ('confirmed', 'processing', 'shipped', 'delivered')
    )
    AND COALESCE(item->>'product_id', item->>'productId') IS NOT NULL
  GROUP BY 1;
$$;

REVOKE ALL ON FUNCTION public.get_product_sales_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_sales_counts() TO anon, authenticated;
