// Disconnect Google Calendar: wipe local connection record + sync map.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { adminClient, jsonResponse, corsHeaders } from "../_shared/appUserConnector.ts";

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

    const admin = adminClient();
    await admin.from("google_calendar_sync_map").delete().eq("user_id", userData.user.id);
    await admin.from("google_calendar_connections").delete().eq("user_id", userData.user.id);

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("[disconnect]", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
