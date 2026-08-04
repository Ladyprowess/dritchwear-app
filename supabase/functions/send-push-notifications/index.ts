import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationPayload {
  userIds?: string[];
  title: string;
  message: string;
  type: "order" | "promo" | "system" | "custom";
  sendToAll?: boolean;
  toAdmins?: boolean; // resolve recipients to all admins (used for support messages)
  url?: string | null;
}

interface ExpoTicket {
  id: string;
  status: string;
  message?: string;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);
const WEB_PUSH_VAPID_PRIVATE_KEY = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") || "";
const WEB_PUSH_VAPID_PUBLIC_KEY = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") || "";
const WEB_PUSH_VAPID_SUBJECT = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:support@dritchwear.com";

if (WEB_PUSH_VAPID_PRIVATE_KEY && WEB_PUSH_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(WEB_PUSH_VAPID_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY);
}

function isWebPushToken(token: string) {
  return token.trim().startsWith("{");
}

async function sendWebPush(token: string, payload: NotificationPayload) {
  if (!WEB_PUSH_VAPID_PRIVATE_KEY || !WEB_PUSH_VAPID_PUBLIC_KEY) {
    throw new Error("Web push is not configured");
  }
  const subscription = JSON.parse(token);
  await webpush.sendNotification(subscription, JSON.stringify({
    title: payload.title,
    body: payload.message,
    message: payload.message,
    type: payload.type,
    url: payload.url ?? (payload.type === "order" ? "/orders" : "/notifications"),
    data: {
      type: payload.type,
      title: payload.title,
      message: payload.message,
      url: payload.url ?? null,
    },
  }));
}

async function sendPushNotifications(payload: NotificationPayload) {
  try {
    let userIds = payload.userIds || [];

    if (payload.toAdmins) {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");
      userIds = admins?.map((p: any) => p.id) || [];
    } else if (payload.sendToAll || userIds.length === 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "customer");
      userIds = profiles?.map((p: any) => p.id) || [];
    }

    if (userIds.length === 0) {
      return {
        success: false,
        message: "No users found to send notifications to",
      };
    }

    const { data: pushTokens } = await supabase
      .from("push_tokens")
      .select("token, user_id, device_type")
      .in("user_id", userIds);

    // A saved token is the opt-in record. Disabling notifications removes it.
    const eligibleTokens = pushTokens ?? [];

    if (eligibleTokens.length === 0) {
      return {
        success: false,
        message: "No push tokens found for selected users",
      };
    }

    const expoApiUrl = "https://exp.host/--/api/v2/push/send";
    const tickets: ExpoTicket[] = [];
    const failedTokens: { token: string; error: string }[] = [];

    for (const { token } of eligibleTokens) {
      try {
        if (isWebPushToken(token)) {
          await sendWebPush(token, payload);
          tickets.push({ id: "web-push", status: "ok" });
          continue;
        }

        const response = await fetch(expoApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            to: token,
            sound: "default",
            title: payload.title,
            body: payload.message,
            data: {
              type: payload.type,
              title: payload.title,
              message: payload.message,
              url: payload.url ?? null,
            },
            badge: 1,
            priority: "high",
          }),
        });

        const data = (await response.json()) as ExpoTicket;

        if (response.ok) {
          tickets.push(data);
        } else {
          failedTokens.push({
            token: token.substring(0, 10) + "...",
            error: data.message || "Unknown error",
          });
        }
      } catch (error) {
        failedTokens.push({
          token: token.substring(0, 10) + "...",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      success: true,
      sent: tickets.length,
      failed: failedTokens.length,
      totalTokens: eligibleTokens.length,
      failedTokens: failedTokens.length > 0 ? failedTokens : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const internal = req.headers.get("x-scheduler-key") === (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: authData } = internal ? { data: { user: null } } : await supabase.auth.getUser(bearer);
    const user = authData.user;
    if (!internal && !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: adminProfile } = internal ? { data: { role: "admin" } } : await supabase.from("profiles").select("role").eq("id", user!.id).single();

    const payload: NotificationPayload = await req.json();

    if (!payload.title || !payload.message || !payload.type) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: title, message, type",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const requestedUserIds = payload.userIds || [];
    const isSelfOnly =
      !payload.sendToAll &&
      requestedUserIds.length === 1 &&
      !!user?.id &&
      requestedUserIds[0] === user.id;
    // Any signed-in user may notify admins (support messages); everything else
    // still requires admin, or a self-only notification.
    const allowToAdmins = payload.toAdmins === true && !!user;
    if (!internal && adminProfile?.role !== "admin" && !isSelfOnly && !allowToAdmins) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await sendPushNotifications(payload);

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
