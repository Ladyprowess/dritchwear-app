// Dritchwear - Payment reminder to the customer.
// Emails the customer (via Resend) and drops an in-app notification asking
// them to complete payment for an order still in `pending_payment`.
// Triggered from the app: admin "Send payment reminder" button, and
// automatically when a pay-for-me order is placed.
// Requires RESEND_API_KEY + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY secrets.
// Deploy: supabase functions deploy send-payment-reminder
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import { esc, p, emailShell } from "../_shared/emailBrand.ts";

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

const formatNaira = (amount: number) =>
  "₦" + (Number(amount) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildHtml(opts: { name: string; amount: string; payUrl: string }) {
  const name = esc(opts.name);
  return emailShell({
    eyebrow: "Complete Your Payment",
    headline: `Hi ${name}, your order is waiting`,
    bodyHtml: p(`You placed an order of <strong>${esc(opts.amount)}</strong>, but payment hasn't been completed yet. Your items are reserved - finish checkout to confirm your order.`, 18),
    ctaPrimaryLabel: "Complete Payment",
    ctaPrimaryUrl: opts.payUrl,
    footerNote: "Already paid? You can safely ignore this email.",
  });
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
    .select("id,user_id,total,payment_status,order_status")
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

  // Never nag about an order that is already paid, or one that's been
  // cancelled - cancelling an order that was never paid doesn't touch
  // payment_status (it stays 'pending_payment' forever), so order_status
  // needs its own check here rather than relying on payment_status alone.
  if (order.payment_status !== "pending_payment" || order.order_status === "cancelled") {
    return json({ success: true, skipped: "not_pending" });
  }

  const { data: profileRow } = await db
    .from("profiles")
    .select("email,full_name")
    .eq("id", order.user_id)
    .single();

  // Prefer the pay-for-me link if one exists (regular card-checkout orders
  // don't have one - Paystack there needs the app open, not a standalone
  // page); otherwise deep-link straight to this order instead of the bare list.
  const { data: link } = await db
    .from("payment_links")
    .select("token")
    .eq("order_id", orderId)
    .maybeSingle();
  const payUrl = link?.token ? `${PUBLIC_ORIGIN}/pay/${link.token}` : `${PUBLIC_ORIGIN}/orders?orderId=${orderId}`;
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
