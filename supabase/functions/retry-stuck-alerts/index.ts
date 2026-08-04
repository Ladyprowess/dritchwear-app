// customer_order_alerts fans out to push/in-app/email via a pg_net trigger
// (dispatch_customer_order_alert) that fires-and-forgets an HTTP call to
// send-customer-order-alert. That call has no automatic retry - if it's
// dropped (a redeploy of that function landing at the exact moment, a
// transient network blip, a cold-start timeout), the alert's delivered_at
// stays null forever and the customer silently never gets notified at all
// (not just no email - no push, no in-app notification either).
//
// This is the same "cross-check and settle what got missed" pattern as
// reconcile-pending-payments and check-late-deliveries: periodically re-invoke
// send-customer-order-alert for anything still undelivered after a grace
// period (send-customer-order-alert already claims delivered_at atomically
// before doing any work, so retrying a alert that actually did go out is safe).
//
// Deploy: supabase functions deploy retry-stuck-alerts --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Long enough that we're not racing the normal in-flight dispatch.
const GRACE_MINUTES = 5;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60 * 1000).toISOString();
  const { data: stuck, error } = await supabase
    .from('customer_order_alerts')
    .select('id')
    .is('delivered_at', null)
    .lt('created_at', cutoff);

  if (error) {
    console.error('retry-stuck-alerts: failed to load stuck alerts', error);
    return json({ error: 'Failed to load stuck alerts' }, 500);
  }

  let retried = 0;
  let failed = 0;

  for (const alert of stuck ?? []) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-customer-order-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: JSON.stringify({ alertId: alert.id }),
      });
      if (response.ok) retried++; else failed++;
    } catch (invokeError) {
      console.error('retry-stuck-alerts: failed to retry alert', alert.id, invokeError);
      failed++;
    }
  }

  return json({ checked: (stuck ?? []).length, retried, failed });
});
