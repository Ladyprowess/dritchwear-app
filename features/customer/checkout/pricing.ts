import type { CartItem, AppliedPromo } from '@/contexts/CartContext';

// Discount amount in NGN for the applied promo against these items/subtotal.
// This exact calculation was independently duplicated three times in the
// original checkout.tsx (handlePayForMe, handleOrder, and the render-time
// totals) - consolidated here as the single source of truth.
export function calculateDiscountNGN(items: CartItem[], appliedPromo: AppliedPromo | null, subtotalNGN: number): number {
  if (!appliedPromo) return 0;
  if (appliedPromo.type === 'free_delivery') return 0;
  if (appliedPromo.type === 'item_percentage' && appliedPromo.productId) {
    return items.reduce((sum, item) =>
      item.productId === appliedPromo.productId
        ? sum + item.price * item.quantity * appliedPromo.discount
        : sum, 0);
  }
  return subtotalNGN * appliedPromo.discount;
}
