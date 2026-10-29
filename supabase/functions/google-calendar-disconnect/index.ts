// Disconnects the user's Google account: removes the "Command OS" calendar
// (and with it every event the app created), revokes the token and deletes
// the stored connection.
import {
  adminClient, calendarApi, Connection, corsHeaders, decrypt, getAccessToken, getCaller, jsonResponse, revokeToken,
} from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const admin = adminClient();
    const { data: conn } = await admin
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Connection>();

    if (conn) {
      // Best effort: the user may already have revoked access on Google's side
      try {
        const token = await getAccessToken(admin, conn);
        await calendarApi(token, `/calendars/${encodeURIComponent(conn.calendar_id)}`, { method: "DELETE" });
      } catch (e) {
        console.warn("[gcal disconnect] calendar not removed", e);
      }
      const refresh = await decrypt(conn.refresh_token_enc).catch(() => null);
      if (refresh) await revokeToken(refresh);
    }

    await admin.from("google_calendar_sync_map").delete().eq("user_id", user.id);
    await admin.from("google_calendar_connections").delete().eq("user_id", user.id);
    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("[gcal disconnect]", e);
    return jsonResponse({ error: "Não foi possível desconectar o Google Agenda." }, 500);
  }
});
