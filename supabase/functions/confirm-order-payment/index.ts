// Called by the checkout screen right after Paystack's popup reports
// success, to verify the charge and mark the pre-created order paid. This is
// the client-invoked confirmation path - paystack-webhook and
// reconcile-pending-payments settle the same order independently if this
// call never happens (dropped connection, app killed, etc.), using the same
// confirmCheckoutOrder logic, so a successful charge can never get stranded.
//
// Deploy: supabase functions deploy confirm-order-payment

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import { confirmCheckoutOrder } from '../_shared/confirmCheckoutOrder.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405);

  const accessToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return json({ success: false, error: 'Not authenticated' }, 401);
  }

  const body = await req.json().catch(() => ({})) as any;
  const orderId = String(body.orderId ?? '').trim();
  const reference = String(body.reference ?? '').trim();

  if (!orderId || !reference) {
    return json({ success: false, error: 'Missing order id or transaction reference' }, 400);
  }

  // Confirm the caller actually owns this order before doing anything else.
  const { data: order } = await supabase.from('orders').select('user_id').eq('id', orderId).maybeSingle();
  if (!order || order.user_id !== authData.user.id) {
    return json({ success: false, error: 'Order not found' }, 404);
  }

  const result = await confirmCheckoutOrder(supabase, { orderId, reference, paystackSecretKey: PAYSTACK_SECRET_KEY });
  return json(result, result.status);
});
