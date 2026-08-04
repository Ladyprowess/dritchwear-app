import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
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
  return json({ success: true, pushCount });
});
