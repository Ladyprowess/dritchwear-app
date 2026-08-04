// Enforces the 7-day delivery guarantee: any paid order confirmed more than
// 7 days ago that still isn't Delivered/Completed/Cancelled gets an
// automatic ₦1,000 wallet credit, once per order. Runs on a cron schedule
// (see the accompanying migration) - admin can also grant this manually via
// the "Give ₦1,000 Late Delivery Credit" button in Order Details, which sets
// the same late_delivery_credit_at flag so this job never double-credits.

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CREDIT_AMOUNT = 1000;
const GUARANTEE_DAYS = 7;
const TERMINAL_STATUSES = ['delivered', 'completed', 'cancelled'];

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const deadline = new Date(Date.now() - GUARANTEE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: overdueOrders, error: fetchError } = await supabase
    .from('orders')
    .select('id, user_id, confirmed_at')
    .eq('payment_status', 'paid')
    .not('confirmed_at', 'is', null)
    .lt('confirmed_at', deadline)
    .is('late_delivery_credit_at', null)
    .not('order_status', 'in', `(${TERMINAL_STATUSES.join(',')})`);

  if (fetchError) {
    console.error('check-late-deliveries: failed to load overdue orders', fetchError);
    return json({ error: 'Failed to load overdue orders' }, 500);
  }

  let credited = 0;
  const failures: { orderId: string; error: string }[] = [];

  for (const order of overdueOrders ?? []) {
    try {
      const shortId = order.id.toString().substring(0, 8);

      const { error: creditError } = await supabase.rpc('credit_wallet', {
        p_user_id: order.user_id,
        p_amount: CREDIT_AMOUNT,
        p_description: `Late delivery credit for order #${shortId}`,
        p_reference: order.id,
      });
      if (creditError) throw creditError;

      const { error: flagError } = await supabase
        .from('orders')
        .update({ late_delivery_credit_at: new Date().toISOString() })
        .eq('id', order.id);
      if (flagError) throw flagError;

      // Reuses the existing customer_order_alerts fan-out (in-app + push +
      // email, see 202608040003 migration) - inserting here triggers it the
      // same way an order_status change does.
      await supabase.from('customer_order_alerts').insert({
        user_id: order.user_id,
        entity_type: 'order',
        entity_id: order.id,
        title: 'Sorry for the delay 💜',
        message: `Your order #${shortId} took longer than expected, so as promised we've credited ₦1,000 to your Dritchwear wallet.`,
        url: '/orders',
        should_email: true,
      });

      credited++;
    } catch (error) {
      console.error(`check-late-deliveries: failed to credit order ${order.id}`, error);
      failures.push({ orderId: order.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (failures.length > 0) {
    console.error('check-late-deliveries: some credits failed', failures);
  }

  return json({ checked: (overdueOrders ?? []).length, credited, failed: failures.length });
});
