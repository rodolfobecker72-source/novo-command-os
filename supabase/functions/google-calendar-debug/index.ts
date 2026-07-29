import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getGatewayCreds, jsonResponse, corsHeaders, CONNECTOR_ID, GOOGLE_CALENDAR_SCOPES } from "../_shared/appUserConnector.ts";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";

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
    const appUserId = userData.user.id;
    const { lovableKey, clientKey } = getGatewayCreds();
    const results: Record<string, unknown> = { appUserId };

    // === Test authorize response format ===
    const authRes = await fetch(`${GATEWAY_BASE}/api/v1/app-users/oauth2/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Client-Api-Key": clientKey,
      },
      body: JSON.stringify({
        connector_id: CONNECTOR_ID,
        app_user_id: appUserId,
        return_url: "https://herocommandcrm.lovable.app/auth/google-calendar-callback",
        credentials_configuration: { scopes: GOOGLE_CALENDAR_SCOPES },
      }),
    });
    results.authorize = { status: authRes.status, body: await authRes.text() };

    // === Try various header combos for calendar list ===
    const tries = [
      { name: "bearer_client_appuser", headers: { Authorization: `Bearer ${lovableKey}`, "X-Client-Api-Key": clientKey, "X-App-User-Id": appUserId } },
      { name: "bearer_conn_appuser", headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": clientKey, "X-App-User-Id": appUserId } },
      { name: "bearer_only", headers: { Authorization: `Bearer ${lovableKey}`, "X-App-User-Id": appUserId } },
      { name: "clientkey_bearer_appuser_userid", headers: { Authorization: `Bearer ${lovableKey}`, "X-Client-Api-Key": clientKey, "X-User-Id": appUserId } },
    ];
    const perTry: Record<string, unknown> = {};
    for (const t of tries) {
      const r = await fetch(`${GATEWAY_BASE}/${CONNECTOR_ID}/calendar/v3/users/me/calendarList?maxResults=1`, { headers: t.headers });
      perTry[t.name] = { status: r.status, body: (await r.text()).slice(0, 400) };
    }
    results.calendarTries = perTry;

    return jsonResponse(results);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
