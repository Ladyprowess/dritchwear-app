import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import webpush from "npm:web-push@3.6.7";
import { esc, p, emailShell } from "../_shared/emailBrand.ts";

const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WEB_PUSH_VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") || "";
const WEB_PUSH_VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") || "";
const WEB_PUSH_VAPID_SUBJECT = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:support@dritchwear.com";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

if (WEB_PUSH_VAPID_PRIVATE_KEY && WEB_PUSH_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(WEB_PUSH_VAPID_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY);
}

function isWebPushToken(token: string) {
  return token.trim().startsWith("{");
}

async function sendPush(token: string, title: string, message: string, data: Record<string, unknown>) {
  if (isWebPushToken(token)) {
    if (!WEB_PUSH_VAPID_PRIVATE_KEY || !WEB_PUSH_VAPID_PUBLIC_KEY) throw new Error("Web push is not configured");
    await webpush.sendNotification(JSON.parse(token), JSON.stringify({
      title,
      body: message,
      message,
      type: "order",
      url: "/orders",
      data: { ...data, type: "order", url: "/orders" },
    }));
    return true;
  }

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: token, sound: "default", title, body: message, data, priority: "high", badge: 1 }),
  }).catch(() => null);
  return !!response?.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const input = await req.json().catch(() => ({})) as any;
  const alertId = String(input.alertId || "");
  if (!alertId) return json({ error: "Missing alert id" }, 400);

  const { data: alert } = await db.from("admin_alerts").select("*").eq("id", alertId).single();
  if (!alert) return json({ error: "Alert not found" }, 404);
  if (alert.delivered_at && Number(alert.email_sent_count || 0) > 0) {
    return json({ success: true, alreadyDelivered: true });
  }
  // Older failed attempts may have set delivered_at before Resend accepted the
  // email. Release that stale claim so an explicit retry can recover it.
  if (alert.delivered_at) {
    await db.from("admin_alerts").update({ delivered_at: null }).eq("id", alertId).eq("email_sent_count", 0);
  }

  // Claim the alert up front so a concurrent or pg_net-retried invocation
  // can't send a second copy. If another call already claimed it, bail.
  const { data: claimed } = await db.from("admin_alerts")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", alertId)
    .is("delivered_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return json({ success: true, alreadyDelivered: true });

  const { data: admins } = await db.from("profiles").select("id,email,full_name").eq("role", "admin");
  const adminIds = (admins ?? []).map((admin: any) => admin.id);
  // Send to each admin's email once. Only fall back to the support inbox when
  // there are no admin emails - sending to both caused duplicate alerts.
  const adminEmails = (admins ?? []).map((admin: any) => admin.email).filter(Boolean);
  const emails = Array.from(new Set(adminEmails.length ? adminEmails : ["support@dritchwear.com"]));
  const { data: tokens } = adminIds.length ? await db.from("push_tokens").select("token").in("user_id", adminIds) : { data: [] as any[] };

  let pushCount = 0;
  for (const row of tokens ?? []) {
    const pushed = await sendPush(row.token, alert.title, alert.message, { type: alert.type, alertId: alert.id, orderId: alert.entity_id }).catch(() => false);
    if (pushed) pushCount++;
  }

  // Chat messages are frequent and time-sensitive - push only, no email per
  // message (that would spam admin inboxes). Order/custom-order alerts keep
  // the original push + email behavior below.
  if (alert.type === "chat") {
    await db.from("admin_alerts").update({ delivered_at: new Date().toISOString(), push_sent_count: pushCount }).eq("id", alert.id);
    return json({ success: true, pushCount });
  }

  if (!RESEND_API_KEY) {
    await db.from("admin_alerts").update({ delivered_at: null, push_sent_count: pushCount }).eq("id", alert.id);
    return json({ error: "Email service is not configured" }, 503);
  }

  const html = emailShell({
    eyebrow: "New Order Alert",
    headline: esc(alert.title),
    bodyHtml: p(esc(alert.message), 18),
    ctaPrimaryLabel: "Open Admin Orders",
    ctaPrimaryUrl: "https://app.dritchwear.com/orders",
    footerNote: "This operational alert was sent because a new order reached Dritchwear.",
  });

  let emailCount = 0;
  for (const email of emails) {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `admin-order-alert/${alert.id}/${email}` }, body: JSON.stringify({ from: "Dritchwear Orders <noreply@dritchwear.com>", reply_to: "support@dritchwear.com", to: [email], subject: `Dritchwear: ${alert.title}`, html }) }).catch(() => null);
      if (response?.ok) emailCount++;
  }

  if (emailCount === 0) {
    await db.from("admin_alerts").update({ delivered_at: null, push_sent_count: pushCount, email_sent_count: 0 }).eq("id", alert.id);
    return json({ error: "Email provider rejected the admin alert", pushCount }, 502);
  }

  await db.from("admin_alerts").update({ delivered_at: new Date().toISOString(), push_sent_count: pushCount, email_sent_count: emailCount }).eq("id", alert.id);
  return json({ success: true, pushCount, emailCount });
});
