// Both customer_order_alerts and admin_alerts fan out via a pg_net trigger
// that fires-and-forgets an HTTP call to their respective sender function
// (send-customer-order-alert / send-admin-order-alert). Neither call has
// automatic retry - if dropped (a redeploy of that function landing at the
// exact moment, a transient network blip, a cold-start timeout), the alert's
// delivered_at stays null forever and nobody is notified at all (not just no
// email - no push, no in-app notification either).
//
// This is the same "cross-check and settle what got missed" pattern as
// reconcile-pending-payments and check-late-deliveries: periodically
// re-invoke the sender for anything still undelivered after a short grace
// period. Both sender functions already claim delivered_at atomically before
// doing any work, so retrying an alert that actually did go out is safe.
// Runs every minute (see 202608060001 migration) - short enough that a real
// drop is invisible to the customer/admin instead of taking up to 15 minutes
// to recover.
//
// Deploy: supabase functions deploy retry-stuck-alerts --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Long enough that we're not racing the normal in-flight dispatch (a single
// HTTP call that normally completes in well under a minute), short enough
// that a real drop barely delays anything.
const GRACE_MINUTES = 1;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function retryStuck(table: string, functionName: string, idField: string, cutoff: string) {
  const { data: stuck, error } = await supabase
    .from(table)
    .select('id')
    .is('delivered_at', null)
    .lt('created_at', cutoff);

  if (error) {
    console.error(`retry-stuck-alerts: failed to load stuck rows from ${table}`, error);
    return { checked: 0, retried: 0, failed: 0 };
  }

  let retried = 0;
  let failed = 0;

  for (const row of stuck ?? []) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: JSON.stringify({ [idField]: row.id }),
      });
      if (response.ok) retried++; else failed++;
    } catch (invokeError) {
      console.error(`retry-stuck-alerts: failed to retry ${table} row`, row.id, invokeError);
      failed++;
    }
  }

  return { checked: (stuck ?? []).length, retried, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60 * 1000).toISOString();
  const [customerResult, adminResult] = await Promise.all([
    retryStuck('customer_order_alerts', 'send-customer-order-alert', 'alertId', cutoff),
    retryStuck('admin_alerts', 'send-admin-order-alert', 'alertId', cutoff),
  ]);

  return json({ customer: customerResult, admin: adminResult });
});
