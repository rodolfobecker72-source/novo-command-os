import { getGatewayCreds, jsonResponse, corsHeaders, CONNECTOR_ID, GOOGLE_CALENDAR_SCOPES } from "../_shared/appUserConnector.ts";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { lovableKey, clientKey } = getGatewayCreds();
  const appUserId = "65e447cc-fe44-4662-a51c-723c8af27067";

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
  const authJson = JSON.parse(await authRes.text());
  const sid = authJson.session_id;

  const attempts = [
    `${GATEWAY_BASE}/api/v1/app-users/oauth2/sessions/${sid}`,
    `${GATEWAY_BASE}/api/v1/app-users/oauth2/session/${sid}`,
    `${GATEWAY_BASE}/api/v1/app-users/oauth2/sessions?session_id=${sid}`,
    `${GATEWAY_BASE}/api/v1/app-users/oauth2/status?session_id=${sid}`,
    `${GATEWAY_BASE}/api/v1/app-users/oauth2/poll?session_id=${sid}`,
    `${GATEWAY_BASE}/api/v1/app-users/oauth2/exchange?session_id=${sid}`,
    `${GATEWAY_BASE}/api/v1/app-users/sessions/${sid}`,
    `${GATEWAY_BASE}/api/v1/app-users/credentials?connector_id=${CONNECTOR_ID}&app_user_id=${appUserId}`,
    `${GATEWAY_BASE}/api/v1/app-users/credentials/${appUserId}`,
    `${GATEWAY_BASE}/api/v1/credentials?connector_id=${CONNECTOR_ID}&app_user_id=${appUserId}`,
    `${GATEWAY_BASE}/api/v1/app-users/${appUserId}/credentials?connector_id=${CONNECTOR_ID}`,
  ];
  const results: Record<string, unknown> = { session_id: sid };
  for (const u of attempts) {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${lovableKey}`, "X-Client-Api-Key": clientKey } });
    const b = await r.text();
    if (r.status !== 404) results[u] = { status: r.status, body: b.slice(0, 300) };
  }
  return jsonResponse(results);
});
