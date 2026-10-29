// Connection state for the logged-in user, read from the database only
// (no call to Google), so it is cheap to ask for on every screen load.
import { adminClient, corsHeaders, getCaller, isConfigured, jsonResponse } from "../_shared/googleCalendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getCaller(req);
    if (!user) return jsonResponse({ error: "Não autenticado" }, 401);

    const { data } = await adminClient()
      .from("google_calendar_connections")
      .select("email, status")
      .eq("user_id", user.id)
      .maybeSingle();

    return jsonResponse({
      available: isConfigured(),
      connected: data?.status === "connected",
      needsReconnect: data?.status === "needs_reconnect",
      email: data?.email ?? null,
    });
  } catch (e) {
    console.error("[gcal status]", e);
    return jsonResponse({ error: "Não foi possível consultar o Google Agenda." }, 500);
  }
});
