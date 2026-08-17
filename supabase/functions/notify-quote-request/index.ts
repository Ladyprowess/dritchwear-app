// Emails every admin the moment a corporate quote request comes in from the
// public /corporate page. No admin UI exists yet to review requests in-app
// (that's Feature 2, the quote-to-invoice manager) - for now this is a plain
// email with the request details inline, and the admin acts on it manually
// (e.g. by replying, or opening Supabase directly) until that UI exists.
//
// Deploy: supabase functions deploy notify-quote-request --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import { esc, p, infoBox, emailShell } from '../_shared/emailBrand.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const db = createClient(SUPABASE_URL, SERVICE_KEY);

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
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!RESEND_API_KEY) return json({ error: 'Email service is not configured' }, 503);

  const body = await req.json().catch(() => ({})) as { quoteRequestId?: string };
  const quoteRequestId = String(body.quoteRequestId || '').trim();
  if (!quoteRequestId) return json({ error: 'Missing quoteRequestId' }, 400);

  const { data: quote, error: quoteError } = await db
    .from('quote_requests')
    .select('*')
    .eq('id', quoteRequestId)
    .single();
  if (quoteError || !quote) return json({ error: 'Quote request not found' }, 404);

  const { data: admins } = await db.from('profiles').select('email').eq('role', 'admin');
  const emails = Array.from(new Set((admins ?? []).map((a: any) => a.email).filter(Boolean)));
  if (emails.length === 0) return json({ error: 'No admin emails on file' }, 503);

  const facts = [
    ['Company', quote.company_name],
    ['Contact', quote.contact_name],
    ['Email', quote.email],
    ['Phone', quote.phone || '-'],
    ['Product interest', quote.product_interest || '-'],
    ['Estimated quantity', quote.estimated_quantity],
    ['Branding type', quote.branding_type || '-'],
    ['Needed by', quote.needed_by || '-'],
    ['Delivery address', quote.delivery_address || '-'],
  ];
  const factsHtml = facts.map(([label, value]) =>
    `<tr><td style="padding:4px 0;font-size:13px;color:#8A838F">${esc(label)}</td><td style="padding:4px 0;font-size:13px;font-weight:700;color:#17131C;text-align:right">${esc(String(value))}</td></tr>`
  ).join('');

  const html = emailShell({
    eyebrow: 'New Lead &middot; Corporate Quote Request',
    headline: `${esc(quote.company_name)} wants a quote`,
    bodyHtml: p('A company just submitted a bulk/corporate merch inquiry through the website.', 18)
      + `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0">${factsHtml}</table>`
      + (quote.notes ? infoBox(`<strong style="color:#17131C">Notes</strong><br/>${esc(quote.notes)}`) : '')
      + (quote.logo_url ? p(`<a href="${esc(quote.logo_url)}" style="color:#5A2D82;font-weight:700">View uploaded logo &rsaquo;</a>`, 18) : '')
      + (quote.custom_request_id
          ? infoBox('This request was submitted by a signed-in customer and is already in the admin Orders tab - send the price/invoice from there.')
          : infoBox('This visitor was not signed in, so this request is email-only - there is nothing to manage in the Orders tab for it.')),
    ctaPrimaryLabel: 'Reply by Email',
    ctaPrimaryUrl: `mailto:${esc(quote.email)}`,
    footerNote: 'Reply directly to follow up, or reach them by phone if provided.',
  });

  let emailCount = 0;
  for (const email of emails) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `quote-request/${quote.id}/${email}` },
      body: JSON.stringify({
        from: 'Dritchwear Corporate <noreply@dritchwear.com>',
        reply_to: quote.email,
        to: [email],
        subject: `New corporate quote request: ${quote.company_name}`,
        html,
      }),
    }).catch(() => null);
    if (response?.ok) emailCount++;
  }

  if (emailCount === 0) return json({ error: 'Email provider rejected the notification' }, 502);
  return json({ success: true, emailCount });
});
