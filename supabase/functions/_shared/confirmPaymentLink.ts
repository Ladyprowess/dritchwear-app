// Shared by supabase/functions/pay (client-invoked confirm) and
// supabase/functions/paystack-webhook (server-to-server confirm) so a
// successful charge is settled the same way regardless of which path
// notices it first. Idempotent: safe to call twice for the same token.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.43.4';

export interface ConfirmPaymentLinkResult {
  success: boolean;
  status: number;
  error?: string;
  alreadyPaid?: boolean;
}

export interface ConfirmPaymentLinkOptions {
  token: string;
  reference: string;
  payerEmail?: string;
  paystackSecretKey: string;
}

function safeParse(value: unknown): any {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function tokenFromMetadata(metadata: unknown): string {
  const meta = safeParse(metadata);
  const fields = Array.isArray(meta?.custom_fields) ? meta.custom_fields : [];
  const field = fields.find((f: any) => f?.variable_name === 'token');
  return field?.value ? String(field.value).trim() : '';
}

// Paystack's Nigeria account settings can put the transaction fee on the
// customer, in which case the amount actually captured (and returned by
// verify) is the order total PLUS Paystack's cut (~1.5% + NGN100, capped at
// NGN2000) - never less than what we asked for, but always a bit more. A
// strict equality check here rejects every genuine successful payment, so
// this allows an amount at or above expected, up to a generous cushion
// (2% + NGN200) over the standard fee so a real mismatch still gets caught.
export function amountMatchesExpected(paidKobo: number, expectedKobo: number): boolean {
  if (paidKobo < expectedKobo) return false;
  const cushion = Math.round(expectedKobo * 0.02) + 20000;
  return paidKobo <= expectedKobo + cushion;
}

// The order can't be marked paid even though the charge went through: an
// item sold out (reduce_stock_on_paid_order) or the promo was used up
// (enforce_promo_on_paid_order) since checkout.
export function unfulfillableReason(message: string | undefined): string | null {
  if (/insufficient stock/i.test(message || '')) return 'item sold out before payment could be confirmed';
  if (/promo_unavailable/i.test(message || '')) return 'offer no longer available for this order';
  return null;
}

// Maps a failed settlement RPC to a result. Deliberate rejections raised by
// our own functions/triggers (RAISE EXCEPTION → SQLSTATE P0001: reference
// already used, wrong status, insufficient balance) are final, so 409 and
// the webhook acks them. Anything else - connection drops, timeouts,
// serialization failures - is reported as 500 so the webhook asks Paystack
// to redeliver instead of losing the payment.
export function settlementFailure(
  error: { code?: string; message?: string },
  context: string
): ConfirmPaymentLinkResult {
  if (error.code === 'P0001') {
    return { success: false, status: 409, error: error.message || context };
  }
  console.error(`${context} (retryable):`, error);
  return { success: false, status: 500, error: `${context}: ${error.message ?? 'database error'}` };
}

// Refunds such a charge to the order owner's wallet through one atomic,
// idempotent DB call (refund_unsettleable_payment), so the client confirm,
// webhook and reconciliation racing each other refund once, and the order
// is only ever marked refunded when the credit actually landed.
export async function refundUnsettleablePayment(
  supabase: SupabaseClient,
  opts: { orderId: string; reference: string; reason: string; linkToken?: string; payerEmail?: string | null }
): Promise<ConfirmPaymentLinkResult> {
  const { error } = await supabase.rpc('refund_unsettleable_payment', {
    p_order_id: opts.orderId,
    p_reference: opts.reference,
    p_reason: opts.reason,
    p_link_token: opts.linkToken ?? null,
    p_payer_email: opts.payerEmail ?? null,
  });
  if (error) {
    console.error('CRITICAL: refund of unsettleable payment failed', opts.orderId, error);
    return { success: false, status: 500, error: `Payment could not be confirmed or refunded yet: ${error.message}` };
  }
  // Whether this call or a concurrent one did the refund, the outcome the
  // payer needs to hear is the same.
  return {
    success: false,
    status: 409,
    error: `Sorry, this order can't be completed (${opts.reason}). The payment has been refunded to the Dritchwear wallet of the account that placed it.`,
  };
}

export async function confirmPaymentLink(
  supabase: SupabaseClient,
  opts: ConfirmPaymentLinkOptions
): Promise<ConfirmPaymentLinkResult> {
  const { token, reference, payerEmail, paystackSecretKey } = opts;

  if (!token || !reference) {
    return { success: false, status: 400, error: 'Missing payment token or transaction reference' };
  }
  if (!paystackSecretKey) {
    return { success: false, status: 503, error: 'Payment verification is not configured' };
  }

  const { data: plink, error: linkLookupError } = await supabase
    .from('payment_links')
    .select('order_id, user_id, status, amount_ngn, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (linkLookupError) {
    // Transient DB failure - retryable, and must not fall through to the
    // webhook's "not a link, try it as an order" path.
    return { success: false, status: 500, error: `Failed to load payment link: ${linkLookupError.message}` };
  }
  if (!plink) {
    return { success: false, status: 404, error: 'Payment link not found' };
  }

  if (plink.status === 'paid') {
    // A link is also closed as paid when its charge was refunded because the
    // order couldn't go through - don't report that back as a success.
    if (plink.order_id) {
      const { data: linkedOrder } = await supabase.from('orders').select('payment_status').eq('id', plink.order_id).maybeSingle();
      if (linkedOrder?.payment_status === 'refunded') {
        return { success: false, status: 409, error: 'This order couldn\'t be completed, so the payment was refunded to the Dritchwear wallet of the account that placed it.' };
      }
    }
    return { success: true, status: 200, alreadyPaid: true };
  }

  if (plink.status !== 'pending') {
    return { success: false, status: 409, error: `Payment link is ${plink.status}` };
  }
  if (plink.expires_at && new Date(plink.expires_at) < new Date()) {
    return { success: false, status: 410, error: 'Payment link has expired' };
  }

  const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecretKey}` },
  });
  const verification = await verifyResponse.json().catch(() => null) as any;
  if (!verifyResponse.ok || !verification?.status || verification?.data?.status !== 'success') {
    return { success: false, status: 402, error: 'Paystack could not verify this payment' };
  }
  const expectedKobo = Math.round(Number(plink.amount_ngn || 0) * 100);
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
  // If checkout embedded the link token in metadata, it must match this link.
  // A charge without metadata (the in-app pay page before this release) is
  // still accepted, which is safe because settle_payment_link_payment makes
  // every reference single-use across all payment flows.
  const metaToken = tokenFromMetadata(verification.data.metadata);
  if (metaToken && metaToken !== token) {
    return { success: false, status: 409, error: 'This payment does not belong to this order' };
  }
  const verifiedCustomerEmail: string | null = verification.data.customer?.email || null;

  const payer = verifiedCustomerEmail || payerEmail || null;

  // Reference secured, order and link flipped to paid, all in one locked DB
  // call - the reference is checked against every flow BEFORE anything is
  // marked paid, and concurrent confirmations can't double-process.
  const { data: outcome, error: settleError } = await supabase.rpc('settle_payment_link_payment', {
    p_token: token,
    p_reference: reference,
    p_payer_email: payer,
  });

  if (settleError) {
    const reason = plink.order_id ? unfulfillableReason(settleError.message) : null;
    if (reason) {
      // Same handling as confirmCheckoutOrder: the charge was captured but
      // the order can't go through, so refund as store credit to the
      // requester (whose order it is) and close the link.
      return refundUnsettleablePayment(supabase, {
        orderId: plink.order_id,
        reference,
        reason,
        linkToken: token,
        payerEmail: payer,
      });
    }
    return settlementFailure(settleError, 'Failed to settle payment link');
  }

  // In-app notification, push, and the "payment received" email are all
  // handled by the orders UPDATE trigger (customer_order_alerts, see
  // 202608020004/202608040003 migrations) now that the order was updated.

  return outcome === 'already_paid' ? { success: true, status: 200, alreadyPaid: true } : { success: true, status: 200 };
}
