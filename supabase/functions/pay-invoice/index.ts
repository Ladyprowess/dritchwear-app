// Pays a custom-order invoice, from the wallet or with a verified Paystack
// charge. Replaces the client marking invoices paid and writing its own
// wallet balance (read-then-write, so two quick taps both succeeded).
//
// POST { invoiceId, method: 'wallet' }
// POST { method: 'paystack', reference }
//
// Deploy: supabase functions deploy pay-invoice

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import { confirmInvoicePayment, settleInvoice } from '../_shared/confirmWalletAndInvoice.ts';

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
  const userId = authData.user.id;

  const body = await req.json().catch(() => ({})) as any;
  const method = String(body.method ?? '');

  if (method === 'paystack') {
    const result = await confirmInvoicePayment(supabase, {
      reference: String(body.reference ?? '').trim(),
      paystackSecretKey: PAYSTACK_SECRET_KEY,
      expectedUserId: userId,
    });
    return json({ ...result }, result.status);
  }

  if (method === 'wallet') {
    const invoiceId = String(body.invoiceId ?? '').trim();
    const { data: invoice } = await supabase.from('invoices').select('user_id').eq('id', invoiceId).maybeSingle();
    if (!invoice || invoice.user_id !== userId) {
      return json({ success: false, error: 'Invoice not found' }, 404);
    }
    const result = await settleInvoice(supabase, invoiceId, 'wallet');
    return json({ ...result }, result.status);
  }

  return json({ success: false, error: 'Unsupported payment method' }, 400);
});
