import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_KEY);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sendPush(userId: string, title: string, message: string) {
  const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", userId);
  for (const row of tokens ?? []) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: row.token, sound: "default", title, body: message, data: { type: "promo", url: "/cart" }, badge: 1 }),
    }).catch(() => null);
  }
  return (tokens ?? []).length > 0;
}

async function sendEmail(to: string, name: string, itemCount: number, subtotal: number, stage: number) {
  if (!RESEND_API_KEY || !to) return false;
  const subject = stage === 3 ? "Your Dritchwear cart is still saved" : "You left something good in your cart";
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f1f6;font-family:Arial,sans-serif;color:#17131c"><table width="100%" role="presentation"><tr><td align="center" style="padding:28px 12px"><table width="600" role="presentation" style="width:100%;max-width:600px;background:#fff;border-collapse:collapse"><tr><td style="padding:24px;background:#5a2d82;color:#fff;text-align:center;font-size:22px;font-weight:700">DRITCHWEAR</td></tr><tr><td style="padding:34px 28px"><h1 style="margin:0;font-size:25px">Your cart is waiting, ${name || "there"}</h1><p style="font-size:15px;line-height:1.7;color:#665f6c">You saved ${itemCount} ${itemCount === 1 ? "item" : "items"} worth ₦${Number(subtotal).toLocaleString("en-NG")}. Stock can change, so return when you are ready.</p><a href="https://app.dritchwear.com/cart" style="display:inline-block;margin-top:8px;padding:14px 22px;background:#5a2d82;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">RETURN TO CART</a></td></tr><tr><td style="padding:24px 28px;background:#f8f7f9;text-align:center;font-size:12px;line-height:1.7;color:#665f6c">Need help? <a href="mailto:support@dritchwear.com" style="color:#5a2d82">support@dritchwear.com</a><br/>Manage cart reminder emails in Dritchwear Notification Settings.<br/>© ${new Date().getUTCFullYear()} Dritchwear Collections</td></tr></table></td></tr></table></body></html>`;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "Dritchwear <noreply@dritchwear.com>", reply_to: "support@dritchwear.com", to: [to], subject, html }) });
  return response.ok;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { data: settings } = await db.from("commerce_settings").select("*").eq("id", "default").single();
  if (!settings?.cart_reminders_enabled) return json({ success: true, processed: 0, disabled: true });

  const cutoff = new Date(Date.now() - Number(settings.first_reminder_hours) * 3600000).toISOString();
  const { data: carts, error } = await db.from("cart_sessions").select("*").eq("status", "active").gt("item_count", 0).lte("updated_at", cutoff).order("updated_at").limit(100);
  if (error) return json({ error: error.message }, 500);
  let processed = 0;

  for (const cart of carts ?? []) {
    const ageHours = (Date.now() - new Date(cart.updated_at).getTime()) / 3600000;
    const stage = !cart.first_reminder_at && ageHours >= settings.first_reminder_hours ? 1
      : !cart.second_reminder_at && ageHours >= settings.second_reminder_hours ? 2
      : !cart.final_reminder_at && ageHours >= settings.final_reminder_hours ? 3 : 0;
    if (!stage) continue;
    const { data: profile } = await db.from("profiles").select("email, full_name, cart_reminders_enabled, cart_email_reminders_enabled").eq("id", cart.user_id).single();
    if (!profile?.cart_reminders_enabled) continue;

    const title = stage === 3 ? "Last reminder: your cart is saved" : stage === 2 ? "Still thinking it over?" : "You left something in your cart";
    const message = `${cart.item_count} ${cart.item_count === 1 ? "item is" : "items are"} waiting for you. Return before availability changes.`;
    const reminderColumn = stage === 1 ? "first_reminder_at" : stage === 2 ? "second_reminder_at" : "final_reminder_at";
    const { error: lockError } = await db.from("cart_sessions").update({ [reminderColumn]: new Date().toISOString() }).eq("user_id", cart.user_id).is(reminderColumn, null);
    if (lockError) continue;

    await db.from("notifications").insert({ user_id: cart.user_id, title, message, type: "promo", url: "/cart", is_read: false });
    const pushed = await sendPush(cart.user_id, title, message);
    const emailed = stage > 1 && profile.cart_email_reminders_enabled ? await sendEmail(profile.email, profile.full_name, cart.item_count, cart.subtotal_ngn, stage) : false;
    await db.from("cart_reminder_events").upsert({ user_id: cart.user_id, stage, channels: ["in_app", ...(pushed ? ["push"] : []), ...(emailed ? ["email"] : [])] }, { onConflict: "user_id,stage" });
    processed++;
  }
  return json({ success: true, processed });
});
