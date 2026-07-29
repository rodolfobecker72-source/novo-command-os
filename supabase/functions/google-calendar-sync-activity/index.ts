// Refactored: sync a project activity to each assignee's Google Calendar via the
// Lovable App User Connector gateway using per-user stored connection keys.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callAsUser, getUserConnectionKey, jsonResponse, corsHeaders } from "../_shared/appUserConnector.ts";

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

    const body = await req.json();
    const activityId: string = body.activity_id;
    const action: "upsert" | "delete" = body.action ?? "upsert";
    if (!activityId) return jsonResponse({ error: "activity_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const deleteEvent = async (userId: string, eventId: string) => {
      const key = await getUserConnectionKey(userId);
      if (!key) return; // user isn't connected — nothing to delete on Google
      const r = await callAsUser({
        connectionKey: key,
        path: `/calendar/v3/calendars/primary/events/${eventId}`,
        method: "DELETE",
      });
      if (!r.ok && r.status !== 404 && r.status !== 410 && r.status !== 401) {
        console.warn("[sync] delete failed", userId, eventId, r.status, r.text);
      }
    };

    // === DELETE ===
    if (action === "delete") {
      const { data: maps } = await admin
        .from("google_calendar_sync_map")
        .select("*")
        .eq("activity_id", activityId);
      for (const m of maps ?? []) await deleteEvent(m.user_id, m.google_event_id);
      await admin.from("google_calendar_sync_map").delete().eq("activity_id", activityId);
      return jsonResponse({ ok: true, deleted: maps?.length ?? 0 });
    }

    // === UPSERT ===
    const { data: activity, error: actErr } = await admin
      .from("project_activities")
      .select("*")
      .eq("id", activityId)
      .maybeSingle();
    if (actErr || !activity) return jsonResponse({ error: "activity not found" }, 404);

    const { data: project } = await admin
      .from("project_cards")
      .select("project_name, client_name, proposal_id")
      .eq("id", activity.project_card_id)
      .maybeSingle();

    const assigneeIds: string[] = Array.isArray(activity.assigned_to_user_ids) && activity.assigned_to_user_ids.length > 0
      ? activity.assigned_to_user_ids
      : (activity.assigned_to_user_id ? [activity.assigned_to_user_id] : []);

    // No date or no assignees → wipe any prior maps.
    if (!activity.due_date || assigneeIds.length === 0) {
      const { data: existing } = await admin
        .from("google_calendar_sync_map")
        .select("*")
        .eq("activity_id", activityId);
      for (const m of existing ?? []) await deleteEvent(m.user_id, m.google_event_id);
      await admin.from("google_calendar_sync_map").delete().eq("activity_id", activityId);
      return jsonResponse({ ok: true, skipped: "no due_date or no assignees" });
    }

    const projectLabel = project?.project_name || project?.proposal_id || "Projeto";
    const eventBody = {
      summary: `[${projectLabel}] ${activity.title}`,
      description: [
        activity.title,
        project?.client_name ? `Cliente: ${project.client_name}` : null,
        project?.proposal_id ? `Proposta: ${project.proposal_id}` : null,
        `Status: ${activity.status}`,
      ].filter(Boolean).join("\n"),
      start: { date: activity.due_date },
      end: { date: activity.due_date },
      source: { title: "Hero Command", url: "https://command.hero.rec.br" },
    };

    const { data: existingMaps } = await admin
      .from("google_calendar_sync_map")
      .select("*")
      .eq("activity_id", activityId);
    const existingByUser = new Map((existingMaps ?? []).map((m: any) => [m.user_id, m]));

    // Drop events for users that are no longer assignees.
    for (const m of existingMaps ?? []) {
      if (!assigneeIds.includes(m.user_id)) {
        await deleteEvent(m.user_id, m.google_event_id);
        await admin.from("google_calendar_sync_map").delete().eq("id", m.id);
      }
    }

    const results: Array<{ user_id: string; status: string; error?: string }> = [];
    for (const uid of assigneeIds) {
      const existing = existingByUser.get(uid);
      try {
        if (existing) {
          const r = await callAsUser({
            appUserId: uid,
            path: `/calendar/v3/calendars/primary/events/${existing.google_event_id}`,
            method: "PATCH",
            body: eventBody,
          });
          if (r.ok) {
            await admin.from("google_calendar_sync_map")
              .update({ last_synced_at: new Date().toISOString() })
              .eq("id", existing.id);
            results.push({ user_id: uid, status: "updated" });
          } else if (r.status === 404 || r.status === 410) {
            // Recreate if deleted in Google.
            const cr = await callAsUser({
              appUserId: uid,
              path: "/calendar/v3/calendars/primary/events",
              method: "POST",
              body: eventBody,
            });
            if (cr.ok) {
              await admin.from("google_calendar_sync_map")
                .update({ google_event_id: cr.data.id, last_synced_at: new Date().toISOString() })
                .eq("id", existing.id);
              results.push({ user_id: uid, status: "recreated" });
            } else {
              results.push({ user_id: uid, status: "error", error: cr.text });
            }
          } else if (r.status === 401) {
            results.push({ user_id: uid, status: "not_connected" });
          } else {
            results.push({ user_id: uid, status: "error", error: r.text });
          }
        } else {
          const cr = await callAsUser({
            appUserId: uid,
            path: "/calendar/v3/calendars/primary/events",
            method: "POST",
            body: eventBody,
          });
          if (cr.ok) {
            await admin.from("google_calendar_sync_map").insert({
              user_id: uid,
              workspace_id: activity.workspace_id,
              activity_id: activityId,
              google_event_id: cr.data.id,
            });
            results.push({ user_id: uid, status: "created" });
          } else if (cr.status === 401) {
            results.push({ user_id: uid, status: "not_connected" });
          } else {
            results.push({ user_id: uid, status: "error", error: cr.text });
          }
        }
      } catch (e) {
        results.push({ user_id: uid, status: "error", error: String(e) });
      }
    }

    return jsonResponse({ ok: true, results });
  } catch (e) {
    console.error("[sync-activity]", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
