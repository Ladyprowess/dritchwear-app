import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const EVENT_ORDER = ["queued", "sent", "delivered", "opened", "clicked"];

type RecipientTracking = {
  email: string;
  provider_id: string | null;
  status: string;
  last_event: string | null;
  updated_at: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  bounced_at?: string;
  complained_at?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function normalizeEvent(type: string) {
  return type.toLowerCase().replace(/^email\./, "");
}

function shouldApply(current: string | null, next: string) {
  if (next === "delivery_delayed") return !["delivered", "opened", "clicked", "bounced", "complained", "failed", "canceled"].includes(current ?? "");
  if (["bounced", "complained", "failed", "canceled"].includes(next)) return true;
  if (["bounced", "complained", "failed", "canceled"].includes(current ?? "")) return false;
  return EVENT_ORDER.indexOf(next) >= EVENT_ORDER.indexOf(current ?? "queued");
}

function milestoneFields(event: string, at: string) {
  if (event === "clicked") return { delivered_at: at, opened_at: at, clicked_at: at };
  if (event === "opened") return { delivered_at: at, opened_at: at };
  if (event === "delivered") return { delivered_at: at };
  if (event === "bounced") return { bounced_at: at };
  if (event === "complained") return { complained_at: at };
  if (event === "sent") return { sent_at: at };
  return {};
}

function aggregateStatus(items: RecipientTracking[]) {
  const states = items.map(item => item.last_event || item.status);
  for (const exceptional of ["complained", "bounced", "failed", "delivery_delayed"]) {
    if (states.includes(exceptional)) return exceptional;
  }
  for (const state of [...EVENT_ORDER].reverse()) if (states.includes(state)) return state;
  return "sent";
}

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function verifySignature(rawBody: string, req: Request) {
  if (!WEBHOOK_SECRET) return false;
  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signatures = (req.headers.get("svix-signature") ?? "").split(" ").map(item => item.replace(/^v1,/, ""));
  const unixTime = Number(timestamp);
  if (!id || !unixTime || Math.abs(Date.now() / 1000 - unixTime) > 300) return false;
  const secret = WEBHOOK_SECRET.startsWith("whsec_") ? WEBHOOK_SECRET.slice(6) : WEBHOOK_SECRET;
  let keyBytes: Uint8Array;
  try { keyBytes = Uint8Array.from(atob(secret), char => char.charCodeAt(0)); } catch { return false; }
  const keyData = new Uint8Array(keyBytes).buffer;
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const expected = bytesToBase64(new Uint8Array(digest));
  return signatures.some(signature => constantTimeEqual(signature, expected));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawBody = await req.text();
  if (!(await verifySignature(rawBody, req))) return json({ error: "Invalid webhook signature" }, 401);

  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON payload" }, 400); }
  const eventType = normalizeEvent(String(event?.type ?? ""));
  const providerId = String(event?.data?.email_id ?? event?.data?.id ?? "");
  if (!providerId || !eventType) return json({ received: true, updated: false });

  const { data: messages, error } = await admin
    .from("email_messages")
    .select("id,tracking_data")
    .contains("tracking_data", [{ provider_id: providerId }]);
  if (error) return json({ error: "Could not find email record" }, 500);
  const message = messages?.[0];
  if (!message) return json({ received: true, updated: false });

  const occurredAt = event?.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString();
  const tracking = (Array.isArray(message.tracking_data) ? message.tracking_data : []) as RecipientTracking[];
  const updated = tracking.map(item => item.provider_id === providerId && shouldApply(item.last_event || item.status, eventType)
    ? { ...item, ...milestoneFields(eventType, occurredAt), status: eventType, last_event: eventType, updated_at: occurredAt }
    : item);
  const { error: updateError } = await admin.from("email_messages").update({
    tracking_data: updated,
    tracking_status: aggregateStatus(updated),
    updated_at: new Date().toISOString(),
  }).eq("id", message.id);
  if (updateError) return json({ error: "Could not update email record" }, 500);
  return json({ received: true, updated: true });
});
