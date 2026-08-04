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

// ── Brand ─────────────────────────────────────────────────────────────────
const BRAND = "#5a2d82";
const BG = "#0c0818";
const CARD_BG = "#1a1233";
const CARD_BORDER = "#2d1f4a";
const TEXT_MUTED = "#a090c0";
const TEXT_FAINT = "#6a5880";
const TEXT_LIGHT = "#e8dff5";
const WHATSAPP_URL = "https://wa.me/2349110163722";
const SITE_URL = "https://app.dritchwear.com";

function esc(value: string): string {
  return value.replace(/[<>&"]/g, "");
}

// For URLs used as href values: esc() strips "&" outright, which mangles any
// URL with more than one query param (e.g. ?id=1&carrier=dhl -> ?id=1carrier=dhl).
// Attributes need real entity-encoding, not character deletion.
function escAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function firstNameOf(fullName: string | null): string {
  const name = String(fullName || "").trim();
  return name ? esc(name.split(/\s+/)[0]) : "there";
}

function naira(amount: number): string {
  return `₦${Math.round(amount || 0).toLocaleString("en-US")}`;
}

function orderNumber(orderId: string): string {
  return `OR-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// Delivery guarantee clock starts at order confirmation, not order placement
// or shipment - matches how the 7-day window is communicated to the buyer.
function daysRemainingFrom(confirmedAt: string | null | undefined): number {
  if (!confirmedAt) return 7;
  const elapsedMs = Date.now() - new Date(confirmedAt).getTime();
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(7 - elapsedDays, 1);
}

function p(text: string, marginBottom = 16): string {
  return `<p style="font-family:'DM Sans',sans-serif;font-size:16px;color:${TEXT_MUTED};line-height:1.9;margin:0 0 ${marginBottom}px 0">${text}</p>`;
}

function guaranteeNote(): string {
  return `<div style="background:${CARD_BG};border-left:3px solid ${BRAND};border-radius:4px;padding:14px 18px;margin:0 0 40px 0"><p style="font-family:'DM Sans',sans-serif;font-size:13px;color:${TEXT_LIGHT};line-height:1.7;margin:0">Estimated delivery is within 7 days of confirmation. If it's taking longer than expected, message us on WhatsApp and we'll sort it out.</p></div>`;
}

interface OrderItemSummary {
  name?: string;
  size?: string;
  color?: string;
  quantity?: number;
}

interface Fact {
  label: string;
  value: string;
  highlight?: boolean;
}

function orderCard(cardTitle: string, items: OrderItemSummary[], facts: Fact[]): string {
  const itemsHtml = (items || []).map((item, index) => {
    const meta = [item.size ? `Size: ${esc(item.size)}` : "", item.color ? `Colour: ${esc(item.color)}` : ""].filter(Boolean).join(" &nbsp;&bull;&nbsp; ");
    return `<p style="font-family:'DM Sans',sans-serif;font-size:15px;color:${TEXT_LIGHT};font-weight:600;margin:${index === 0 ? "0" : "16px"} 0 8px 0">${esc(item.name || "Item")}</p>${meta ? `<p style="font-family:'DM Sans',sans-serif;font-size:13px;color:${TEXT_FAINT};margin:0 0 6px 0">${meta}</p>` : ""}<p style="font-family:'DM Sans',sans-serif;font-size:13px;color:${TEXT_FAINT};margin:0">Qty: ${item.quantity ?? 1}</p>`;
  }).join("");

  const factsHtml = facts.length
    ? `<div style="border-top:1px solid ${CARD_BORDER};margin:20px 0"></div><table width="100%" cellpadding="0" cellspacing="0">${facts.map((fact, i) => `<tr><td style="font-family:'DM Sans',sans-serif;font-size:13px;color:${TEXT_FAINT};padding-bottom:${i === facts.length - 1 ? "0" : "10"}px">${fact.label}</td><td style="font-family:'DM Sans',sans-serif;font-size:13px;color:${fact.highlight ? BRAND : TEXT_LIGHT};font-weight:700;text-align:right;padding-bottom:${i === facts.length - 1 ? "0" : "10"}px">${fact.value}</td></tr>`).join("")}</table>`
    : "";

  return `<div class="order-card" style="background:${CARD_BG};border:1px solid ${CARD_BORDER};border-radius:6px;padding:28px;margin:0 0 48px 0"><p style="font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;color:${BRAND};text-transform:uppercase;margin:0 0 18px 0">${cardTitle}</p>${itemsHtml}${factsHtml}</div>`;
}

function emailShell(opts: {
  eyebrow: string;
  headline: string;
  bodyHtml: string;
  ctaPrimaryLabel: string;
  ctaPrimaryUrl: string;
  ctaSecondaryLabel?: string;
  ctaSecondaryUrl?: string;
  footerNote: string;
}): string {
  const secondaryButton = opts.ctaSecondaryLabel && opts.ctaSecondaryUrl
    ? `<a href="${opts.ctaSecondaryUrl}" style="display:block;background:${CARD_BG};color:${TEXT_MUTED};text-align:center;padding:18px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;text-decoration:none;border-radius:4px;border:1px solid ${CARD_BORDER};margin:0 0 52px 0">${opts.ctaSecondaryLabel}</a>`
    : `<div style="margin-bottom:40px"></div>`;

  return `<div style="background:${BG};font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;padding:0;margin:0">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
@media only screen and (max-width:600px) {
  .email-body { padding: 40px 24px !important; }
  .headline { font-size: 32px !important; }
  .order-card { padding: 20px !important; }
}
</style>
<div class="email-body" style="max-width:600px; margin:0 auto; padding:56px 44px; background:${BG};">
  <p style="font-family:'DM Sans',sans-serif; font-size:11px; font-weight:700; letter-spacing:0.18em; color:${BRAND}; text-transform:uppercase; margin:0 0 28px 0;">${opts.eyebrow}</p>
  <h1 class="headline" style="font-family:'Cormorant Garamond',Georgia,serif; font-size:40px; font-weight:700; color:#ffffff; line-height:1.15; margin:0 0 28px 0;">${opts.headline}</h1>
  ${opts.bodyHtml}
  <a href="${opts.ctaPrimaryUrl}" style="display:block; background:${BRAND}; color:#ffffff; text-align:center; padding:20px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; text-decoration:none; border-radius:4px; margin:0 0 12px 0;">${opts.ctaPrimaryLabel}</a>
  ${secondaryButton}
  <div style="border-top:1px solid #1e1230; padding-top:36px;">
    <p style="font-family:'DM Sans',sans-serif; font-size:15px; color:#7a6a90; line-height:1.85; margin:0;">${opts.footerNote}</p>
  </div>
</div>
</div>`;
}

interface OrderEmailContext {
  items: OrderItemSummary[] | null;
  tracking_number: string | null;
  tracking_link: string | null;
  confirmed_at: string | null;
  payment_status: string | null;
  total: number | null;
  currency: string | null;
}

function buildOrderEmailContent(
  alertTitle: string,
  fallbackMessage: string,
  firstName: string,
  order: OrderEmailContext | null,
  entityId: string | null,
  fallbackUrl: string
): { subject: string; html: string } {
  const items = order?.items || [];
  const orderNum = entityId ? orderNumber(entityId) : "";
  const viewOrder = { label: "VIEW YOUR ORDER", url: fallbackUrl };
  const shopAgain = { label: "SHOP AGAIN AT DRITCHWEAR.COM", url: `${SITE_URL}/shop` };
  const whatsapp = { label: "MESSAGE US ON WHATSAPP", url: WHATSAPP_URL };

  switch (alertTitle) {
    case "Payment received":
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Payment Received",
          headline: `Thank you,<br>${firstName}!`,
          bodyHtml: p("We've received your payment for your Dritchwear order. It's now in review and we'll begin preparing it shortly.", 40)
            + orderCard("Order Summary", items, [{ label: "Order Number", value: orderNum }, { label: "Status", value: "In Review", highlight: true }]),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: viewOrder.label, ctaSecondaryUrl: viewOrder.url,
          footerNote: "We're excited to get this made for you. Reach out anytime if you have questions.",
        }),
      };
    case "Order confirmed":
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Confirmed",
          headline: "Your order has<br>been confirmed.",
          bodyHtml: p(`Hi ${firstName}, great news - your order has been confirmed and we're getting it ready. Estimated delivery: within 7 days.`, 40)
            + orderCard("Order Summary", items, [{ label: "Order Number", value: orderNum }, { label: "Estimated Delivery", value: "Within 7 days" }])
            + guaranteeNote(),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: viewOrder.label, ctaSecondaryUrl: viewOrder.url,
          footerNote: "Thank you for shopping with Dritchwear. We can't wait for you to receive this.",
        }),
      };
    case "Order processing":
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Processing",
          headline: "Your order is<br>being prepared.",
          bodyHtml: p("We're working on your order now. We'll send tracking details as soon as it ships.", 40)
            + orderCard("Order Summary", items, [{ label: "Order Number", value: orderNum }, { label: "Status", value: "Processing", highlight: true }]),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: viewOrder.label, ctaSecondaryUrl: viewOrder.url,
          footerNote: "Thanks for your patience while we get this made just right.",
        }),
      };
    case "Order shipped 🚚": {
      const days = daysRemainingFrom(order?.confirmed_at);
      const facts: Fact[] = [];
      if (order?.tracking_number) facts.push({ label: "Tracking Number", value: esc(order.tracking_number) });
      facts.push({ label: "Estimated Delivery", value: `Within ${days} day${days === 1 ? "" : "s"}` });
      const secondary = order?.tracking_link ? { label: "TRACK YOUR PACKAGE", url: escAttr(order.tracking_link) } : viewOrder;
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Shipped",
          headline: "Your order is<br>on its way!",
          bodyHtml: p(`Hi ${firstName}, your order has shipped and should arrive at your doorstep within the next ${days} day${days === 1 ? "" : "s"}.`, 40)
            + orderCard("Order Summary", items, facts)
            + guaranteeNote(),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: secondary.label, ctaSecondaryUrl: secondary.url,
          footerNote: "We hope it arrives safely and quickly. Thank you for shopping with Dritchwear.",
        }),
      };
    }
    case "Order delivered 📦":
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Delivered",
          headline: "Your order has<br>been delivered!",
          bodyHtml: p("We hope you love it! Thank you so much for shopping with Dritchwear.", 40)
            + orderCard("Order Summary", items, [{ label: "Order Number", value: orderNum }, { label: "Status", value: "Delivered", highlight: true }]),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: shopAgain.label, ctaSecondaryUrl: shopAgain.url,
          footerNote: "If anything isn't perfect, reach out - we want you to love what you ordered.",
        }),
      };
    case "Order cancelled": {
      const wasPaid = order?.payment_status === "refunded";
      if (wasPaid) {
        const amount = naira(order?.total || 0);
        return {
          subject: "Order cancelled - refund issued",
          html: emailShell({
            eyebrow: "Order Update &middot; Refund Issued",
            headline: "We've processed<br>your refund.",
            bodyHtml: p(`Hi ${firstName}, thank you for your order with Dritchwear - we really appreciate it.`)
              + p("Unfortunately we're unable to fulfil this order, so we've cancelled it and are issuing a full refund.", 40)
              + orderCard("Order Summary", items, [
                { label: "Refund Status", value: "Processing", highlight: true },
                { label: "Refund Amount", value: amount },
                { label: "Refund Timeline", value: "1 to 7 business days" },
                { label: "Refund Destination", value: "Dritchwear Wallet" },
              ])
              + p(`Your ${amount} refund will reflect in your Dritchwear wallet within <strong style="color:#ffffff">1 to 7 business days</strong>. You don't need to do anything - it will process automatically. You can use it toward a new order anytime.`, 40),
            ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
            ctaSecondaryLabel: shopAgain.label, ctaSecondaryUrl: shopAgain.url,
            footerNote: "We're sorry for the inconvenience and hope to have you back with us soon.",
          }),
        };
      }
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Cancelled",
          headline: "Your order has<br>been cancelled.",
          bodyHtml: p(`Hi ${firstName}, your order has been cancelled. Since no payment was made for this order, there's nothing to refund.`, 40)
            + orderCard("Order Summary", items, [{ label: "Order Number", value: orderNum }, { label: "Status", value: "Cancelled" }]),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: shopAgain.label, ctaSecondaryUrl: shopAgain.url,
          footerNote: "If this was a mistake or you'd like to reorder, we're happy to help.",
        }),
      };
    }
    case "Payment failed":
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Payment Failed",
          headline: "Your payment<br>didn't go through.",
          bodyHtml: p(`Hi ${firstName}, we couldn't complete your payment for this order. No charge was made.`, 40)
            + orderCard("Order Summary", items, [{ label: "Order Number", value: orderNum }, { label: "Status", value: "Payment Failed" }]),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: viewOrder.label, ctaSecondaryUrl: viewOrder.url,
          footerNote: "We're here if you run into any trouble completing your payment.",
        }),
      };
    case "Order refunded": {
      const amount = naira(order?.total || 0);
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Refund Issued",
          headline: "We've refunded<br>your order.",
          bodyHtml: p(`Hi ${firstName}, your payment for this order is being refunded.`, 40)
            + orderCard("Order Summary", items, [
              { label: "Refund Status", value: "Processing", highlight: true },
              { label: "Refund Amount", value: amount },
              { label: "Refund Timeline", value: "1 to 7 business days" },
              { label: "Refund Destination", value: "Dritchwear Wallet" },
            ])
            + p(`Your ${amount} refund will reflect in your Dritchwear wallet within <strong style="color:#ffffff">1 to 7 business days</strong>. You don't need to do anything - it will process automatically.`, 40),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: shopAgain.label, ctaSecondaryUrl: shopAgain.url,
          footerNote: "Thank you for your patience - reach out anytime if you have questions.",
        }),
      };
    }
    default:
      // Custom-order statuses, the late-delivery compensation alert, and
      // anything else not special-cased above - use the trigger's own copy.
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update",
          headline: esc(alertTitle),
          bodyHtml: p(`Hi ${firstName}, ${esc(fallbackMessage)}`, 40),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: viewOrder.label, ctaSecondaryUrl: viewOrder.url,
          footerNote: "Thank you for choosing Dritchwear.",
        }),
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
  const fallbackUrl = `${SITE_URL}${url || "/orders"}`;

  let order: OrderEmailContext | null = null;
  if (entityType === "order" && entityId) {
    const { data } = await db.from("orders").select("items, tracking_number, tracking_link, confirmed_at, payment_status, total, currency").eq("id", entityId).single();
    order = data;
  }

  const { subject, html } = buildOrderEmailContent(alertTitle, fallbackMessage, firstName, order, entityId, fallbackUrl);

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
