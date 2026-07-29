// Completes the OAuth flow: exchanges the code from the return_url for a
// per-user connection_key and stores it. Called by the callback page.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { exchangeCode, callAsUser, adminClient, jsonResponse, corsHeaders } from "../_shared/appUserConnector.ts";

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
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const code: string | undefined = body.code;
    if (!code) return jsonResponse({ error: "code required" }, 400);

    const admin = adminClient();
    const { data: row } = await admin
      .from("google_calendar_connections")
      .select("pending_session_id")
      .eq("user_id", userId)
      .maybeSingle();
    const sessionId = row?.pending_session_id;
    if (!sessionId) return jsonResponse({ error: "no pending session; start connect again" }, 400);

    const { connection_key } = await exchangeCode({ sessionId, code });

    // Best-effort fetch of the connected email via userinfo.
    let email: string | undefined;
    try {
      const info = await callAsUser({
        connectionKey: connection_key,
        path: "/oauth2/v2/userinfo",
      });
      if (info.ok && info.data?.email) email = info.data.email;
    } catch { /* ignore */ }

    // Fetch user's workspace for reference.
    const { data: wm } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .maybeSingle();

    await admin.from("google_calendar_connections").upsert({
      user_id: userId,
      workspace_id: wm?.workspace_id ?? null,
      connection_key,
      email: email ?? null,
      connected_at: new Date().toISOString(),
      pending_session_id: null,
      updated_at: new Date().toISOString(),
    });

    return jsonResponse({ ok: true, email });
  } catch (e) {
    console.error("[complete]", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
