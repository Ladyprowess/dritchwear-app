// Persona-neutral formatting helpers, parameterized versions of logic that
// was closing over component state (profile, invoice) inline in
// app/(customer)/orders.tsx. Mirrors the lib/admin/formatting.ts precedent
// but for customer-facing screens (checkout, orders, profile).
import { convertFromNGN, formatCurrency } from './currency';
import type { Invoice } from './orders/types';

// Formats a raw NGN amount in the given currency, or the user's preferred
// currency if none is passed, converting from NGN first when needed.
export function formatCurrencyInUserPreference(
  amount: number,
  preferredCurrency?: string | null,
  currencyCode?: string
): string {
  const displayCurrency = currencyCode || preferredCurrency || 'NGN';

  if (displayCurrency === 'NGN') {
    return formatCurrency(amount, 'NGN');
  }

  const convertedAmount = convertFromNGN(amount, displayCurrency);
  return formatCurrency(convertedAmount, displayCurrency);
}

// Formats an invoice's amount, preferring the currency it was actually
// issued/paid in over a fresh NGN->preferred-currency conversion.
export function formatInvoiceAmount(invoice: Invoice, preferredCurrency?: string | null): string {
  if (invoice.original_amount && invoice.currency) {
    return formatCurrency(invoice.original_amount, invoice.currency);
  }

  return formatCurrencyInUserPreference(invoice.amount, preferredCurrency);
}

// "Mar 5, 2026" - used by customer order lists. NOTE: this is a different
// format from lib/admin/formatting.ts's formatDate (which includes a time,
// "Mar 5, 2:30 PM", for the admin dashboard) - not a duplicate to merge.
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
