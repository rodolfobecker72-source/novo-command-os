import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getGatewayCreds, jsonResponse, corsHeaders, CONNECTOR_ID } from "../_shared/appUserConnector.ts";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { lovableKey, clientKey } = getGatewayCreds();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const appUserId = url.searchParams.get("app_user_id") ?? "65e447cc-fe44-4662-a51c-723c8af27067";
  const results: Record<string, unknown> = {};

  const attempts: Array<{ name: string; url: string; method?: string }> = [
    { name: "session_get", url: `${GATEWAY_BASE}/api/v1/app-users/oauth2/sessions/${sessionId}` },
    { name: "session_get_alt", url: `${GATEWAY_BASE}/api/v1/app-users/oauth2/session?session_id=${sessionId}` },
    { name: "connections_list", url: `${GATEWAY_BASE}/api/v1/app-users/connections?connector_id=${CONNECTOR_ID}&app_user_id=${appUserId}` },
    { name: "connections_list2", url: `${GATEWAY_BASE}/api/v1/app-users/credentials?connector_id=${CONNECTOR_ID}&app_user_id=${appUserId}` },
    { name: "connection_by_user", url: `${GATEWAY_BASE}/api/v1/app-users/${appUserId}/connections?connector_id=${CONNECTOR_ID}` },
    { name: "root", url: `${GATEWAY_BASE}/api/v1/app-users/` },
  ];
  for (const a of attempts) {
    if (a.url.includes("null")) { results[a.name] = "skipped"; continue; }
    const r = await fetch(a.url, {
      method: a.method ?? "GET",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Client-Api-Key": clientKey,
      },
    });
    results[a.name] = { status: r.status, body: (await r.text()).slice(0, 500) };
  }
  return jsonResponse(results);
});
