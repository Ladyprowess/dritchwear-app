// Paystack server-to-server webhook for pay-for-me payment links.
// Register in Paystack Dashboard → Settings → API Keys & Webhooks:
//   https://<project>.supabase.co/functions/v1/paystack-webhook
//
// This exists because the `pay` function's confirmation call is normally
// fired by the payer's own browser right after Paystack's popup closes -
// if that tab/app is closed or loses network first, Paystack has the money
// but our order never finds out. This webhook is a second, independent
// path to the same result, driven by Paystack itself instead of the payer's
// device, so a dropped client connection can no longer leave an order stuck
// showing "payment pending" after the customer has actually paid.
//
// Deploy: supabase functions deploy paystack-webhook --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import { confirmPaymentLink, tokenFromMetadata } from '../_shared/confirmPaymentLink.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

// Paystack signs the raw request body with your secret key: HMAC-SHA512, hex-encoded.
// https://paystack.com/docs/payments/webhooks/#verifying-webhook-signature
async function verifySignature(rawBody: string, signatureHeader: string) {
  if (!PAYSTACK_SECRET_KEY || !signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PAYSTACK_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = bytesToHex(new Uint8Array(digest));
  return constantTimeEqual(expected, signatureHeader.toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature') ?? '';
  if (!(await verifySignature(rawBody, signature))) {
    return json({ error: 'Invalid webhook signature' }, 401);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  // Paystack only requires a 2xx ack; retries on anything else. Once the
  // signature checks out, we always ack with 200 so a business-logic
  // rejection (e.g. link already paid) doesn't trigger retry storms.
  if (event?.event !== 'charge.success') {
    return json({ received: true, handled: false });
  }

  const reference = String(event?.data?.reference ?? '').trim();
  const token = tokenFromMetadata(event?.data?.metadata);

  if (!reference || !token) {
    // Not a pay-link charge (e.g. wallet funding/checkout via a different
    // Paystack integration) - nothing for this webhook to reconcile.
    return json({ received: true, handled: false });
  }

  const result = await confirmPaymentLink(supabase, {
    token,
    reference,
    paystackSecretKey: PAYSTACK_SECRET_KEY,
  });

  if (!result.success) {
    console.error('paystack-webhook: confirmPaymentLink failed', { token, reference, error: result.error });
  }

  return json({ received: true, handled: result.success, alreadyPaid: result.alreadyPaid ?? false });
});
