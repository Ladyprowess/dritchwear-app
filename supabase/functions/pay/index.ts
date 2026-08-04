// Dritchwear Pay-Link Gateway
// Serves a Paystack payment page for anyone - no app required.
// Deploy: supabase functions deploy pay
//
// URL pattern:  https://<project>.supabase.co/functions/v1/pay/<token>
// Redirect dritchwear.com/pay/* → above URL in your DNS / reverse-proxy.

import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYSTACK_KEY  = Deno.env.get('PAYSTACK_PUBLIC_KEY') ?? '';
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function getTokenFromPath(req: Request) {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return last && last !== 'pay' ? last : '';
}

async function readJsonBody(req: Request) {
  const raw = await req.text();
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function safeParse(value: unknown): any {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// The token we embedded in Paystack metadata at checkout, if present.
function tokenFromVerification(verification: any): string {
  const meta = safeParse(verification?.data?.metadata);
  const fields = Array.isArray(meta?.custom_fields) ? meta.custom_fields : [];
  const field = fields.find((f: any) => f?.variable_name === 'token');
  return field?.value ? String(field.value).trim() : '';
}

function html(body: string, title = 'Pay - Dritchwear') {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <script src="https://js.paystack.co/v2/inline.js"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F4F1F8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:20px;padding:28px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,.12)}
    .logo{font-size:20px;font-weight:800;color:#5A2D82;margin-bottom:4px;letter-spacing:.3px}
    .subtitle{font-size:13px;color:#9CA3AF;margin-bottom:24px}
    h2{font-size:17px;font-weight:700;color:#1F2937;margin-bottom:14px}
    .items{border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:16px}
    .item{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #F3F4F6;font-size:14px}
    .item:last-child{border-bottom:none}
    .item-name{color:#1F2937;font-weight:600}
    .item-meta{color:#9CA3AF;font-size:12px;margin-top:2px}
    .item-price{color:#5A2D82;font-weight:700;white-space:nowrap;margin-left:12px}
    .total-row{display:flex;justify-content:space-between;align-items:center;padding:14px;background:#F3F0F8;border-radius:12px;margin-bottom:20px}
    .total-label{font-size:15px;font-weight:700;color:#1F2937}
    .total-amount{font-size:20px;font-weight:800;color:#5A2D82}
    .field{margin-bottom:14px}
    label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
    input{width:100%;border:1.5px solid #E5E7EB;border-radius:10px;padding:12px 14px;font-size:15px;outline:none;transition:border .2s}
    input:focus{border-color:#5A2D82}
    .btn{width:100%;background:#5A2D82;color:#fff;border:none;border-radius:12px;padding:16px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .15s}
    .btn:hover{opacity:.9}
    .btn:disabled{opacity:.5;cursor:not-allowed}
    .note{font-size:12px;color:#9CA3AF;text-align:center;margin-top:14px;line-height:18px}
    .badge{display:inline-block;background:#EDE9F6;color:#5A2D82;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;margin-bottom:18px}
    .success{text-align:center;padding:20px 0}
    .success svg{width:56px;height:56px;margin-bottom:12px}
    .success h2{font-size:22px;color:#10B981;margin-bottom:8px}
    .success p{color:#6B7280;font-size:14px;line-height:22px}
    .error-title{font-size:20px;font-weight:700;color:#EF4444;text-align:center;margin:20px 0 8px}
    .error-sub{color:#6B7280;font-size:14px;text-align:center;line-height:22px}
    .spinner{width:20px;height:20px;border:3px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Dritchwear Collections</div>
    <div class="subtitle">Secure Payment Gateway</div>
    ${body}
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function errorPage(message: string) {
  return html(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" style="width:48px;height:48px;margin:16px auto;display:block"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    <p class="error-title">Link Unavailable</p>
    <p class="error-sub">${message}</p>
  `);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── POST: confirm payment, update order, send notification ────────────────
  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const token = String(body.token ?? getTokenFromPath(req) ?? '').trim();
      const payerEmail = String(body.payerEmail ?? '').trim();
      const reference = String(body.reference ?? '').trim();

      if (!token || !reference) {
        return json({ success: false, error: 'Missing payment token or transaction reference' }, 400);
      }
      if (!PAYSTACK_SECRET_KEY) return json({ success: false, error: 'Payment verification is not configured' }, 503);

      const { data: plink, error: linkLookupError } = await supabase
        .from('payment_links')
        .select('order_id, user_id, status, amount_ngn, expires_at')
        .eq('token', token)
        .single();

      if (linkLookupError || !plink) {
        return json({ success: false, error: 'Payment link not found' }, 404);
      }

      if (plink.status === 'paid') {
        return json({ success: true, alreadyPaid: true });
      }

      if (plink.status !== 'pending') {
        return json({ success: false, error: `Payment link is ${plink.status}` }, 409);
      }
      if (plink.expires_at && new Date(plink.expires_at) < new Date()) {
        return json({ success: false, error: 'Payment link has expired' }, 410);
      }

      // Reject a reference that was already consumed by another payment link.
      // Prevents replaying a genuine payment against a different pending link of the same amount.
      const { data: existingRef } = await supabase
        .from('payment_links')
        .select('token')
        .eq('paystack_ref', reference)
        .maybeSingle();
      if (existingRef && existingRef.token !== token) {
        return json({ success: false, error: 'This payment reference has already been used' }, 409);
      }

      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const verification = await verifyResponse.json().catch(() => null) as any;
      if (!verifyResponse.ok || !verification?.status || verification?.data?.status !== 'success') {
        return json({ success: false, error: 'Paystack could not verify this payment' }, 402);
      }
      const expectedKobo = Math.round(Number(plink.amount_ngn || 0) * 100);
      if (verification.data.currency !== 'NGN' || Number(verification.data.amount) !== expectedKobo) {
        return json({ success: false, error: 'Verified payment amount does not match this order' }, 409);
      }
      if (verification.data.reference !== reference) {
        return json({ success: false, error: 'Payment reference mismatch' }, 409);
      }
      // If checkout embedded the link token in metadata, it must match this link.
      const metaToken = tokenFromVerification(verification);
      if (metaToken && metaToken !== token) {
        return json({ success: false, error: 'This payment does not belong to this order' }, 409);
      }

      // 1. Mark payment link as paid (only if still pending, so concurrent
      //    confirmations don't double-notify or double-process the order).
      const { data: updatedLinks, error: updateLinkError } = await supabase.from('payment_links').update({
        status: 'paid',
        payer_email: verification.data.customer?.email || payerEmail || null,
        paystack_ref: reference || null,
        paid_at: new Date().toISOString(),
      }).eq('token', token).eq('status', 'pending').select('token');

      if (updateLinkError) {
        throw new Error(`Failed to update payment link: ${updateLinkError.message}`);
      }

      if (!updatedLinks || updatedLinks.length === 0) {
        // A concurrent request already marked this link paid.
        return json({ success: true, alreadyPaid: true });
      }

      if (plink?.order_id) {
        // 3. Update order status
        const { error: orderUpdateError } = await supabase.from('orders').update({
          payment_status: 'paid',
          order_status: 'in_review',
        }).eq('id', plink.order_id);

        if (orderUpdateError) {
          throw new Error(`Failed to update order: ${orderUpdateError.message}`);
        }

        if (plink.user_id) {
          // In-app notification + push are handled by the orders UPDATE
          // trigger (customer_order_alerts, see 202608020004 migration)
          // now that order_status/payment_status were updated above.

          // Email the customer a payment confirmation (best-effort).
          try {
            if (RESEND_API_KEY) {
              const { data: buyer } = await supabase.from('profiles').select('email,full_name').eq('id', plink.user_id).single();
              if (buyer?.email) {
                const buyerName = String(buyer.full_name || 'there').replace(/[<>&"]/g, '');
                const html = `<!doctype html><html><body style="margin:0;background:#f4f1f6;font-family:Arial,sans-serif;color:#17131c"><table width="100%" role="presentation"><tr><td align="center" style="padding:28px 12px"><table width="600" role="presentation" style="width:100%;max-width:600px;background:#fff;border-collapse:collapse"><tr><td style="padding:24px 28px;background:#5a2d82;color:#fff;font-size:21px;font-weight:700">DRITCHWEAR</td></tr><tr><td style="padding:32px 28px;text-align:left"><div style="font-size:12px;font-weight:700;letter-spacing:1.2px;color:#16794b">PAYMENT RECEIVED</div><h1 style="font-size:23px;line-height:1.3;margin:9px 0 10px">Thank you, ${buyerName}!</h1><p style="font-size:15px;line-height:1.7;color:#665f6c">We've received your payment and your order is now in review. We'll let you know as it progresses.</p><a href="https://app.dritchwear.com/orders" style="display:inline-block;margin-top:10px;padding:13px 22px;background:#5a2d82;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">VIEW YOUR ORDER</a></td></tr><tr><td style="padding:22px 28px;background:#f8f7f9;text-align:left;font-size:12px;line-height:1.7;color:#746d79">support@dritchwear.com</td></tr></table></td></tr></table></body></html>`;
                const emailResponse = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': `payment-received/${plink.token}`,
                  },
                  body: JSON.stringify({ from: 'Dritchwear <noreply@dritchwear.com>', reply_to: 'support@dritchwear.com', to: [buyer.email], subject: 'Payment received - your Dritchwear order is in review', html }),
                });
                if (!emailResponse.ok) {
                  console.error('Failed to send payment confirmation email:', emailResponse.status, await emailResponse.text());
                }
              }
            }
          } catch (emailError) {
            console.error('Failed to send payment confirmation email:', emailError);
          }
        }
      }

      return json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Payment confirmation failed:', message);
      return json({ success: false, error: message }, 500);
    }
  }

  // Extract token from path: /pay/<token>
  const token = getTokenFromPath(req);

  if (!token || token === 'pay') {
    return errorPage('No payment token found in the URL.');
  }

  // Fetch the payment link record
  const { data: link, error } = await supabase
    .from('payment_links')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !link) {
    return errorPage('This payment link does not exist or has already been used.');
  }

  if (link.status !== 'pending') {
    return errorPage('This payment link has already been paid or cancelled.');
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return errorPage('This payment link has expired. Please request a new one.');
  }

  // ── Build payment page ─────────────────────────────────────────────────────
  const items: any[]   = link.items ?? [];
  const amountNGN      = link.amount_ngn ?? link.amount ?? 0;
  const requester      = link.requester_name ?? 'Someone';
  const orderId        = link.order_id ?? '';

  const itemsHtml = items.map((item: any) => `
    <div class="item">
      <div>
        <div class="item-name">${item.name} x${item.quantity}</div>
        ${item.size || item.color ? `<div class="item-meta">${[item.size, item.color].filter(Boolean).join(' · ')}</div>` : ''}
      </div>
      <div class="item-price">₦${(item.price * item.quantity).toLocaleString()}</div>
    </div>`).join('');

  const body = `
    <div class="badge">${requester} wants you to pay for this order</div>

    <h2>Order Summary</h2>
    ${itemsHtml ? `<div class="items">${itemsHtml}</div>` : ''}

    <div class="total-row">
      <span class="total-label">Total</span>
      <span class="total-amount">₦${amountNGN.toLocaleString()}</span>
    </div>

    <div id="payForm">
      <div class="field">
        <label for="email">Your Email Address</label>
        <input id="email" type="email" placeholder="your@email.com" autocomplete="email"/>
      </div>
      <div class="field">
        <label for="name">Your Name</label>
        <input id="name" type="text" placeholder="Full name" autocomplete="name"/>
      </div>
      <button class="btn" id="payBtn" onclick="startPayment()">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
        Pay ₦${amountNGN.toLocaleString()} with Card
      </button>
      <p class="note">Powered by Paystack · 256-bit SSL secured</p>
    </div>

    <div id="successMsg" class="success" style="display:none">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <h2>Payment Successful!</h2>
      <p>Thank you! The order is now in review and will be processed soon.</p>
    </div>

    <script>
      const TOKEN       = '${token}';
      const ORDER_ID    = '${orderId}';
      const PK          = '${PAYSTACK_KEY}';
      const CONFIRM_URL = '${SUPABASE_URL}/functions/v1/pay';
      const AMOUNT   = ${amountNGN};
      var done = false;
      var payerEmail = '';

      function resetBtn() {
        var btn = document.getElementById('payBtn');
        btn.disabled = false;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pay \u20a6${amountNGN.toLocaleString()} with Card';
      }

      // Named non-async functions - Paystack's validateInputTypes requires typeof === 'function'
      // (async functions fail this check in some browser/WebView contexts)
      function onPaystackSuccess(transaction) {
        if (done) return;
        done = true;
        var btn = document.getElementById('payBtn');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Recording payment...';
        fetch(CONFIRM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TOKEN, payerEmail: payerEmail, reference: transaction.reference || transaction.trxref || '' })
        })
        .then(function(response) {
          if (!response.ok) throw new Error('Payment confirmation failed');
          return response.json().catch(function() { return {}; });
        })
        .then(function(result) {
          if (!result || result.success !== true) throw new Error('Payment confirmation failed');
          document.getElementById('payForm').style.display   = 'none';
          document.getElementById('successMsg').style.display = 'block';
        })
        .catch(function() {
          alert('Payment was received, but the order could not be updated automatically. Please contact support.');
          resetBtn();
          done = false;
        });
      }

      function onPaystackClose() {
        if (!done) resetBtn();
      }

      function startPayment() {
        var email = document.getElementById('email').value.trim();
        var name  = document.getElementById('name').value.trim();
        if (!email || !email.includes('@')) { alert('Please enter a valid email address.'); return; }
        if (!name) { alert('Please enter your name.'); return; }
        if (!PK) { alert('Payment gateway not configured. Please contact support.'); return; }
        if (typeof PaystackPop === 'undefined') {
          alert('Payment system is still loading. Please wait a moment and try again.');
          return;
        }

        payerEmail = email;
        var btn = document.getElementById('payBtn');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Opening payment...';

        try {
          var popup = new PaystackPop();
          popup.newTransaction({
            key:       PK,
            email:     email,
            amount:    AMOUNT * 100,
            currency:  'NGN',
            ref:       'DW-' + Date.now(),
            metadata:  { custom_fields: [{ display_name: 'Order Token', variable_name: 'token', value: TOKEN }] },
            onSuccess: onPaystackSuccess,
            onCancel:  onPaystackClose
          });
        } catch(e) {
          alert('Could not open payment. Please try again.');
          resetBtn();
        }
      }
    </script>
  `;

  return html(body, `Pay ₦${amountNGN.toLocaleString()} - Dritchwear`);
});
