// Shared by supabase/functions/confirm-order-payment (client-invoked confirm)
// and supabase/functions/paystack-webhook (server-to-server confirm), the
// same way confirmPaymentLink.ts is shared for pay-for-me links. The order
// is created client-side as payment_status='pending_payment' BEFORE Paystack
// ever opens (see usePaymentOrchestration.handleOrder), so there is always
// something on our side for the webhook/reconciliation job to settle even if
// the paying browser/app never calls back after a successful charge.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.43.4';
import {
  tokenFromMetadata,
  amountMatchesExpected,
  refundUnsettleablePayment,
  settlementFailure,
  unfulfillableReason,
} from './confirmPaymentLink.ts';

export { tokenFromMetadata };

export interface ConfirmCheckoutOrderResult {
  success: boolean;
  status: number;
  error?: string;
  alreadyPaid?: boolean;
}

export interface ConfirmCheckoutOrderOptions {
  orderId: string;
  reference: string;
  paystackSecretKey: string;
}

export async function confirmCheckoutOrder(
  supabase: SupabaseClient,
  opts: ConfirmCheckoutOrderOptions
): Promise<ConfirmCheckoutOrderResult> {
  const { orderId, reference, paystackSecretKey } = opts;

  if (!orderId || !reference) {
    return { success: false, status: 400, error: 'Missing order id or transaction reference' };
  }
  if (!paystackSecretKey) {
    return { success: false, status: 503, error: 'Payment verification is not configured' };
  }

  const { data: order, error: orderLookupError } = await supabase
    .from('orders')
    .select('user_id, payment_status, total, currency')
    .eq('id', orderId)
    .maybeSingle();

  if (orderLookupError) {
    // A transient DB failure, not a missing order - retryable.
    return { success: false, status: 500, error: `Failed to load order: ${orderLookupError.message}` };
  }
  if (!order) {
    return { success: false, status: 404, error: 'Order not found' };
  }
  if (order.payment_status === 'paid') {
    return { success: true, status: 200, alreadyPaid: true };
  }
  if (order.payment_status !== 'pending_payment') {
    return { success: false, status: 409, error: `Order is ${order.payment_status}` };
  }

  const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecretKey}` },
  });
  const verification = await verifyResponse.json().catch(() => null) as any;
  if (!verifyResponse.ok || !verification?.status || verification?.data?.status !== 'success') {
    return { success: false, status: 402, error: 'Paystack could not verify this payment' };
  }
  const expectedKobo = Math.round(Number(order.total || 0) * 100);
  if (verification.data.currency !== 'NGN' || !amountMatchesExpected(Number(verification.data.amount), expectedKobo)) {
    return {
      success: false,
      status: 409,
      error: `Verified payment amount does not match this order (expected >= ${expectedKobo} kobo, got ${verification.data.amount} ${verification.data.currency})`,
    };
  }
  if (verification.data.reference !== reference) {
    return { success: false, status: 409, error: 'Payment reference mismatch' };
  }
  // If checkout embedded the order id in metadata, it must match this order.
  // A charge without metadata is still accepted (older app builds), which is
  // safe because settle_checkout_order_payment makes every reference
  // single-use across all payment flows.
  const metaToken = tokenFromMetadata(verification.data.metadata);
  if (metaToken && metaToken !== orderId) {
    return { success: false, status: 409, error: 'This payment does not belong to this order' };
  }

  // Reference check, paid flip and ledger entry in one locked DB call, so the
  // client confirm, webhook and reconciliation can't double-process, and a
  // reference can't be reused by any other order, link, top-up or invoice.
  const { data: outcome, error: settleError } = await supabase.rpc('settle_checkout_order_payment', {
    p_order_id: orderId,
    p_reference: reference,
  });

  if (settleError) {
    const reason = unfulfillableReason(settleError.message);
    if (reason) {
      // Paystack already captured the charge but the order can't go through
      // (sold out / promo used up) - refund as wallet credit (store credit,
      // since there's no automated Paystack refund integration) rather than
      // leaving the customer charged with nothing. Atomic and once-only,
      // since the client confirm and the webhook can both get here.
      return refundUnsettleablePayment(supabase, { orderId, reference, reason });
    }
    if (/order_not_pending/.test(settleError.message || '')) {
      // Settled by a concurrent path in between our read and this call.
      const { data: latest } = await supabase.from('orders').select('payment_status').eq('id', orderId).maybeSingle();
      if (latest?.payment_status === 'paid') return { success: true, status: 200, alreadyPaid: true };
    }
    return settlementFailure(settleError, 'Failed to settle order');
  }

  // In-app notification, push, and email are all handled by the orders
  // UPDATE trigger (customer_order_alerts, see 202608020004/202608040003
  // migrations) now that payment_status/order_status were updated.

  return outcome === 'already_paid' ? { success: true, status: 200, alreadyPaid: true } : { success: true, status: 200 };
}
