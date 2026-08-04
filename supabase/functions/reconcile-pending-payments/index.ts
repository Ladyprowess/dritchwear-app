// Safety net behind paystack-webhook: periodically cross-checks Paystack's
// own record of successful charges against payment_links AND regular
// checkout orders still stuck 'pending' in our database, and settles any
// mismatch. Catches the case where the webhook was briefly down/misconfigured
// (or wasn't registered yet) and a real payment slipped through with nothing
// to tell us.
//
// We can't key this lookup off a stored reference - one is never persisted
// until a link/order is confirmed paid (see confirmPaymentLink/
// confirmCheckoutOrder) - so we instead pull Paystack's list of recent
// successful transactions and match them by the order-token embedded in
// checkout metadata (a payment_links.token for pay-for-me, or a raw
// orders.id for regular checkout - tried in that order).
//
// Deploy: supabase functions deploy reconcile-pending-payments --no-verify-jwt
// Schedule: pg_cron every 15 min, mirroring dritchwear-cart-reminders.

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import { confirmPaymentLink, tokenFromMetadata } from '../_shared/confirmPaymentLink.ts';
import { confirmCheckoutOrder } from '../_shared/confirmCheckoutOrder.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// How far back to scan Paystack's transaction list. Wider than the cron
// interval on purpose, so a single missed run can't create a permanent gap.
const LOOKBACK_HOURS = 24;
const MAX_PAGES = 5;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!PAYSTACK_SECRET_KEY) return json({ error: 'Payment verification is not configured' }, 503);

  const [{ data: pendingLinks, error: linksError }, { data: pendingOrders, error: ordersError }] = await Promise.all([
    supabase.from('payment_links').select('token').eq('status', 'pending').gt('expires_at', new Date().toISOString()),
    supabase.from('orders').select('id').eq('payment_status', 'pending_payment').eq('payment_method', 'paystack'),
  ]);

  if (linksError || ordersError) {
    console.error('reconcile-pending-payments: failed to load pending records', linksError || ordersError);
    return json({ error: 'Failed to load pending payments' }, 500);
  }

  // token -> which table it belongs to, so a match dispatches to the right confirm function.
  const pendingTokens = new Map<string, 'link' | 'order'>();
  (pendingLinks ?? []).forEach((l) => pendingTokens.set(l.token, 'link'));
  (pendingOrders ?? []).forEach((o) => pendingTokens.set(o.id, 'order'));

  if (pendingTokens.size === 0) {
    return json({ checked: 0, settled: 0 });
  }

  const from = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const settled: string[] = [];
  const failures: { token: string; error?: string }[] = [];
  let checked = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `https://api.paystack.co/transaction?status=success&perPage=100&page=${page}&from=${encodeURIComponent(from)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } });
    const body = await response.json().catch(() => null) as any;
    if (!response.ok || !body?.status) {
      console.error('reconcile-pending-payments: Paystack transaction list failed', response.status, body);
      break;
    }

    const transactions: any[] = Array.isArray(body.data) ? body.data : [];
    if (transactions.length === 0) break;

    for (const tx of transactions) {
      const token = tokenFromMetadata(tx.metadata);
      const kind = token ? pendingTokens.get(token) : undefined;
      if (!token || !kind) continue;

      checked += 1;
      const reference = String(tx.reference ?? '');
      const result = kind === 'link'
        ? await confirmPaymentLink(supabase, { token, reference, paystackSecretKey: PAYSTACK_SECRET_KEY })
        : await confirmCheckoutOrder(supabase, { orderId: token, reference, paystackSecretKey: PAYSTACK_SECRET_KEY });

      if (result.success) {
        settled.push(token);
        pendingTokens.delete(token);
      } else {
        failures.push({ token, error: result.error });
      }
    }

    const totalPages = Number(body.meta?.pageCount ?? 1);
    if (page >= totalPages) break;
  }

  if (failures.length > 0) {
    console.error('reconcile-pending-payments: some settlements failed', failures);
  }

  return json({ checked, settled: settled.length, failed: failures.length, failures });
});
