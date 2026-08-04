import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const resendHeaders = {
  Authorization: `Bearer ${RESEND_API_KEY}`,
  "User-Agent": "Dritchwear/1.0 (support@dritchwear.com)",
};

// Most severe last, so we can pick the "worst"/most-advanced event for a recipient
// and derive a single aggregate status for the whole message.
const EVENT_PRIORITY = ["complained", "bounced", "delivery_delayed", "clicked", "opened", "delivered", "sent", "queued"];

type RecipientTracking = { email: string; provider_id: string | null; status: string; last_event: string | null; updated_at: string; sent_at?: string; delivered_at?: string; opened_at?: string; clicked_at?: string; bounced_at?: string; complained_at?: string };

function milestoneFields(event: string, at: string) {
  if (event === "clicked") return { delivered_at: at, opened_at: at, clicked_at: at };
  if (event === "opened") return { delivered_at: at, opened_at: at };
  if (event === "delivered") return { delivered_at: at };
  if (event === "bounced") return { bounced_at: at };
  if (event === "complained") return { complained_at: at };
  if (event === "sent") return { sent_at: at };
  return {};
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resend rate-limits (~2 req/s). Fetching a whole batch in a tight loop returns
// 429 for most requests, which is why tracking previously stayed stuck on "sent".
async function fetchResendEmail(providerId: string): Promise<any | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.resend.com/emails/${providerId}`, {
      headers: resendHeaders,
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  }
  return null;
}

async function recoverLegacyProviders(message: any) {
  const sendTime = new Date(message.created_at).getTime();
  const lowerBound = sendTime - 30 * 60 * 1000;
  const upperBound = sendTime + 30 * 60 * 1000;
  const candidates: any[] = [];
  let after = "";
  for (let page = 0; page < 10; page += 1) {
    const url = new URL("https://api.resend.com/emails");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const response = await fetch(url, { headers: resendHeaders });
    if (response.status === 429) { await sleep(1000); page -= 1; continue; }
    if (!response.ok) break;
    const result = await response.json().catch(() => null);
    const emails = Array.isArray(result?.data) ? result.data : [];
    candidates.push(...emails.filter((email: any) => {
      const createdAt = new Date(email?.created_at).getTime();
      return email?.subject === message.subject && createdAt >= lowerBound && createdAt <= upperBound;
    }));
    const oldest = emails.length ? new Date(emails[emails.length - 1]?.created_at).getTime() : 0;
    if (!result?.has_more || !emails.length || (oldest && oldest < lowerBound)) break;
    after = String(emails[emails.length - 1].id);
    await sleep(250);
  }

  const used = new Set<string>();
  return (message.recipients ?? []).map((recipient: string) => {
    const normalized = recipient.toLowerCase();
    const matches = candidates
      .filter(candidate => !used.has(candidate.id) && (candidate.to ?? []).some((to: string) => to.toLowerCase() === normalized))
      .sort((left, right) => Math.abs(new Date(left.created_at).getTime() - sendTime) - Math.abs(new Date(right.created_at).getTime() - sendTime));
    const match = matches[0] ?? null;
    if (match?.id) used.add(match.id);
    return match;
  });
}

function aggregateStatus(items: RecipientTracking[]): string {
  const events = items.map((item) => item.last_event || item.status).filter(Boolean) as string[];
  return EVENT_PRIORITY.find((state) => events.includes(state)) || "sent";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function safeHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "").replace(/<object[\s\S]*?<\/object>/gi, "").replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "");
}

function brandedHtml(content: string, format: "text" | "html", type: "customer" | "partner", previewText: string) {
  const body = format === "html" ? safeHtml(content) : escapeHtml(content).replace(/\n/g, "<br/>");
  const preheader = escapeHtml(previewText).slice(0, 180);
  const partnerFooter = `<tr><td class="pad" style="padding:26px 32px;border-top:1px solid #e8e3eb;background:#f8f7f9;text-align:center"><div style="font-size:15px;font-weight:700">Dritchwear Collections</div><div style="margin-top:10px;font-size:12px;line-height:1.7"><a href="https://dritchwear.com" style="color:#5a2d82">dritchwear.com</a> &nbsp;·&nbsp; <a href="mailto:support@dritchwear.com" style="color:#5a2d82">support@dritchwear.com</a></div><div style="margin-top:10px;font-size:11px;color:#746d79">© ${new Date().getUTCFullYear()} Dritchwear Collections. All rights reserved.</div></td></tr>`;
  const safetyRow = (number: number, text: string) => `<tr><td style="padding:0 0 10px"><table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid #e7e1ea;background:#fff"><tr><td width="48" valign="top" style="padding:16px 0 16px 16px"><div style="width:32px;height:32px;line-height:32px;text-align:center;border-radius:50%;background:#fdb813;color:#3d1e59;font-weight:700">${number}</div></td><td style="padding:16px;font-size:13px;line-height:1.65;color:#312c35">${text}</td></tr></table></td></tr>`;
  const customerFooter = `<tr><td class="pad" style="padding:28px 32px;border-top:1px solid #e8e3eb;background:#faf9fb"><div style="font-size:18px;font-weight:700;color:#17131c">Stay safe when shopping with us</div><div style="margin:7px 0 18px;font-size:13px;line-height:1.6;color:#665f6c">Keep these reminders close whenever you receive a Dritchwear message.</div><table width="100%" role="presentation" cellpadding="0" cellspacing="0">${safetyRow(1, "Dritchwear will never ask for your password, OTP, card PIN or CVV.")}${safetyRow(2, 'Only trust email from <strong>dritchwear.com</strong> and links that open <a href="https://dritchwear.com" style="color:#5a2d82">dritchwear.com</a>.')}${safetyRow(3, "Do not pay through an unfamiliar link or social-media account. Open the Dritchwear app directly to confirm your order.")}${safetyRow(4, 'If anything looks wrong, stop and contact <a href="mailto:support@dritchwear.com" style="color:#5a2d82">support@dritchwear.com</a>.')}</table></td></tr><tr><td class="pad" style="padding:28px 32px;background:#f3eff7;border-top:1px solid #ded3e6"><div style="font-size:18px;font-weight:700;color:#17131c">Install Dritchwear for the best experience</div><div style="margin-top:7px;font-size:13px;line-height:1.6;color:#665f6c">Order, track deliveries and manage payments from your home screen.</div><table class="stack" width="100%" role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td class="stack-cell" width="50%" valign="top" style="padding:0 14px 0 0;font-size:13px;line-height:1.65;color:#514a56"><strong style="display:block;color:#17131c;font-size:14px;margin-bottom:4px">iPhone</strong>Open <a href="https://app.dritchwear.com" style="color:#5a2d82">app.dritchwear.com</a> in Safari, tap Share, then Add to Home Screen.</td><td class="stack-cell" width="50%" valign="top" style="padding:0 0 0 14px;font-size:13px;line-height:1.65;color:#514a56"><strong style="display:block;color:#17131c;font-size:14px;margin-bottom:4px">Android</strong>Open <a href="https://app.dritchwear.com" style="color:#5a2d82">app.dritchwear.com</a> in Chrome, tap the menu, then Install app.</td></tr></table></td></tr><tr><td class="pad" style="padding:27px 32px;background:#fff;text-align:center;border-top:1px solid #e8e3eb"><div style="font-size:17px;font-weight:700;color:#17131c">Dritchwear Collections</div><div style="margin-top:13px;font-size:12px;line-height:1.8"><a href="https://app.dritchwear.com" style="color:#5a2d82">Shop &amp; track orders</a> &nbsp;·&nbsp; <a href="mailto:support@dritchwear.com" style="color:#5a2d82">Customer support</a> &nbsp;·&nbsp; <a href="https://dritchwear.com" style="color:#5a2d82">Website</a></div><div style="margin-top:11px;font-size:12px;color:#5a2d82;font-weight:700">Instagram &nbsp;·&nbsp; TikTok &nbsp;·&nbsp; LinkedIn &nbsp;·&nbsp; X</div><div style="margin-top:10px;font-size:11px;line-height:1.6;color:#746d79">support@dritchwear.com · dritchwear.com<br/>© ${new Date().getUTCFullYear()} Dritchwear Collections. All rights reserved.</div></td></tr>`;
  const leftAlignedPartnerFooter = partnerFooter.replace("text-align:center", "text-align:left");
  const editorialCustomerFooter = customerFooter
    .replace("Stay safe when shopping with us", "Anti-scam reminders")
    .replace("Keep these reminders close whenever you receive a Dritchwear message.", "Stay safe when ordering, receiving payment links or getting support from Dritchwear.")
    .replace("Dritchwear will never ask for your password, OTP, card PIN or CVV.", "Dritchwear will never ask for your password, OTP, passcode, card PIN or CVV.")
    .replace("Do not pay through an unfamiliar link or social-media account. Open the Dritchwear app directly to confirm your order.", "Do not use suspicious payment, support or giveaway links. Open Dritchwear directly from our website or your installed app.")
    .replace("If anything looks wrong, stop and contact", "If something feels wrong, stop immediately and contact")
    .replace("Order, track deliveries and manage payments from your home screen.", "Dritchwear works best when added to your home screen, like a normal app.")
    .replace("background:#f3eff7", "background:#fff8df")
    .replace("border-top:1px solid #ded3e6", "border-top:1px solid #ead78b")
    .replace("text-align:center;border-top", "text-align:left;border-top");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:600px){.outer{padding:0!important}.email{width:100%!important;border-left:0!important;border-right:0!important}.pad{padding-left:20px!important;padding-right:20px!important}.stack,.stack tbody,.stack tr,.stack-cell{display:block!important;width:100%!important}.stack-cell{padding:0 0 18px!important}}</style></head><body style="margin:0;background:#f4f1f6;font-family:Arial,sans-serif;color:#17131c"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div><table width="100%" role="presentation" cellpadding="0" cellspacing="0"><tr><td class="outer" align="center" style="padding:32px 12px"><table class="email" width="640" role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border:1px solid #e8e3eb"><tr><td class="pad" style="padding:24px 32px;background:#5a2d82;color:#fff;text-align:center"><div style="font-size:22px;font-weight:700;letter-spacing:1px">DRITCHWEAR</div></td></tr><tr><td class="pad" style="padding:34px 32px;font-size:15px;line-height:1.75">${body}</td></tr>${type === "customer" ? editorialCustomerFooter : leftAlignedPartnerFooter}</table></td></tr></table></body></html>`;
}

async function authenticate(req: Request) {
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!bearer) return null;
  const { data } = await admin.auth.getUser(bearer);
  if (!data.user) return null;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).single();
  return profile?.role === "admin" ? data.user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY is not configured" }, 503);
  const internal = req.headers.get("x-scheduler-key") === SERVICE_KEY;
  const user = internal ? { id: String((await req.clone().json().catch(() => ({})))?.createdBy ?? "") } : await authenticate(req);
  if (!user) return json({ error: "Admin access required" }, 403);
  const input = await req.json().catch(() => null) as any;

  if (input?.action === "sync") {
    const messageId = String(input?.messageId ?? "");
    const { data: message } = await admin
      .from("email_messages")
      .select("id,provider_ids,recipients,subject,created_at,tracking_data")
      .eq("id", messageId)
      .single();
    if (!message) return json({ error: "Email record not found" }, 404);

    // Legacy rows may have non-empty tracking_data without provider_id. Always
    // rebuild the authoritative email ↔ provider mapping from the ordered send
    // columns, then merge any milestone fields the newer format already stored.
    const legacy = Array.isArray(message.tracking_data) ? message.tracking_data as Partial<RecipientTracking>[] : [];
    const needsRecovery = (message.recipients ?? []).some((_: string, index: number) => !(message.provider_ids ?? [])[index]);
    const recovered = needsRecovery ? await recoverLegacyProviders(message) : [];
    const providerIds = (message.recipients ?? []).map((_: string, index: number) =>
      (message.provider_ids ?? [])[index] ?? recovered[index]?.id ?? null
    );
    const now = new Date().toISOString();
    const existing: RecipientTracking[] = (message.recipients ?? []).map((email: string, i: number) => {
      const providerId = providerIds[i] ?? null;
      const saved = legacy.find(item =>
        (providerId && item.provider_id === providerId) ||
        (item.email && item.email.toLowerCase() === email.toLowerCase())
      ) ?? legacy[i] ?? {};
      return {
        ...saved,
        email,
        provider_id: providerId || saved.provider_id || null,
        status: recovered[i]?.last_event || saved.status || saved.last_event || "sent",
        last_event: recovered[i]?.last_event || saved.last_event || null,
        updated_at: saved.updated_at || now,
        ...(recovered[i]?.last_event ? milestoneFields(recovered[i].last_event, now) : {}),
      };
    });

    // Resend permits about two requests/second. Keep this deliberately serial;
    // parallel chunks can burst above the limit even when followed by a pause.
    const updated: RecipientTracking[] = [...existing];
    const withIds = existing.map((item, index) => ({ item, index })).filter((entry) => entry.item.provider_id);
    for (let position = 0; position < withIds.length; position += 1) {
      const { item, index } = withIds[position];
      const event = recovered[index]?.id === item.provider_id ? recovered[index] : await fetchResendEmail(item.provider_id as string);
      const lastEvent = event?.last_event || event?.status || null;
      if (lastEvent) {
        const at = new Date().toISOString();
        updated[index] = { ...item, ...milestoneFields(lastEvent, at), status: lastEvent, last_event: lastEvent, updated_at: at };
      }
      if (position + 1 < withIds.length) await sleep(600);
    }

    const trackingStatus = aggregateStatus(updated);
    const recoveredCount = recovered.filter((item: any) => item?.id).length;
    const missingCount = updated.filter(item => !item.provider_id).length;
    await admin
      .from("email_messages")
      .update({ provider_ids: providerIds, tracking_status: trackingStatus, tracking_data: updated, updated_at: new Date().toISOString() })
      .eq("id", messageId);
    return json({ success: true, trackingStatus, recipients: updated, recoveredCount, missingCount, syncedCount: withIds.length });
  }

  const audience = input?.audience === "customers" ? "customers" : "individual";
  const communicationType = input?.communicationType === "customer" ? "customer" : "partner";
  const subject = String(input?.subject ?? "").trim();
  const previewText = String(input?.previewText ?? "").trim().slice(0, 180);
  const content = String(input?.content ?? "").trim();
  const format = input?.format === "text" ? "text" : "html";
  const attachments = (Array.isArray(input?.attachments) ? input.attachments : []).slice(0, 10).map((item: any) => ({
    filename: String(item.filename || "attachment"), content: String(item.content || ""), ...(item.contentType ? { content_type: String(item.contentType) } : {}),
  }));
  const attachmentBytes = (Array.isArray(input?.attachments) ? input.attachments : []).reduce((sum: number, item: any) => sum + Number(item?.size || 0), 0);
  if (!subject || !content) return json({ error: "Subject and message are required" }, 400);
  if (attachmentBytes > 10 * 1024 * 1024) return json({ error: "Attachments exceed the 10 MB limit" }, 400);

  let recipients: string[] = [];
  if (audience === "customers") {
    const { data } = await admin.from("profiles").select("email").eq("role", "customer");
    recipients = (data ?? []).map((row: any) => String(row.email).toLowerCase()).filter(Boolean);
  } else {
    recipients = Array.from(new Set((Array.isArray(input?.recipients) ? input.recipients : []).map((email: unknown) => String(email).trim().toLowerCase()).filter((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))));
  }
  if (!recipients.length) return json({ error: "No valid recipients found" }, 400);
  if (recipients.length > 100) return json({ error: "A maximum of 100 recipients can be sent at once" }, 400);

  const logPayload = {
    created_by: user.id, sender: "support@dritchwear.com", audience, recipients, subject, format,
    communication_type: communicationType, preview_text: previewText,
    attachment_names: attachments.map((item: any) => item.filename), status: "sending", tracking_status: "queued",
  };
  let { data: log, error: logError } = await admin.from("email_messages").insert(logPayload).select("id").single();
  if (logError) {
    const fallback = await admin.from("email_messages").insert({
      created_by: user.id, sender: "support@dritchwear.com", audience, recipients, subject, format, status: "sending",
    }).select("id").single();
    log = fallback.data;
  }

  const html = brandedHtml(content, format, communicationType, previewText);
  const payload = recipients.map(to => ({
    from: `Dritchwear Collections <support@dritchwear.com>`,
    reply_to: "support@dritchwear.com", to: [to], subject, html,
    text: content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    ...(attachments.length ? { attachments } : {}),
  }));
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST", headers: { ...resendHeaders, "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  const providerIds = Array.isArray(result?.data) ? result.data.map((item: any) => item?.id ?? null) : [];
  // Resend's batch response preserves send order, so data[i].id maps to recipients[i].
  // Persist that mapping so every recipient can be tracked individually.
  const now = new Date().toISOString();
  const recipientTracking: RecipientTracking[] = recipients.map((email, i) => ({
    email,
    provider_id: providerIds[i] ?? null,
    status: response.ok && providerIds[i] ? "sent" : "failed",
    last_event: response.ok && providerIds[i] ? "sent" : "failed",
    ...(response.ok && providerIds[i] ? { sent_at: now } : {}),
    updated_at: now,
  }));
  if (log?.id) await admin.from("email_messages").update({
    status: response.ok ? "sent" : "failed", provider_ids: providerIds, tracking_status: response.ok ? "sent" : "failed",
    tracking_data: recipientTracking,
    error: response.ok ? null : JSON.stringify(result).slice(0, 1000), sent_count: recipientTracking.filter(item => item.provider_id).length, updated_at: now,
  }).eq("id", log.id);
  if (!response.ok) return json({ error: "Resend rejected the email", detail: result }, 502);
  return json({ success: true, sent: recipients.length, ids: providerIds, messageId: log?.id });
});
