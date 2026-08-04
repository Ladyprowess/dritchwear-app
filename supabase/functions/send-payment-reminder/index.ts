// Dritchwear - Payment reminder to the customer.
// Emails the customer (via Resend) and drops an in-app notification asking
// them to complete payment for an order still in `pending_payment`.
// Triggered from the app: admin "Send payment reminder" button, and
// automatically when a pay-for-me order is placed.
// Requires RESEND_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY secrets.
// Deploy: supabase functions deploy send-payment-reminder
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const PUBLIC_ORIGIN = "https://app.dritchwear.com";
const db = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const formatNaira = (amount: number) =>
  "₦" + (Number(amount) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildHtml(opts: { name: string; amount: string; payUrl: string }) {
  const name = escapeHtml(opts.name);
  return `<!doctype html><html><body style="margin:0;background:#f4f1f6;font-family:Arial,sans-serif;color:#17131c"><table width="100%" role="presentation"><tr><td align="center" style="padding:28px 12px"><table width="600" role="presentation" style="width:100%;max-width:600px;background:#fff;border-collapse:collapse"><tr><td style="padding:24px 28px;background:#5a2d82;color:#fff;font-size:21px;font-weight:700">DRITCHWEAR</td></tr><tr><td style="padding:32px 28px;text-align:left"><div style="font-size:12px;font-weight:700;letter-spacing:1.2px;color:#5a2d82">COMPLETE YOUR PAYMENT</div><h1 style="font-size:23px;line-height:1.3;margin:9px 0 10px">Hi ${name}, your order is waiting</h1><p style="font-size:15px;line-height:1.7;color:#665f6c">You placed an order of <strong>${escapeHtml(opts.amount)}</strong>, but payment hasn't been completed yet. Your items are reserved - finish checkout to confirm your order.</p><a href="${opts.payUrl}" style="display:inline-block;margin-top:10px;padding:13px 22px;background:#5a2d82;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">COMPLETE PAYMENT</a></td></tr><tr><td style="padding:22px 28px;background:#f8f7f9;text-align:left;font-size:12px;line-height:1.7;color:#746d79">Already paid? You can ignore this email.<br/>support@dritchwear.com</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const accessToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await db.auth.getUser(accessToken);
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const input = (await req.json().catch(() => ({}))) as { orderId?: string; source?: string };
  const orderId = String(input.orderId || "");
  const source = input.source === "manual" ? "manual" : "initial";
  if (!orderId) return json({ error: "Missing orderId" }, 400);

  const { data: order } = await db
    .from("orders")
    .select("id,user_id,total,payment_status")
    .eq("id", orderId)
    .single();
  if (!order) return json({ error: "Order not found" }, 404);

  const { data: callerProfile } = await db
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  const isAdmin = callerProfile?.role === "admin";
  if (order.user_id !== authData.user.id && !isAdmin) {
    return json({ error: "Forbidden" }, 403);
  }
  if (source === "manual" && !isAdmin) {
    return json({ error: "Only an admin can send a manual reminder" }, 403);
  }

  // Never nag about an order that is already paid.
  if (order.payment_status !== "pending_payment") {
    return json({ success: true, skipped: "not_pending" });
  }

  const { data: profileRow } = await db
    .from("profiles")
    .select("email,full_name")
    .eq("id", order.user_id)
    .single();

  // Prefer the pay-for-me link if one exists; otherwise send them to orders.
  const { data: link } = await db
    .from("payment_links")
    .select("token")
    .eq("order_id", orderId)
    .maybeSingle();
  const payUrl = link?.token ? `${PUBLIC_ORIGIN}/pay/${link.token}` : `${PUBLIC_ORIGIN}/orders`;
  const amount = formatNaira(order.total);

  if (!profileRow?.email) return json({ error: "Customer email is unavailable" }, 422);
  if (!RESEND_API_KEY) return json({ error: "Email service is not configured" }, 503);

  // Resend retains idempotency keys for 24 hours. Initial reminders are once
  // per order; manual reminders use five-minute windows to absorb retries and
  // double taps while still allowing a later follow-up.
  const dedupeKey = source === "initial"
    ? `payment-reminder/initial/${orderId}`
    : `payment-reminder/manual/${orderId}/${Math.floor(Date.now() / (5 * 60 * 1000))}`;

  const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": dedupeKey,
      },
      body: JSON.stringify({
        from: "Dritchwear <noreply@dritchwear.com>",
        reply_to: "support@dritchwear.com",
        to: [profileRow.email],
        subject: "Complete your Dritchwear payment",
        html: buildHtml({ name: profileRow?.full_name || "there", amount, payUrl }),
      }),
    }).catch(() => null);
  const responseBody = response ? await response.json().catch(() => ({})) as { id?: string; message?: string } : {};
  if (!response?.ok) {
    return json({ error: responseBody.message || "Email provider rejected the reminder" }, 502);
  }

  await db.from("notifications").insert({
    user_id: order.user_id,
    title: "Complete your payment",
    message: `Your order of ${amount} is awaiting payment. Tap to complete checkout.`,
    type: "order",
    url: payUrl,
  });
  return json({ success: true, emailed: true, payUrl, providerId: responseBody.id || null });
});
