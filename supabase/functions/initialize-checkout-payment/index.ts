// iOS "Add to Home Screen" installs run in a constrained standalone webview
// that doesn't reliably support Paystack's in-page overlay (openIframe()) -
// it can silently fall back to a full-page redirect with nowhere for us to
// catch it, which looked like the app crashing back to its start screen.
// This gives that context a proper redirect-based checkout instead: Paystack
// hosts the payment page itself, then sends the browser back to callback_url
// when done - a plain page navigation, which standalone PWAs handle fine.
//
// Deploy: supabase functions deploy initialize-checkout-payment

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const PUBLIC_ORIGIN = 'https://app.dritchwear.com';

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
  if (!PAYSTACK_SECRET_KEY) return json({ success: false, error: 'Payment is not configured' }, 503);

  const accessToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return json({ success: false, error: 'Not authenticated' }, 401);
  }

  const body = await req.json().catch(() => ({})) as any;
  const orderId = String(body.orderId ?? '').trim();
  if (!orderId) return json({ success: false, error: 'Missing order id' }, 400);

  const { data: order } = await supabase
    .from('orders')
    .select('user_id, total, payment_status')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.user_id !== authData.user.id) {
    return json({ success: false, error: 'Order not found' }, 404);
  }
  if (order.payment_status !== 'pending_payment') {
    return json({ success: false, error: `Order is ${order.payment_status}` }, 409);
  }

  const reference = 'dw_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: authData.user.email,
      amount: Math.round(Number(order.total) * 100),
      currency: 'NGN',
      reference,
      callback_url: `${PUBLIC_ORIGIN}/orders?orderId=${orderId}`,
      metadata: {
        custom_fields: [
          { display_name: 'Order Token', variable_name: 'token', value: orderId },
        ],
      },
    }),
  }).catch(() => null);

  const result = response ? await response.json().catch(() => null) as any : null;
  if (!response?.ok || !result?.status || !result?.data?.authorization_url) {
    return json({ success: false, error: result?.message || 'Could not start payment' }, 502);
  }

  return json({ success: true, authorizationUrl: result.data.authorization_url, reference });
});
