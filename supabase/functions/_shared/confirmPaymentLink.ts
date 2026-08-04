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
    .single();

  if (linkLookupError || !plink) {
    return { success: false, status: 404, error: 'Payment link not found' };
  }

  if (plink.status === 'paid') {
    return { success: true, status: 200, alreadyPaid: true };
  }

  if (plink.status !== 'pending') {
    return { success: false, status: 409, error: `Payment link is ${plink.status}` };
  }
  if (plink.expires_at && new Date(plink.expires_at) < new Date()) {
    return { success: false, status: 410, error: 'Payment link has expired' };
  }

  // Reject a reference that was already consumed by another payment link.
  // Prevents replaying a genuine payment against a different pending link of the same amount.
  const { data: existingRef } = await supabase
    .from('payment_links')
    .select('token')
    .eq('paystack_ref', reference)
    .maybeSingle();
  if (existingRef && existingRef.token !== token) {
    return { success: false, status: 409, error: 'This payment reference has already been used' };
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
  const metaToken = tokenFromMetadata(verification.data.metadata);
  if (metaToken && metaToken !== token) {
    return { success: false, status: 409, error: 'This payment does not belong to this order' };
  }
  const verifiedCustomerEmail: string | null = verification.data.customer?.email || null;

  // 1. Mark payment link as paid (only if still pending, so concurrent
  //    confirmations don't double-notify or double-process the order).
  const { data: updatedLinks, error: updateLinkError } = await supabase.from('payment_links').update({
    status: 'paid',
    payer_email: verifiedCustomerEmail || payerEmail || null,
    paystack_ref: reference || null,
    paid_at: new Date().toISOString(),
  }).eq('token', token).eq('status', 'pending').select('token');

  if (updateLinkError) {
    return { success: false, status: 500, error: `Failed to update payment link: ${updateLinkError.message}` };
  }

  if (!updatedLinks || updatedLinks.length === 0) {
    // A concurrent request (the other confirmation path) already marked this link paid.
    return { success: true, status: 200, alreadyPaid: true };
  }

  if (plink?.order_id) {
    const { error: orderUpdateError } = await supabase.from('orders').update({
      payment_status: 'paid',
      order_status: 'in_review',
    }).eq('id', plink.order_id);

    if (orderUpdateError) {
      return { success: false, status: 500, error: `Failed to update order: ${orderUpdateError.message}` };
    }

    // In-app notification, push, and the "payment received" email are all
    // handled by the orders UPDATE trigger (customer_order_alerts, see
    // 202608020004/202608040003 migrations) now that order_status/
    // payment_status were updated above.
  }

  return { success: true, status: 200 };
}
