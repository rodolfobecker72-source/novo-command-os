// Starts the Google OAuth flow for the logged-in user. Returns the Google
// consent URL; the state and PKCE verifier are kept server-side for
// google-calendar-complete.
import {
  adminClient, authorizeUrl, corsHeaders, getCaller, isConfigured, jsonResponse, pkceChallenge, randomToken,
} from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);
    if (!isConfigured()) return jsonResponse({ error: "A integração com o Google Agenda ainda não foi configurada." }, 503);

    const admin = adminClient();
    const state = randomToken();
    const verifier = randomToken(48);

    // Old, never-finished attempts (anyone's) and this user's previous attempt
    await admin.from("google_oauth_states").delete().lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    await admin.from("google_oauth_states").delete().eq("user_id", user.id);
    const { error } = await admin.from("google_oauth_states").insert({ state, user_id: user.id, code_verifier: verifier });
    if (error) throw error;

    return jsonResponse({ url: authorizeUrl(state, await pkceChallenge(verifier)) });
  } catch (e) {
    console.error("[gcal connect-init]", e);
    return jsonResponse({ error: "Não foi possível iniciar a conexão com o Google." }, 500);
  }
});
