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

function esc(value: string): string {
  return value.replace(/[<>&"]/g, "");
}

function firstNameOf(fullName: string | null): string {
  const name = String(fullName || "").trim();
  return name ? esc(name.split(/\s+/)[0]) : "there";
}

// Delivery guarantee clock starts at order confirmation, not order placement
// or shipment - matches how the 7-day window is communicated to the buyer.
function daysRemainingFrom(confirmedAt: string | null | undefined): number {
  if (!confirmedAt) return 7;
  const elapsedMs = Date.now() - new Date(confirmedAt).getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(7 - elapsedDays, 1);
}

function emailShell(eyebrow: string, heading: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1f6;font-family:Arial,sans-serif;color:#17131c"><table width="100%" role="presentation"><tr><td align="center" style="padding:28px 12px"><table width="600" role="presentation" style="width:100%;max-width:600px;background:#fff;border-collapse:collapse"><tr><td style="padding:24px 28px;background:#5a2d82;color:#fff;font-size:21px;font-weight:700">DRITCHWEAR</td></tr><tr><td style="padding:32px 28px;text-align:left"><div style="font-size:12px;font-weight:700;letter-spacing:1.2px;color:#5a2d82">${eyebrow}</div><h1 style="font-size:23px;line-height:1.3;margin:9px 0 10px">${heading}</h1>${bodyHtml}<a href="${ctaUrl}" style="display:inline-block;margin-top:14px;padding:13px 22px;background:#5a2d82;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">${ctaLabel}</a></td></tr><tr><td style="padding:22px 28px;background:#f8f7f9;text-align:left;font-size:12px;line-height:1.7;color:#746d79">support@dritchwear.com</td></tr></table></td></tr></table></body></html>`;
}

function guaranteeNote(): string {
  return `<p style="margin:14px 0 0;padding:12px 14px;background:#fff7ed;border-radius:8px;font-size:13px;line-height:1.7;color:#92400e">💛 Our promise: if this order isn't delivered within 7 days of confirmation, we'll automatically credit ₦1,000 to your Dritchwear wallet.</p>`;
}

interface OrderEmailContext {
  tracking_number: string | null;
  tracking_link: string | null;
  confirmed_at: string | null;
}

function buildOrderEmailContent(
  alertTitle: string,
  fallbackMessage: string,
  firstName: string,
  order: OrderEmailContext | null,
  fallbackUrl: string
): { subject: string; heading: string; bodyHtml: string; ctaLabel: string; ctaUrl: string } {
  switch (alertTitle) {
    case "Payment received":
      return {
        subject: alertTitle,
        heading: `Thank you, ${firstName}!`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">We've received your payment and your order is now in review. We'll let you know as it progresses.</p>`,
        ctaLabel: "VIEW YOUR ORDER",
        ctaUrl: fallbackUrl,
      };
    case "Order confirmed":
      return {
        subject: alertTitle,
        heading: `Hi ${firstName}, your order has been confirmed`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">Great news - your order has been confirmed and we're getting it ready. Estimated delivery: within 7 days.</p>${guaranteeNote()}`,
        ctaLabel: "VIEW YOUR ORDER",
        ctaUrl: fallbackUrl,
      };
    case "Order processing":
      return {
        subject: alertTitle,
        heading: `Hi ${firstName}, your order is being processed`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">We're preparing your order now. We'll send you shipping details and a tracking number as soon as it's on its way.</p>`,
        ctaLabel: "VIEW YOUR ORDER",
        ctaUrl: fallbackUrl,
      };
    case "Order shipped 🚚": {
      const days = daysRemainingFrom(order?.confirmed_at);
      const trackingLine = order?.tracking_number
        ? `<p style="font-size:15px;line-height:1.7;color:#665f6c;margin-top:0"><strong>Tracking number:</strong> ${esc(order.tracking_number)}</p>`
        : "";
      return {
        subject: alertTitle,
        heading: `Hi ${firstName}, your order is on its way! 🚚`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">Your order has shipped and should arrive at your doorstep within the next ${days} day${days === 1 ? "" : "s"}.</p>${trackingLine}${guaranteeNote()}`,
        ctaLabel: order?.tracking_link ? "TRACK YOUR PACKAGE" : "VIEW YOUR ORDER",
        ctaUrl: order?.tracking_link || fallbackUrl,
      };
    }
    case "Order delivered 📦":
      return {
        subject: alertTitle,
        heading: `Hi ${firstName}, your order has been delivered! 📦`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">We hope you love it! Thanks so much for shopping with Dritchwear.</p>`,
        ctaLabel: "VIEW YOUR ORDER",
        ctaUrl: fallbackUrl,
      };
    case "Order cancelled":
      return {
        subject: alertTitle,
        heading: `Hi ${firstName}, your order has been cancelled`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">Your order has been cancelled. If you paid online, a refund has been issued to your Dritchwear wallet.</p>`,
        ctaLabel: "VIEW YOUR ORDER",
        ctaUrl: fallbackUrl,
      };
    case "Payment failed":
      return {
        subject: alertTitle,
        heading: `Hi ${firstName}, your payment didn't go through`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">We couldn't complete your payment for this order. Please try again from your orders page.</p>`,
        ctaLabel: "VIEW YOUR ORDER",
        ctaUrl: fallbackUrl,
      };
    case "Order refunded":
      return {
        subject: alertTitle,
        heading: `Hi ${firstName}, your order has been refunded`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">Your payment for this order has been refunded to your Dritchwear wallet.</p>`,
        ctaLabel: "VIEW YOUR ORDER",
        ctaUrl: fallbackUrl,
      };
    default:
      // Custom-order statuses, the late-delivery compensation alert, and
      // anything else not special-cased above - use the trigger's own copy.
      return {
        subject: alertTitle,
        heading: `Hi ${firstName}, ${alertTitle.toLowerCase()}`,
        bodyHtml: `<p style="font-size:15px;line-height:1.7;color:#665f6c">${fallbackMessage}</p>`,
        ctaLabel: "VIEW YOUR ORDER",
        ctaUrl: fallbackUrl,
      };
  }
}

async function sendOrderStatusEmail(
  email: string,
  fullName: string | null,
  alertTitle: string,
  fallbackMessage: string,
  url: string | null,
  entityType: string,
  entityId: string | null
) {
  const firstName = firstNameOf(fullName);
  const fallbackUrl = `https://app.dritchwear.com${url || "/orders"}`;

  let order: OrderEmailContext | null = null;
  if (entityType === "order" && entityId) {
    const { data } = await db.from("orders").select("tracking_number, tracking_link, confirmed_at").eq("id", entityId).single();
    order = data;
  }

  const { subject, heading, bodyHtml, ctaLabel, ctaUrl } = buildOrderEmailContent(alertTitle, fallbackMessage, firstName, order, fallbackUrl);
  const html = emailShell("ORDER UPDATE", heading, bodyHtml, ctaLabel, ctaUrl);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Dritchwear <noreply@dritchwear.com>", reply_to: "support@dritchwear.com", to: [email], subject, html }),
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
        await sendOrderStatusEmail(profile.email, profile.full_name, alert.title, alert.message, alert.url, alert.entity_type, alert.entity_id);
        emailed = true;
      }
    } catch (emailError) {
      console.error("Failed to send order status email:", emailError);
    }
  }

  return json({ success: true, pushCount, emailed });
});
