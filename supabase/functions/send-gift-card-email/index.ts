// Dritchwear Gift Card Email
// Sends a branded HTML email for gift card delivery.
// Requires RESEND_API_KEY set in Supabase project secrets.
// Deploy: supabase functions deploy send-gift-card-email

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildEmailHtml(opts: {
  recipientName: string;
  senderName: string;
  amount: string;
  code: string;
  link: string;
  message?: string | null;
}): string {
  const recipientName = escapeHtml(opts.recipientName);
  const senderName = escapeHtml(opts.senderName);
  const amount = escapeHtml(opts.amount);
  const code = escapeHtml(opts.code);
  const link = escapeHtml(opts.link);
  const message = opts.message ? escapeHtml(opts.message) : null;
  const messageBlock = message
    ? `<tr>
        <td style="padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F3EEF8;border:1px solid #DCCFEE;border-radius:18px;">
            <tr>
              <td style="padding:20px 22px;">
                <p style="margin:0 0 8px;font-size:11px;line-height:1;letter-spacing:1.8px;text-transform:uppercase;color:#6B3FA0;font-weight:700;">Personal Message</p>
                <p style="margin:0;font-size:15px;line-height:1.7;color:#4A2D82;font-style:italic;">"${message}"</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Your Dritchwear Gift Card</title>
</head>
<body style="margin:0;padding:0;background:#F3EEF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1F2937;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F3EEF8;">
    <tr>
      <td align="center" style="padding:32px 14px;">
        <table width="620" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:620px;">
          <tr>
            <td style="padding:0 0 18px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1;letter-spacing:2.4px;text-transform:uppercase;color:#6B3FA0;font-weight:700;">Dritchwear Gift Delivery</p>
            </td>
          </tr>
          <tr>
            <td style="background:#2D1548;border-radius:28px;overflow:hidden;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:44px 32px 26px;background:linear-gradient(135deg,#2D1548 0%,#5A2D82 55%,#9B59CC 100%);text-align:center;">
                    <p style="margin:0 0 10px;font-size:12px;line-height:1;letter-spacing:2px;text-transform:uppercase;color:#E8D4F8;font-weight:700;">A stylish surprise is here</p>
                    <h1 style="margin:0;font-size:34px;line-height:1.15;font-weight:800;color:#FFFFFF;">A Dritchwear gift card for ${recipientName}</h1>
                    <p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#EBD9F8;">
                      <strong style="color:#FFFFFF;">${senderName}</strong> sent you something special.
                      Redeem it in the app and add the balance to your wallet instantly.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#FFFFFF;padding:0;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="padding:30px 32px 24px;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:linear-gradient(135deg,#1E0D35 0%,#5A2D82 100%);border-radius:24px;overflow:hidden;">
                            <tr>
                              <td style="padding:28px 24px;">
                                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                                  <tr>
                                    <td align="left" valign="top">
                                      <p style="margin:0 0 8px;font-size:11px;line-height:1;letter-spacing:1.8px;text-transform:uppercase;color:#C4A0E8;font-weight:700;">Gift Card Value</p>
                                      <p style="margin:0;font-size:42px;line-height:1;font-weight:800;color:#FFFFFF;">${amount}</p>
                                    </td>
                                    <td align="right" valign="top">
                                      <span style="display:inline-block;padding:8px 12px;border:1px solid rgba(255,255,255,0.25);border-radius:999px;font-size:11px;line-height:1;letter-spacing:1.3px;text-transform:uppercase;color:#DFC4F5;font-weight:700;">
                                        Redeem in app
                                      </span>
                                    </td>
                                  </tr>
                                </table>
                                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:26px;">
                                  <tr>
                                    <td style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:18px;padding:16px 18px;">
                                      <p style="margin:0 0 6px;font-size:10px;line-height:1;letter-spacing:1.5px;text-transform:uppercase;color:#C4A0E8;font-weight:700;">Gift Code</p>
                                      <p style="margin:0;font-size:24px;line-height:1.2;font-weight:800;color:#FFFFFF;letter-spacing:3px;font-family:'Courier New',monospace;">${code}</p>
                                    </td>
                                  </tr>
                                </table>
                                <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#D4B8EF;">Dritchwear premium streetwear and branded essentials.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ${messageBlock}
                      <tr>
                        <td style="padding:0 32px 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F3EEF8;border:1px solid #DCCFEE;border-radius:20px;">
                            <tr>
                              <td style="padding:22px;">
                                <p style="margin:0 0 10px;font-size:11px;line-height:1;letter-spacing:1.6px;text-transform:uppercase;color:#6B3FA0;font-weight:700;">How to redeem</p>
                                <p style="margin:0;font-size:15px;line-height:1.7;color:#2D1548;">
                                  Tap the button below to open Dritchwear, or open the app and go to
                                  <strong>Gift Cards → Redeem</strong>.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:8px 32px 18px;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td align="center" bgcolor="#5A2D82" style="border-radius:16px;">
                                <a href="${link}" style="display:inline-block;padding:18px 34px;font-size:16px;line-height:1;font-weight:800;color:#FFFFFF;text-decoration:none;border-radius:16px;">Open Gift Card</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:0 32px 30px;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td align="center" bgcolor="#EDE7F6" style="border-radius:14px;border:1px solid #D4C5EA;">
                                <a href="mailto:support@dritchwear.com" style="display:inline-block;padding:14px 22px;font-size:14px;line-height:1;font-weight:700;color:#5A2D82;text-decoration:none;border-radius:14px;">Need help? Contact support</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 32px 30px;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;border:1px dashed #C4A0E8;border-radius:18px;">
                            <tr>
                              <td style="padding:18px 20px;text-align:center;">
                                <p style="margin:0 0 7px;font-size:11px;line-height:1;letter-spacing:1.7px;text-transform:uppercase;color:#7B4FAD;font-weight:700;">Prefer to enter it manually?</p>
                                <p style="margin:0;font-size:26px;line-height:1.2;font-weight:800;color:#5A2D82;letter-spacing:4px;font-family:'Courier New',monospace;">${code}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 32px 34px;text-align:center;">
                          <p style="margin:0;font-size:12px;line-height:1.7;color:#6B3FA0;">
                            If the button does not open automatically, copy this link into your browser:
                          </p>
                          <p style="margin:10px 0 0;font-size:12px;line-height:1.7;color:#9B59CC;word-break:break-all;">
                            ${link}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 28px;background:#2D1548;text-align:center;">
                    <p style="margin:0 0 6px;font-size:15px;line-height:1.2;font-weight:800;color:#D4B8EF;">Dritchwear</p>
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#BFA8DF;">
                      Premium custom streetwear and branded merch.<br/>
                      Shop 101 Tailoring Line, Tradefair Complex, Lagos, Nigeria
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!RESEND_API_KEY) {
    return json({ error: 'Email service not configured. Add RESEND_API_KEY to Supabase secrets.' }, 503);
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { to, recipientName, senderName, amount, code, link, message } = body;

  if (!to || !recipientName || !senderName || !amount || !code || !link) {
    return json({ error: 'Missing required fields: to, recipientName, senderName, amount, code, link' }, 400);
  }

  const html = buildEmailHtml({ recipientName, senderName, amount, code, link, message });
  const subject = `${senderName} sent you a Dritchwear gift card worth ${amount} 🎁`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Dritchwear <noreply@dritchwear.com>',
        reply_to: 'support@dritchwear.com',
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Resend API error:', res.status, errText);
      return json({ error: 'Failed to send email', detail: errText }, 502);
    }

    const data = await res.json();
    return json({ success: true, id: data.id });
  } catch (err: any) {
    console.error('send-gift-card-email error:', err);
    return json({ error: err?.message ?? 'Unknown error' }, 500);
  }
});
