import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import webpush from "npm:web-push@3.6.7";
import { esc, p, infoBox, summaryCard, emailShell, type EmailFact } from "../_shared/emailBrand.ts";

const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const WEB_PUSH_VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") || "";
const WEB_PUSH_VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") || "";
const WEB_PUSH_VAPID_SUBJECT = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:support@dritchwear.com";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const EMAILABLE_ENTITY_TYPES = new Set(["order", "custom_order"]);
const WHATSAPP_URL = "https://wa.me/2349110163722";
const SITE_URL = "https://app.dritchwear.com";

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

function guaranteeNote(): string {
  return infoBox("Estimated delivery is within 7 days of confirmation. If it's taking longer than expected, message us on WhatsApp and we'll sort it out.");
}

// GIGL only handles deliveries outside Lagos - Lagos orders go out directly,
// so the GIGL notices below don't apply to them. Within Lagos, a handful of
// far-out areas are also unreachable in practice (riders won't take the
// trip, or price it prohibitively) - those get their own note instead.
function isLagos(state: string | null | undefined): boolean {
  return String(state || "").trim().toLowerCase().includes("lagos");
}

const LAGOS_EXCLUDED_AREAS_NOTE =
  "<strong style=\"color:#17131C\">Delivery Information</strong><br/>We're currently unable to deliver to a few far-out Lagos areas: <strong style=\"color:#17131C\">Badagry</strong>, <strong style=\"color:#17131C\">Epe and areas past Awoyaya</strong>, <strong style=\"color:#17131C\">deep Ikorodu</strong> (Owutu, Igbogbo, Ijede), <strong style=\"color:#17131C\">Okokomaiko / Ojo / Trade Fair</strong>, and <strong style=\"color:#17131C\">Agbara</strong>. If your order is headed to one of these areas, message us on WhatsApp so we can sort out delivery.";

function deliveryNotice(deliveryState: string | null | undefined): string {
  if (isLagos(deliveryState)) return infoBox(LAGOS_EXCLUDED_AREAS_NOTE);
  return infoBox(
    "<strong style=\"color:#17131C\">Delivery Information</strong><br/>For deliveries outside Lagos, your order will be shipped through <strong style=\"color:#17131C\">God Is Good Logistics (GIGL)</strong> or <strong style=\"color:#17131C\">Speedaf</strong>. Depending on your delivery location, your package may be delivered to your doorstep or made available for pickup at the nearest office. We currently ship only to locations covered by these carriers' delivery networks. If your selected location requires pickup, we'll notify you of the pickup location once your order has been dispatched."
  );
}

function shippedDeliveryNote(deliveryState: string | null | undefined): string {
  if (isLagos(deliveryState)) return infoBox(LAGOS_EXCLUDED_AREAS_NOTE);
  return infoBox(
    "<strong style=\"color:#17131C\">Delivery Information</strong><br/>Your order has been shipped via <strong style=\"color:#17131C\">God Is Good Logistics (GIGL)</strong> or <strong style=\"color:#17131C\">Speedaf</strong>. Please note that the final delivery method depends on their coverage for your location - some locations are eligible for <strong style=\"color:#17131C\">doorstep delivery</strong>, while others require <strong style=\"color:#17131C\">pickup</strong> from the nearest office. We currently ship only to locations served by these carriers. If your shipment requires pickup, you'll be notified when it's ready for collection."
  );
}

interface OrderItemSummary {
  name?: string;
  size?: string;
  color?: string;
  quantity?: number;
}

function orderCard(cardTitle: string, items: OrderItemSummary[], facts: EmailFact[]): string {
  const itemsHtml = (items || []).map((item, index) => {
    const meta = [item.size ? `Size: ${esc(item.size)}` : "", item.color ? `Colour: ${esc(item.color)}` : ""].filter(Boolean).join(" &nbsp;&bull;&nbsp; ");
    return `<div style="font-size:14px;font-weight:700;color:#17131C;margin:${index === 0 ? "0" : "14px"} 0 4px 0">${esc(item.name || "Item")}</div>${meta ? `<div style="font-size:12px;color:#8A838F;margin:0 0 4px 0">${meta}</div>` : ""}<div style="font-size:12px;color:#8A838F">Qty: ${item.quantity ?? 1}</div>`;
  }).join("");
  return summaryCard(cardTitle, itemsHtml, facts);
}

interface OrderEmailContext {
  items: OrderItemSummary[] | null;
  tracking_number: string | null;
  tracking_link: string | null;
  confirmed_at: string | null;
  payment_status: string | null;
  total: number | null;
  currency: string | null;
  delivery_state: string | null;
  customization_fee: number | null;
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
  const viewOrder = { label: "View Your Order", url: fallbackUrl };
  const shopAgain = { label: "Shop Again at Dritchwear.com", url: `${SITE_URL}/shop` };
  const whatsapp = { label: "Message Us on WhatsApp", url: WHATSAPP_URL };
  const customizationNote = order?.customization_fee && order.customization_fee > 0
    ? p(`<strong style="color:#17131C">Customization</strong><br/>Your order includes a custom design. The customization fee (${naira(order.customization_fee)}) has been included in your total.`, 18)
    : "";

  switch (alertTitle) {
    case "Payment received":
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Payment Received",
          headline: `Thank you, ${firstName}!`,
          bodyHtml: p("We've received your payment for your Dritchwear order. It's now in review and we'll begin preparing it shortly.", 18)
            + orderCard("Order Summary", items, [{ label: "Order Number", value: orderNum }, { label: "Status", value: "In Review", highlight: true }])
            + customizationNote
            + deliveryNotice(order?.delivery_state),
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
          headline: "Your order has been confirmed.",
          bodyHtml: p(`Hi ${firstName}, great news - your order has been confirmed and we're getting it ready. Estimated delivery: within 7 days.`, 18)
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
          headline: "Your order is being prepared.",
          bodyHtml: p("We're working on your order now. We'll send tracking details as soon as it ships.", 18)
            + orderCard("Order Summary", items, [{ label: "Order Number", value: orderNum }, { label: "Status", value: "Processing", highlight: true }]),
          ctaPrimaryLabel: whatsapp.label, ctaPrimaryUrl: whatsapp.url,
          ctaSecondaryLabel: viewOrder.label, ctaSecondaryUrl: viewOrder.url,
          footerNote: "Thanks for your patience while we get this made just right.",
        }),
      };
    case "Order shipped 🚚": {
      const days = daysRemainingFrom(order?.confirmed_at);
      const facts: EmailFact[] = [];
      if (order?.tracking_number) facts.push({ label: "Tracking Number", value: esc(order.tracking_number) });
      facts.push({ label: "Estimated Delivery", value: `Within ${days} day${days === 1 ? "" : "s"}` });
      const secondary = order?.tracking_link ? { label: "Track Your Package", url: esc(order.tracking_link) } : viewOrder;
      return {
        subject: alertTitle,
        html: emailShell({
          eyebrow: "Order Update &middot; Shipped",
          headline: "Your order is on its way!",
          bodyHtml: p(`Hi ${firstName}, your order has shipped and should arrive within the next ${days} day${days === 1 ? "" : "s"}.`, 18)
            + orderCard("Order Summary", items, facts)
            + shippedDeliveryNote(order?.delivery_state)
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
          headline: "Your order has been delivered!",
          bodyHtml: p("We hope you love it! Thank you so much for shopping with Dritchwear.", 18)
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
            headline: "We've processed your refund.",
            bodyHtml: p(`Hi ${firstName}, thank you for your order with Dritchwear - we really appreciate it.`)
              + p("Unfortunately we're unable to fulfil this order, so we've cancelled it and are issuing a full refund.", 18)
              + orderCard("Order Summary", items, [
                { label: "Refund Status", value: "Processing", highlight: true },
                { label: "Refund Amount", value: amount },
                { label: "Refund Timeline", value: "1 to 7 business days" },
                { label: "Refund Destination", value: "Dritchwear Wallet" },
              ])
              + p(`Your ${amount} refund will reflect in your Dritchwear wallet within <strong style="color:#17131C">1 to 7 business days</strong>. You don't need to do anything - it will process automatically. You can use it toward a new order anytime.`, 18),
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
          headline: "Your order has been cancelled.",
          bodyHtml: p(`Hi ${firstName}, your order has been cancelled. Since no payment was made for this order, there's nothing to refund.`, 18)
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
          headline: "Your payment didn't go through.",
          bodyHtml: p(`Hi ${firstName}, we couldn't complete your payment for this order. No charge was made.`, 18)
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
          headline: "We've refunded your order.",
          bodyHtml: p(`Hi ${firstName}, your payment for this order is being refunded.`, 18)
            + orderCard("Order Summary", items, [
              { label: "Refund Status", value: "Processing", highlight: true },
              { label: "Refund Amount", value: amount },
              { label: "Refund Timeline", value: "1 to 7 business days" },
              { label: "Refund Destination", value: "Dritchwear Wallet" },
            ])
            + p(`Your ${amount} refund will reflect in your Dritchwear wallet within <strong style="color:#17131C">1 to 7 business days</strong>. You don't need to do anything - it will process automatically.`, 18),
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
          bodyHtml: p(`Hi ${firstName}, ${esc(fallbackMessage)}`, 18),
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
    const { data } = await db.from("orders").select("items, tracking_number, tracking_link, confirmed_at, payment_status, total, currency, delivery_state, customization_fee").eq("id", entityId).single();
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
