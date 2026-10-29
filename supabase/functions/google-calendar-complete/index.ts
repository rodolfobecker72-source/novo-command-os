// Finishes the Google OAuth flow: checks the state, exchanges the code,
// makes sure the "Command OS" calendar exists and queues the user's current
// activities and appointments for sync.
import {
  adminClient, calendarApi, CALENDAR_SCOPE, corsHeaders, createAppCalendar, decrypt, emailFromIdToken, encryptTokens,
  exchangeCode, getCaller, jsonResponse, NeedsReconnectError, revokeToken,
} from "../_shared/googleCalendar.ts";

const STATE_TTL_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const { code, state } = await req.json().catch(() => ({}));
    if (!code || !state) return jsonResponse({ error: "Resposta do Google incompleta. Tente conectar de novo." }, 400);

    const admin = adminClient();
    const { data: pending } = await admin
      .from("google_oauth_states")
      .delete()
      .eq("state", state)
      .eq("user_id", user.id)
      .select("code_verifier, created_at")
      .maybeSingle();
    if (!pending || Date.now() - new Date(pending.created_at).getTime() > STATE_TTL_MS) {
      return jsonResponse({ error: "Este link de conexão expirou. Tente conectar de novo." }, 400);
    }

    const tokens = await exchangeCode(code, pending.code_verifier);
    const granted = (tokens.scope ?? "").split(" ");
    if (!granted.includes(CALENDAR_SCOPE) || !tokens.refresh_token) {
      await revokeToken(tokens.refresh_token ?? tokens.access_token);
      return jsonResponse({
        error: "A permissão para gerenciar a agenda do Command OS não foi concedida. Conecte de novo e marque essa opção na tela do Google.",
      }, 400);
    }

    const { data: previous } = await admin
      .from("google_calendar_connections")
      .select("refresh_token_enc, calendar_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Reconnecting: keep the existing calendar if it is still there
    let calendarId: string | null = null;
    if (previous?.calendar_id) {
      const r = await calendarApi(tokens.access_token, `/calendars/${encodeURIComponent(previous.calendar_id)}`);
      if (r.ok) calendarId = previous.calendar_id;
    }
    if (!calendarId) {
      calendarId = await createAppCalendar(tokens.access_token);
      await admin.from("google_calendar_sync_map").delete().eq("user_id", user.id);
    }

    const { error } = await admin.from("google_calendar_connections").upsert({
      user_id: user.id,
      email: emailFromIdToken(tokens.id_token),
      ...(await encryptTokens(tokens)),
      calendar_id: calendarId,
      status: "connected",
      last_error: null,
      connected_at: new Date().toISOString(),
    });
    if (error) throw error;

    if (previous?.refresh_token_enc) {
      const old = await decrypt(previous.refresh_token_enc).catch(() => null);
      if (old && old !== tokens.refresh_token) await revokeToken(old);
    }

    await admin.rpc("gcal_enqueue_user_backfill", { p_user: user.id });
    return jsonResponse({ ok: true, email: emailFromIdToken(tokens.id_token) });
  } catch (e) {
    console.error("[gcal complete]", e);
    const message = e instanceof NeedsReconnectError
      ? "O Google recusou a autorização (código expirado). Tente conectar de novo."
      : "Não foi possível concluir a conexão com o Google.";
    return jsonResponse({ error: message }, 500);
  }
});
