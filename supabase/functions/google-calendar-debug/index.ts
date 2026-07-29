// Diagnostic: dumps raw gateway responses for the current user so we can see
// why the connection is not being recognized after OAuth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAsUser, getGatewayCreds, jsonResponse, corsHeaders, CONNECTOR_ID } from "../_shared/appUserConnector.ts";

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
    const results: Record<string, unknown> = { appUserId, email: userData.user.email };

    // 1) Ask the gateway to list connections for this app_user_id, if that endpoint exists.
    const listUrl = new URL(`${GATEWAY_BASE}/api/v1/app-users/connections`);
    listUrl.searchParams.set("connector_id", CONNECTOR_ID);
    listUrl.searchParams.set("app_user_id", appUserId);
    const listRes = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Client-Api-Key": clientKey,
      },
    });
    results.listConnections = { status: listRes.status, body: await listRes.text() };

    // 2) Try calendarList via callAsUser (current implementation).
    const cal = await callAsUser({
      appUserId,
      path: "/calendar/v3/users/me/calendarList",
      query: { maxResults: "1" },
    });
    results.calendarList = { status: cal.status, body: cal.text };

    // 3) Try same call but with Authorization only (no X-App-User-Id) — some flows key on Bearer alone.
    const bareRes = await fetch(
      `${GATEWAY_BASE}/${CONNECTOR_ID}/calendar/v3/users/me/calendarList?maxResults=1`,
      {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": clientKey,
        },
      },
    );
    results.calendarListNoAppUser = { status: bareRes.status, body: await bareRes.text() };

    return jsonResponse(results);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
