// Canonical Order/OrderItem/Invoice types, replacing 3 independent declarations
// that had drifted apart: app/(customer)/orders.tsx, app/(admin)/orders.tsx,
// and components/OrderDetailsModal.tsx.
//
// This is a strict superset of all three existing shapes so every current
// access pattern keeps compiling unchanged - nothing here should force a
// transformation of data already being fetched. Two genuine (not cosmetic)
// divergences found between the originals, resolved as noted below:
//
// - Invoice.currency / Invoice.original_amount: required in
//   OrderDetailsModal.tsx's local type, optional in the customer orders.tsx
//   one. Kept optional here (the weaker constraint) so the customer screen's
//   existing invoice data doesn't need backfilling to satisfy the type.
// - brand_colors: `string` in admin's CustomRequest, `string[]` in the
//   modal's Order. Typed as `string | string[]` here rather than picking a
//   winner, since either existing caller can keep passing what it already has.
//
// admin/orders.tsx is intentionally NOT migrated to this type as part of this
// phase (out of the current backlog's file list) - it keeps its own local
// Order/CustomRequest split for now.

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  /** Optional customer special request / preference for this item. */
  note?: string | null;
  /** Optional customer-uploaded logo image URL for this item. */
  logo_url?: string | null;
}

export interface Invoice {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  currency?: string;
  original_amount?: number;
}

export interface OrderProfile {
  full_name: string;
  email: string;
  wallet_balance?: number;
  phone?: string | null;
  preferred_currency?: string;
}

export interface Order {
  id: string;
  user_id: string;
  created_at: string;

  // Regular-order fields
  items?: OrderItem[];
  subtotal?: number;
  service_fee?: number;
  delivery_fee?: number;
  tax?: number;
  total?: number;
  payment_method?: string;
  payment_status?: string;
  order_status?: string;
  delivery_address?: string;
  contact_phone?: string | null;
  currency?: string;
  original_amount?: number;
  promo_code?: string | null;
  discount_amount?: number | null;
  notes?: string | null;

  // Fulfillment tracking + delivery SLA
  confirmed_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  tracking_number?: string | null;
  tracking_link?: string | null;
  late_delivery_credit_at?: string | null;

  // Shared by both regular + custom orders
  profiles?: OrderProfile;
  invoices?: Invoice[];

  // Custom-order fields
  title?: string;
  description?: string;
  quantity?: number;
  budget_range?: string;
  status?: string;
  invoice_sent?: boolean;
  business_name?: string;
  event_name?: string;
  logo_url?: string;
  brand_colors?: string | string[];
  logo_placement?: string;
  deadline?: string;
  additional_notes?: string;
}

// Mirrors admin/orders.tsx's separate "regular order" vs "custom order"
// modeling, as a narrower view over the same canonical Order shape - for
// call sites (like admin's) that prefer to branch on two distinct types
// rather than optional fields on one. Not required reading for callers that
// are happy with `Order` directly.
export type CustomRequest = Order & {
  title: string;
  description: string;
  quantity: number;
  budget_range: string;
  status: string;
};
