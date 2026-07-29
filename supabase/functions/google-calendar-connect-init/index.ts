// Starts Google Calendar OAuth. Persists the pending session_id for this user
// so the callback can complete the exchange.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { startAuthorize, adminClient, jsonResponse, corsHeaders } from "../_shared/appUserConnector.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return jsonResponse({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const origin: string = body.origin || "https://herocommandcrm.lovable.app";
    const returnUrl = `${origin.replace(/\/$/, "")}/auth/google-calendar-callback`;

    const { authorization_url, session_id } = await startAuthorize({
      appUserId: userData.user.id,
      returnUrl,
    });

    // Persist session_id so the callback can exchange the code for the connection_key.
    const admin = adminClient();
    await admin.from("google_calendar_connections").upsert({
      user_id: userData.user.id,
      pending_session_id: session_id,
      updated_at: new Date().toISOString(),
    });

    return jsonResponse({ url: authorization_url });
  } catch (e) {
    console.error("[connect-init]", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
