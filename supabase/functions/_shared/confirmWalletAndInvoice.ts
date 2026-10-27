// Server-side settlement for the two Paystack flows that used to be
// "settled" by the client writing balances/statuses itself: wallet top-ups
// and custom-order invoices. Shared by the client-invoked confirm functions
// (confirm-wallet-funding, pay-invoice) and paystack-webhook, the same way
// confirmCheckoutOrder/confirmPaymentLink are, so a charge is credited
// exactly once whichever path sees it first.
//
// The Paystack metadata `token` custom field identifies the purpose:
//   wallet:<userId>:<amountNgn>   wallet top-up
//   invoice:<invoiceId>           custom-order invoice
// The token can't be used to steal anything: it only says what the payer
// asked for, and the verified captured amount must cover it.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.43.4';
import { amountMatchesExpected, settlementFailure, tokenFromMetadata } from './confirmPaymentLink.ts';

export interface SettlementResult {
  success: boolean;
  status: number;
  error?: string;
  alreadyPaid?: boolean;
}

export function isWalletToken(token: string) {
  return token.startsWith('wallet:');
}

export function isInvoiceToken(token: string) {
  return token.startsWith('invoice:');
}

async function verifyCharge(reference: string, paystackSecretKey: string): Promise<{ charge?: any; failure?: SettlementResult }> {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecretKey}` },
  });
  const verification = await response.json().catch(() => null) as any;
  // Not verifiable (yet) - retryable, the webhook asks Paystack to redeliver.
  if (!response.ok || !verification?.status || verification?.data?.status !== 'success') {
    return { failure: { success: false, status: 402, error: 'Paystack could not verify this payment' } as SettlementResult };
  }
  // Verified but not acceptable - final.
  if (verification.data.reference !== reference || verification.data.currency !== 'NGN') {
    return { failure: { success: false, status: 409, error: 'Payment reference or currency mismatch' } as SettlementResult };
  }
  return { charge: verification.data };
}

export async function confirmWalletFunding(
  supabase: SupabaseClient,
  opts: { reference: string; paystackSecretKey: string; expectedUserId?: string }
): Promise<SettlementResult> {
  const { reference, paystackSecretKey, expectedUserId } = opts;
  if (!reference) return { success: false, status: 400, error: 'Missing transaction reference' };
  if (!paystackSecretKey) return { success: false, status: 503, error: 'Payment verification is not configured' };

  const { charge, failure } = await verifyCharge(reference, paystackSecretKey);
  if (failure) return failure;

  const [, userId, amountText] = tokenFromMetadata(charge.metadata).split(':');
  const amount = Number(amountText);
  if (!userId || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, status: 409, error: 'This payment is not a wallet top-up' };
  }
  if (expectedUserId && userId !== expectedUserId) {
    return { success: false, status: 403, error: 'This payment belongs to a different account' };
  }
  if (!amountMatchesExpected(Number(charge.amount), Math.round(amount * 100))) {
    return { success: false, status: 409, error: 'Verified payment amount does not match the top-up' };
  }

  // Credits the amount the customer asked for, not the captured amount,
  // which can include Paystack's fee when it's passed on to the customer.
  const { data: credited, error } = await supabase.rpc('credit_wallet_from_paystack', {
    p_user_id: userId,
    p_amount: amount,
    p_reference: reference,
  });
  if (error) return { success: false, status: 500, error: `Failed to credit wallet: ${error.message}` };
  return { success: true, status: 200, alreadyPaid: credited === false };
}

export async function confirmInvoicePayment(
  supabase: SupabaseClient,
  opts: { reference: string; paystackSecretKey: string; expectedUserId?: string }
): Promise<SettlementResult> {
  const { reference, paystackSecretKey, expectedUserId } = opts;
  if (!reference) return { success: false, status: 400, error: 'Missing transaction reference' };
  if (!paystackSecretKey) return { success: false, status: 503, error: 'Payment verification is not configured' };

  const { charge, failure } = await verifyCharge(reference, paystackSecretKey);
  if (failure) return failure;

  const invoiceId = tokenFromMetadata(charge.metadata).replace(/^invoice:/, '');
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, user_id, amount, status')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invoiceError) return { success: false, status: 500, error: `Failed to load invoice: ${invoiceError.message}` };
  if (!invoice) return { success: false, status: 404, error: 'Invoice not found' };
  if (expectedUserId && invoice.user_id !== expectedUserId) {
    return { success: false, status: 403, error: 'This invoice belongs to a different account' };
  }
  if (invoice.status === 'paid') return { success: true, status: 200, alreadyPaid: true };
  if (!amountMatchesExpected(Number(charge.amount), Math.round(Number(invoice.amount) * 100))) {
    return { success: false, status: 409, error: 'Verified payment amount does not match this invoice' };
  }

  return settleInvoice(supabase, invoice.id, 'paystack', reference);
}

export async function settleInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  method: 'wallet' | 'paystack',
  reference?: string
): Promise<SettlementResult> {
  const { data: settled, error } = await supabase.rpc('settle_invoice_payment', {
    p_invoice_id: invoiceId,
    p_method: method,
    p_reference: reference ?? null,
  });
  if (error) {
    if (/insufficient_wallet_balance/.test(error.message || '')) {
      return { success: false, status: 402, error: 'Your wallet balance is too low for this payment.' };
    }
    // Deliberate rejections (wrong status, reference reused) are final;
    // anything else is retryable so the webhook gets redelivered.
    return settlementFailure(error, 'Failed to settle invoice');
  }
  if (settled === false) return { success: true, status: 200, alreadyPaid: true };

  const { data: invoice } = await supabase
    .from('invoices')
    .select('amount, custom_requests(title)')
    .eq('id', invoiceId)
    .maybeSingle();
  const request: any = Array.isArray((invoice as any)?.custom_requests)
    ? (invoice as any).custom_requests[0]
    : (invoice as any)?.custom_requests;
  const { error: notifyError } = await supabase.rpc('notify_admins', {
    p_title: 'Payment Received',
    p_message: `Payment received for custom order "${request?.title ?? 'Custom order'}" - Amount: ₦${Number(invoice?.amount ?? 0).toLocaleString()} via ${method}`,
    p_type: 'order',
  });
  if (notifyError) console.warn('notify_admins failed:', notifyError);

  return { success: true, status: 200 };
}
