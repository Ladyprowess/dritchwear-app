import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(URL, SERVICE_KEY);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  if (body?.source !== "database-cron") return json({ error: "Invalid scheduler request" }, 403);
  const { data: jobs, error } = await db.from("scheduled_communications").select("*").eq("status", "pending").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(20);
  if (error) return json({ error: error.message }, 500);
  let sent = 0;
  for (const job of jobs ?? []) {
    const { data: claimed } = await db.from("scheduled_communications").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) continue;
    try {
      if (job.channel === "email") {
        const response = await fetch(`${URL}/functions/v1/send-admin-email`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", "x-scheduler-key": SERVICE_KEY }, body: JSON.stringify({ ...job.payload, createdBy: job.created_by }) });
        if (!response.ok) throw new Error((await response.text()).slice(0, 500));
      } else {
        const payload = job.payload;
        const notifications = payload.sendToAll
          ? { user_id: null, title: payload.title, message: payload.message, type: payload.type, url: payload.url ?? null }
          : (payload.userIds ?? []).map((userId: string) => ({ user_id: userId, title: payload.title, message: payload.message, type: payload.type, url: payload.url ?? null }));
        const { error: insertError } = await db.from("notifications").insert(notifications);
        if (insertError) throw insertError;
        const response = await fetch(`${URL}/functions/v1/send-push-notifications`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", "x-scheduler-key": SERVICE_KEY }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error((await response.text()).slice(0, 500));
      }
      await db.from("scheduled_communications").update({ status: "sent", processed_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null }).eq("id", job.id);
      sent += 1;
    } catch (cause) {
      await db.from("scheduled_communications").update({ status: "failed", processed_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: cause instanceof Error ? cause.message.slice(0, 1000) : "Unknown error" }).eq("id", job.id);
    }
  }
  return json({ success: true, processed: jobs?.length ?? 0, sent });
});
