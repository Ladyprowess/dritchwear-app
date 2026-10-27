// Called by the Fund Wallet screen right after Paystack's popup reports
// success. Verifies the charge with Paystack and credits the wallet once per
// reference - the client used to write wallet_balance itself, with nothing
// checking that a payment ever happened. paystack-webhook settles the same
// top-up independently if this call never arrives.
//
// Deploy: supabase functions deploy confirm-wallet-funding

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import { confirmWalletFunding } from '../_shared/confirmWalletAndInvoice.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
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
  const result = await confirmWalletFunding(supabase, {
    reference: String(body.reference ?? '').trim(),
    paystackSecretKey: PAYSTACK_SECRET_KEY,
    expectedUserId: authData.user.id,
  });
  return json({ ...result }, result.status);
});
