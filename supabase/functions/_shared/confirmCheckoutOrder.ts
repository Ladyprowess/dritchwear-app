// Shared by supabase/functions/confirm-order-payment (client-invoked confirm)
// and supabase/functions/paystack-webhook (server-to-server confirm), the
// same way confirmPaymentLink.ts is shared for pay-for-me links. The order
// is created client-side as payment_status='pending_payment' BEFORE Paystack
// ever opens (see usePaymentOrchestration.handleOrder), so there is always
// something on our side for the webhook/reconciliation job to settle even if
// the paying browser/app never calls back after a successful charge.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.43.4';
import { tokenFromMetadata } from './confirmPaymentLink.ts';

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
    .single();

  if (orderLookupError || !order) {
    return { success: false, status: 404, error: 'Order not found' };
  }
  if (order.payment_status === 'paid') {
    return { success: true, status: 200, alreadyPaid: true };
  }
  if (order.payment_status !== 'pending_payment') {
    return { success: false, status: 409, error: `Order is ${order.payment_status}` };
  }

  // Reject a reference already consumed by a different order.
  const { data: existingRef } = await supabase
    .from('orders')
    .select('id')
    .eq('paystack_reference', reference)
    .maybeSingle();
  if (existingRef && existingRef.id !== orderId) {
    return { success: false, status: 409, error: 'This payment reference has already been used' };
  }

  const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecretKey}` },
  });
  const verification = await verifyResponse.json().catch(() => null) as any;
  if (!verifyResponse.ok || !verification?.status || verification?.data?.status !== 'success') {
    return { success: false, status: 402, error: 'Paystack could not verify this payment' };
  }
  const expectedKobo = Math.round(Number(order.total || 0) * 100);
  if (verification.data.currency !== 'NGN' || Number(verification.data.amount) !== expectedKobo) {
    return { success: false, status: 409, error: 'Verified payment amount does not match this order' };
  }
  if (verification.data.reference !== reference) {
    return { success: false, status: 409, error: 'Payment reference mismatch' };
  }
  // If checkout embedded the order id in metadata, it must match this order.
  const metaToken = tokenFromMetadata(verification.data.metadata);
  if (metaToken && metaToken !== orderId) {
    return { success: false, status: 409, error: 'This payment does not belong to this order' };
  }

  // Only flips if still pending_payment, so a concurrent confirmation (the
  // other path settling it first) can't double-process. reduce_stock_on_paid_order
  // can also reject this UPDATE outright if the item sold out in the
  // meantime - handled below as a distinct, non-generic failure.
  const { data: updatedOrder, error: orderUpdateError } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', order_status: 'pending', paystack_reference: reference })
    .eq('id', orderId)
    .eq('payment_status', 'pending_payment')
    .select('id')
    .maybeSingle();

  if (orderUpdateError) {
    if (/insufficient stock/i.test(orderUpdateError.message || '')) {
      // Paystack already captured the charge but the item sold out before we
      // could confirm - refund as wallet credit immediately (store credit,
      // since there's no automated Paystack refund integration) rather than
      // leaving the customer charged with nothing.
      const shortId = orderId.toString().substring(0, 8);
      await supabase.rpc('credit_wallet', {
        p_user_id: order.user_id,
        p_amount: order.total,
        p_description: `Refund: item sold out before payment could be confirmed (order #${shortId})`,
        p_reference: orderId,
      }).catch((refundError: unknown) => {
        console.error('CRITICAL: stock-exhaustion refund failed for order', orderId, refundError);
      });
      await supabase
        .from('orders')
        .update({ payment_status: 'refunded', order_status: 'cancelled', paystack_reference: reference })
        .eq('id', orderId)
        .catch(() => {});
      return { success: false, status: 409, error: 'Sorry, an item in your order just sold out. Your payment has been refunded to your Dritchwear wallet.' };
    }
    return { success: false, status: 500, error: `Failed to update order: ${orderUpdateError.message}` };
  }

  if (!updatedOrder) {
    // A concurrent request (webhook vs. client vs. reconciliation) already settled this order.
    return { success: true, status: 200, alreadyPaid: true };
  }

  const { error: txError } = await supabase.from('transactions').insert({
    user_id: order.user_id,
    type: 'debit',
    amount: order.total,
    currency: order.currency || 'NGN',
    description: 'Order payment - Paystack',
    reference,
    status: 'completed',
  });
  if (txError) {
    // The order is correctly marked paid either way - a missing ledger
    // entry is a lesser, recoverable problem than an unpaid "paid" order.
    console.error('Failed to record transaction for order', orderId, txError);
  }

  // In-app notification, push, and email are all handled by the orders
  // UPDATE trigger (customer_order_alerts, see 202608020004/202608040003
  // migrations) now that payment_status/order_status were updated above.

  return { success: true, status: 200 };
}
