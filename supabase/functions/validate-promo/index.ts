// Dritchwear Promo Code Validator
// Partner platforms call this to check if a promo code is valid before checkout.
//
// GET /functions/v1/validate-promo?code=SAVE10
// Header: x-api-key: <PARTNER_API_KEY>
//
// Response (valid):
// { valid: true, discount_percentage: 10, description: "10% off your order" }
//
// Response (invalid):
// { valid: false, reason: "Code not found" }
//
// Deploy: supabase functions deploy validate-promo

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PARTNER_API_KEY = Deno.env.get('PARTNER_API_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  // Validate API key
  const apiKey = req.headers.get('x-api-key') ?? '';
  if (!PARTNER_API_KEY || apiKey !== PARTNER_API_KEY) {
    return json({ valid: false, reason: 'Unauthorized' }, 401);
  }

  const url  = new URL(req.url);
  const code = (url.searchParams.get('code') ?? '').trim().toUpperCase();

  if (!code) return json({ valid: false, reason: 'No code provided' }, 400);

  const now = new Date().toISOString();

  const { data: promo } = await supabase
    .from('promo_codes')
    .select('discount_percentage, description, is_active, max_uses, current_uses, start_date, end_date')
    .eq('code', code)
    .single();

  if (!promo)                                            return json({ valid: false, reason: 'Code not found' });
  if (!promo.is_active)                                  return json({ valid: false, reason: 'Code is no longer active' });
  if (promo.start_date && promo.start_date > now)        return json({ valid: false, reason: 'Code is not yet active' });
  if (promo.end_date   && promo.end_date   < now)        return json({ valid: false, reason: 'Code has expired' });
  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
    return json({ valid: false, reason: 'Code has reached its usage limit' });
  }

  return json({
    valid:               true,
    discount_percentage: promo.discount_percentage,
    description:         promo.description,
  });
});
