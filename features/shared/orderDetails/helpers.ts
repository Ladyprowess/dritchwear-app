import { convertFromNGN, formatCurrency } from '@/lib/currency';
import type { Order } from '@/lib/orders/types';

export function isCustomOrder(order: Order): boolean {
  return !order.items;
}

// Determines the currency this specific order/custom-request was actually
// paid (or will be paid) in.
export function getActualPaymentCurrency(order: Order): string {
  if (isCustomOrder(order)) {
    return order.currency || order.profiles?.preferred_currency || 'NGN';
  }
  return order.currency || 'NGN';
}

// Formats an amount that's a component of the order's total (subtotal, fee,
// item price, etc.) in the currency the order was actually paid in -
// converting proportionally when the order's original_amount/currency
// records a different payment currency than NGN.
export function formatAmountInPaymentCurrency(order: Order, amount: number): string {
  const actualPaymentCurrency = getActualPaymentCurrency(order);

  if (order.original_amount && order.currency && !isCustomOrder(order)) {
    if (amount === order.total) {
      return formatCurrency(order.original_amount, order.currency);
    }
    const ratio = order.original_amount / (order.total || 1);
    const convertedAmount = amount * ratio;
    return formatCurrency(convertedAmount, order.currency);
  }

  if (actualPaymentCurrency === 'NGN') {
    return formatCurrency(amount, 'NGN');
  }

  const convertedAmount = convertFromNGN(amount, actualPaymentCurrency);
  return formatCurrency(convertedAmount, actualPaymentCurrency);
}

// "March 5, 2026, 2:30 PM" - long format with time, specific to this modal.
// NOTE: distinct from lib/formatting.ts's formatDate (short, no time) and
// lib/admin/formatting.ts's formatDate (short, with time) - a third,
// genuinely different format, not a duplicate to merge.
export function formatOrderDetailsDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
