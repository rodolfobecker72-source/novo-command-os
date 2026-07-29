import { getGatewayCreds, jsonResponse, corsHeaders, CONNECTOR_ID, GOOGLE_CALENDAR_SCOPES } from "../_shared/appUserConnector.ts";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { lovableKey, clientKey } = getGatewayCreds();
  const appUserId = "65e447cc-fe44-4662-a51c-723c8af27067";
  const url = new URL(req.url);
  const providedSid = url.searchParams.get("sid");
  let sid = providedSid;

  const results: Record<string, unknown> = {};

  if (!sid) {
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
    sid = authJson.session_id;
    results.authorize_url = authJson.authorization_url;
    results.session_id = sid;
  }

  const bodyVariants = [
    { session_id: sid },
    { session_id: sid, connector_id: CONNECTOR_ID },
    { session_id: sid, connector_id: CONNECTOR_ID, app_user_id: appUserId },
  ];
  for (let i = 0; i < bodyVariants.length; i++) {
    const r = await fetch(`${GATEWAY_BASE}/api/v1/app-users/oauth2/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}`, "X-Client-Api-Key": clientKey },
      body: JSON.stringify(bodyVariants[i]),
    });
    results[`exchange_v${i}`] = { status: r.status, body: (await r.text()).slice(0, 800) };
  }
  return jsonResponse(results);
});
