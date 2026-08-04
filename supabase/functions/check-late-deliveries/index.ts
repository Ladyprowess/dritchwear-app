// DISABLED (see 202608040009_disable_auto_late_delivery_credit.sql): delivery
// often goes through a pickup point, so an order can arrive well within 7
// days while the customer just hasn't collected it yet - auto-crediting off
// order_status alone penalized the store for delays that weren't its fault.
// The cron schedule that invoked this has been unscheduled; the function is
// left deployed but dormant. The ₦1,000 credit is now admin-judgment-only via
// the "Give ₦1,000 Late Delivery Credit" button in Order Details, which sets
// the same late_delivery_credit_at flag this job checks, so if this were ever
// rescheduled it still couldn't double-credit an order the button already paid.

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

      // Claim the flag before crediting (not after) - the fetch above and
      // this claim aren't atomic with each other, so without this ordering
      // an overlapping cron run (or an admin's manual credit button) could
      // both see late_delivery_credit_at as null and both credit ₦1,000.
      const { data: claimed, error: flagError } = await supabase
        .from('orders')
        .update({ late_delivery_credit_at: new Date().toISOString() })
        .eq('id', order.id)
        .is('late_delivery_credit_at', null)
        .select('id')
        .maybeSingle();
      if (flagError) throw flagError;
      if (!claimed) continue; // someone else already claimed this order

      const { error: creditError } = await supabase.rpc('credit_wallet', {
        p_user_id: order.user_id,
        p_amount: CREDIT_AMOUNT,
        p_description: `Late delivery credit for order #${shortId}`,
        p_reference: order.id,
      });
      if (creditError) throw creditError;

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
