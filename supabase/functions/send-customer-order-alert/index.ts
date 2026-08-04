import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const WEB_PUSH_VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") || "";
const WEB_PUSH_VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") || "";
const WEB_PUSH_VAPID_SUBJECT = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:support@dritchwear.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const EMAILABLE_ENTITY_TYPES = new Set(["order", "custom_order"]);

async function sendOrderStatusEmail(email: string, fullName: string | null, title: string, message: string, url: string | null) {
  const name = String(fullName || "there").replace(/[<>&"]/g, "");
  const link = `https://app.dritchwear.com${url || "/orders"}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1f6;font-family:Arial,sans-serif;color:#17131c"><table width="100%" role="presentation"><tr><td align="center" style="padding:28px 12px"><table width="600" role="presentation" style="width:100%;max-width:600px;background:#fff;border-collapse:collapse"><tr><td style="padding:24px 28px;background:#5a2d82;color:#fff;font-size:21px;font-weight:700">DRITCHWEAR</td></tr><tr><td style="padding:32px 28px;text-align:left"><div style="font-size:12px;font-weight:700;letter-spacing:1.2px;color:#5a2d82">ORDER UPDATE</div><h1 style="font-size:23px;line-height:1.3;margin:9px 0 10px">Hi ${name}, ${title.toLowerCase()}</h1><p style="font-size:15px;line-height:1.7;color:#665f6c">${message}</p><a href="${link}" style="display:inline-block;margin-top:10px;padding:13px 22px;background:#5a2d82;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">VIEW YOUR ORDER</a></td></tr><tr><td style="padding:22px 28px;background:#f8f7f9;text-align:left;font-size:12px;line-height:1.7;color:#746d79">support@dritchwear.com</td></tr></table></td></tr></table></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Dritchwear <noreply@dritchwear.com>", reply_to: "support@dritchwear.com", to: [email], subject: title, html }),
  });
  if (!response.ok) throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
}

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
      url: (data.url as string) || "/orders",
      data: { ...data, type: "order" },
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

  const { data: alert } = await db.from("customer_order_alerts").select("*").eq("id", alertId).single();
  if (!alert) return json({ error: "Alert not found" }, 404);
  if (alert.delivered_at) return json({ success: true, alreadyDelivered: true });

  // Claim the alert up front so a concurrent or pg_net-retried invocation
  // can't send a second copy.
  const { data: claimed } = await db.from("customer_order_alerts")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", alertId)
    .is("delivered_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return json({ success: true, alreadyDelivered: true });

  if (!alert.user_id) return json({ success: true, skipped: "no user_id" });

  await db.from("notifications").insert({
    user_id: alert.user_id,
    title: alert.title,
    message: alert.message,
    type: "order",
    data: { entity_type: alert.entity_type, entity_id: alert.entity_id, url: alert.url },
  });

  const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", alert.user_id);

  let pushCount = 0;
  for (const row of tokens ?? []) {
    const pushed = await sendPush(row.token, alert.title, alert.message, {
      type: "order",
      entityType: alert.entity_type,
      entityId: alert.entity_id,
      url: alert.url,
    }).catch(() => false);
    if (pushed) pushCount++;
  }

  await db.from("customer_order_alerts").update({ push_sent_count: pushCount }).eq("id", alert.id);

  let emailed = false;
  if (alert.should_email && RESEND_API_KEY && EMAILABLE_ENTITY_TYPES.has(alert.entity_type)) {
    try {
      const { data: profile } = await db.from("profiles").select("email,full_name").eq("id", alert.user_id).single();
      if (profile?.email) {
        await sendOrderStatusEmail(profile.email, profile.full_name, alert.title, alert.message, alert.url);
        emailed = true;
      }
    } catch (emailError) {
      console.error("Failed to send order status email:", emailError);
    }
  }

  return json({ success: true, pushCount, emailed });
});
