// Processes google_calendar_sync_queue: for each queued activity or
// appointment, creates, updates or removes the matching event in the
// "Command OS" calendar of every connected participant.
//
// Called every minute by pg_cron (only when the queue has work), with the
// shared secret GCAL_WORKER_SECRET in the x-worker-secret header. Several
// runs can overlap safely: jobs are claimed with FOR UPDATE SKIP LOCKED.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  activityEvent, activityRecipients, appointmentEvent, appointmentRecipients, GoogleEvent,
} from "../_shared/calendarEvents.ts";
import {
  adminClient, APP_URL, calendarApi, Connection, createAppCalendar, getAccessToken, jsonResponse,
  NeedsReconnectError, safeEqual,
} from "../_shared/googleCalendar.ts";

const TIME_BUDGET_MS = 45_000;
const BATCH_SIZE = 20;
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 8;

type SourceType = "activity" | "appointment";

interface Job {
  id: number;
  source_type: SourceType;
  source_id: string;
  enqueued_at: string;
  attempts: number;
}

interface SyncTarget {
  workspaceId: string;
  recipients: string[];
  event: GoogleEvent;
}

interface MapRow {
  id: string;
  user_id: string;
  google_event_id: string;
}

class Sync {
  // Cached for the whole run: many jobs touch the same users
  private connections = new Map<string, Connection | null>();
  private tokens = new Map<string, Promise<string>>();

  constructor(private admin: SupabaseClient) {}

  async connectionsFor(userIds: string[]): Promise<Map<string, Connection>> {
    const missing = userIds.filter((id) => !this.connections.has(id));
    if (missing.length) {
      const { data, error } = await this.admin
        .from("google_calendar_connections")
        .select("*")
        .in("user_id", missing)
        .eq("status", "connected");
      if (error) throw error;
      for (const id of missing) this.connections.set(id, null);
      for (const row of (data ?? []) as Connection[]) this.connections.set(row.user_id, row);
    }
    const out = new Map<string, Connection>();
    for (const id of userIds) {
      const c = this.connections.get(id);
      if (c && c.status === "connected") out.set(id, c);
    }
    return out;
  }

  private token(conn: Connection): Promise<string> {
    let t = this.tokens.get(conn.user_id);
    if (!t) {
      t = getAccessToken(this.admin, conn);
      this.tokens.set(conn.user_id, t);
      t.catch(() => this.tokens.delete(conn.user_id));
    }
    return t;
  }

  private async loadTarget(type: SourceType, id: string): Promise<SyncTarget | null> {
    if (type === "activity") {
      const { data: a, error } = await this.admin.from("project_activities").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!a) return null;
      const { data: project } = await this.admin
        .from("project_cards")
        .select("project_name, client_name, proposal_id")
        .eq("id", a.project_card_id)
        .maybeSingle();
      const event = activityEvent(a, project, APP_URL);
      return event ? { workspaceId: a.workspace_id, recipients: activityRecipients(a), event } : null;
    }
    const { data: ap, error } = await this.admin.from("appointments").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!ap) return null;
    return { workspaceId: ap.workspace_id, recipients: appointmentRecipients(ap), event: appointmentEvent(ap, APP_URL) };
  }

  async syncSource(type: SourceType, id: string) {
    const target = await this.loadTarget(type, id);
    const { data: maps, error } = await this.admin
      .from("google_calendar_sync_map")
      .select("id, user_id, google_event_id")
      .eq("source_type", type)
      .eq("source_id", id);
    if (error) throw error;

    const wanted = new Set(target?.recipients ?? []);
    for (const m of (maps ?? []) as MapRow[]) {
      if (!wanted.has(m.user_id)) await this.removeEvent(m);
    }
    if (!target) return;

    const conns = await this.connectionsFor(target.recipients);
    for (const [userId, conn] of conns) {
      const existing = (maps ?? []).find((m: MapRow) => m.user_id === userId) as MapRow | undefined;
      try {
        await this.putEvent(conn, existing, type, id, target);
      } catch (e) {
        // Lost access for this user: skip them, the others still get the event
        if (!(e instanceof NeedsReconnectError)) throw e;
      }
    }
  }

  private async removeEvent(m: MapRow) {
    const conn = (await this.connectionsFor([m.user_id])).get(m.user_id);
    if (conn) {
      try {
        const token = await this.token(conn);
        const r = await calendarApi(
          token,
          `/calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(m.google_event_id)}`,
          { method: "DELETE" },
        );
        if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`delete event ${r.status}`);
      } catch (e) {
        if (!(e instanceof NeedsReconnectError)) throw e;
      }
    }
    await this.admin.from("google_calendar_sync_map").delete().eq("id", m.id);
  }

  private async putEvent(conn: Connection, existing: MapRow | undefined, type: SourceType, id: string, target: SyncTarget) {
    const token = await this.token(conn);
    const events = `/calendars/${encodeURIComponent(conn.calendar_id)}/events`;

    if (existing) {
      const r = await calendarApi(token, `${events}/${encodeURIComponent(existing.google_event_id)}`, {
        method: "PUT",
        body: target.event,
      });
      if (r.ok) {
        await this.admin.from("google_calendar_sync_map")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", existing.id);
        return;
      }
      // Event deleted on Google's side: create it again below
      if (r.status !== 404 && r.status !== 410) throw new Error(`update event ${r.status}: ${JSON.stringify(r.data)}`);
    }

    let r = await calendarApi(token, events, { method: "POST", body: target.event });
    if (r.status === 404) {
      // The user deleted the "Command OS" calendar: make a new one and
      // send everything of theirs again.
      await this.recreateCalendar(conn, token);
      r = await calendarApi(token, `/calendars/${encodeURIComponent(conn.calendar_id)}/events`, {
        method: "POST",
        body: target.event,
      });
    }
    if (!r.ok || !r.data?.id) throw new Error(`create event ${r.status}: ${JSON.stringify(r.data)}`);

    const { error } = await this.admin.from("google_calendar_sync_map").upsert(
      {
        user_id: conn.user_id,
        workspace_id: target.workspaceId,
        source_type: type,
        source_id: id,
        google_event_id: r.data.id,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source_type,source_id" },
    );
    if (error) throw error;
  }

  private async recreateCalendar(conn: Connection, token: string) {
    conn.calendar_id = await createAppCalendar(token);
    await this.admin.from("google_calendar_connections").update({ calendar_id: conn.calendar_id }).eq("user_id", conn.user_id);
    await this.admin.from("google_calendar_sync_map").delete().eq("user_id", conn.user_id);
    await this.admin.rpc("gcal_enqueue_user_backfill", { p_user: conn.user_id });
  }
}

async function finishJob(admin: SupabaseClient, job: Job, error: unknown) {
  const queue = admin.from("google_calendar_sync_queue");
  if (!error) {
    // Only remove the job if nothing changed while it was being processed
    const { data } = await queue.delete().eq("id", job.id).eq("enqueued_at", job.enqueued_at).select("id");
    if (!data?.length) await admin.from("google_calendar_sync_queue").update({ locked_until: null }).eq("id", job.id);
    return;
  }
  console.error("[gcal worker]", job.source_type, job.source_id, `attempt ${job.attempts}`, error);
  if (job.attempts >= MAX_ATTEMPTS) {
    await queue.delete().eq("id", job.id);
    return;
  }
  const delayMin = Math.min(2 ** job.attempts, 60);
  await queue.update({
    locked_until: null,
    run_after: new Date(Date.now() + delayMin * 60_000).toISOString(),
    last_error: String(error).slice(0, 500),
  }).eq("id", job.id);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("GCAL_WORKER_SECRET") ?? "";
  if (!secret || !safeEqual(req.headers.get("x-worker-secret") ?? "", secret)) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const admin = adminClient();
  const sync = new Sync(admin);
  const started = Date.now();
  let processed = 0;

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: jobs, error } = await admin.rpc("gcal_claim_jobs", { p_limit: BATCH_SIZE });
    if (error) {
      console.error("[gcal worker] claim", error);
      break;
    }
    if (!jobs?.length) break;

    const pending = [...(jobs as Job[])];
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      for (let job = pending.shift(); job; job = pending.shift()) {
        let failure: unknown = null;
        try {
          await sync.syncSource(job.source_type, job.source_id);
        } catch (e) {
          failure = e;
        }
        await finishJob(admin, job, failure);
        processed++;
      }
    }));
  }

  return jsonResponse({ processed });
});
