// Two jobs, both called by pg_cron with the Vault secret gcal_worker_secret in
// the x-worker-secret header:
//
// - Queue (every minute, only when google_calendar_sync_queue has work): for
//   each queued activity or appointment, creates, updates or removes the
//   matching event in the "Command OS" calendar of every connected
//   participant. Several runs can overlap safely: jobs are claimed with
//   FOR UPDATE SKIP LOCKED.
// - Pull (body {"mode":"pull"}, every two minutes while someone is
//   connected): reads what changed in each "Command OS" calendar since the
//   last pull (Google's sync token). Events people typed there become
//   appointments; edits and deletions of appointments made in Google are
//   applied in Command OS. Activities are only ever written from Command OS.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  activityEvent, activityRecipients, appointmentEvent, appointmentFromGoogle, appointmentRecipients,
  commandSourceOf, eventMatches, GoogleEvent, GoogleEventIn, guestsFromGoogle,
} from "../_shared/calendarEvents.ts";
import {
  adminClient, APP_URL, calendarApi, Connection, createAppCalendar, getAccessToken, jsonResponse,
  NeedsReconnectError, safeEqual, vaultSecret,
} from "../_shared/googleCalendar.ts";

const TIME_BUDGET_MS = 45_000;
const BATCH_SIZE = 20;
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
// Events typed in Google are imported only around today
const IMPORT_PAST_MS = 30 * DAY_MS;
const IMPORT_FUTURE_MS = 366 * DAY_MS;

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
  /** Appointments: the organizer's copy carries the e-mail guests */
  ownerId?: string;
  ownerEvent?: GoogleEvent;
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
    return {
      workspaceId: ap.workspace_id,
      recipients: appointmentRecipients(ap),
      event: appointmentEvent(ap, APP_URL),
      ownerId: ap.created_by,
      ownerEvent: appointmentEvent(ap, APP_URL, true),
    };
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
        // Guests of the organizer's copy are told it was cancelled
        const r = await calendarApi(
          token,
          `/calendars/${encodeURIComponent(conn.calendar_id)}/events/${encodeURIComponent(m.google_event_id)}?sendUpdates=all`,
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
    const isOwner = type === "appointment" && conn.user_id === target.ownerId;
    const event = isOwner && target.ownerEvent ? target.ownerEvent : target.event;
    // Only the organizer's copy has guests; they hear about real changes only
    const send = `sendUpdates=${isOwner ? "all" : "none"}`;

    if (existing) {
      const path = `${events}/${encodeURIComponent(existing.google_event_id)}`;
      if (event.attendees?.length) {
        // Rewriting an unchanged event would e-mail every guest again
        const cur = await calendarApi(token, path);
        if (cur.ok && eventMatches(cur.data as GoogleEventIn, event)) {
          if (!commandSourceOf(cur.data as GoogleEventIn)) {
            await calendarApi(token, `${path}?sendUpdates=none`, {
              method: "PATCH",
              body: { extendedProperties: event.extendedProperties, source: event.source },
            });
          }
          await this.admin.from("google_calendar_sync_map")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("id", existing.id);
          return;
        }
      }
      const r = await calendarApi(token, `${path}?${send}`, {
        method: "PUT",
        body: event,
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

    let r = await calendarApi(token, `${events}?${send}`, { method: "POST", body: event });
    if (r.status === 404) {
      // The user deleted the "Command OS" calendar: make a new one and
      // send everything of theirs again.
      await this.recreateCalendar(conn, token);
      r = await calendarApi(token, `/calendars/${encodeURIComponent(conn.calendar_id)}/events?${send}`, {
        method: "POST",
        body: event,
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
    await this.admin.from("google_calendar_connections")
      .update({ calendar_id: conn.calendar_id, sync_token: null })
      .eq("user_id", conn.user_id);
    await this.admin.from("google_calendar_sync_map").delete().eq("user_id", conn.user_id);
    await this.admin.rpc("gcal_enqueue_user_backfill", { p_user: conn.user_id });
  }
}

// ============================================================================
// Pull: Google -> Command OS
// ============================================================================
type PullConnection = Connection & { sync_token: string | null };

interface PulledMap {
  id: string;
  source_type: SourceType;
  source_id: string;
  google_event_id: string;
}

class Pull {
  private workspaces = new Map<string, string | null>();

  constructor(private admin: SupabaseClient) {}

  private async workspaceOf(userId: string): Promise<string | null> {
    if (!this.workspaces.has(userId)) {
      const { data } = await this.admin.from("workspace_members").select("workspace_id").eq("user_id", userId).maybeSingle();
      this.workspaces.set(userId, data?.workspace_id ?? null);
    }
    return this.workspaces.get(userId)!;
  }

  /** Reads everything that changed in the user's calendar since the last pull. */
  async pullConnection(conn: PullConnection) {
    const token = await getAccessToken(this.admin, conn);
    const path = `/calendars/${encodeURIComponent(conn.calendar_id)}/events`;
    let syncToken = conn.sync_token;
    let pageToken: string | undefined;
    let restarted = false;

    for (;;) {
      const q = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
      if (syncToken) q.set("syncToken", syncToken);
      if (pageToken) q.set("pageToken", pageToken);
      const r = await calendarApi(token, `${path}?${q}`);
      if (r.status === 410 && !restarted) {
        // Token expired on Google's side: read the whole calendar again
        syncToken = null;
        pageToken = undefined;
        restarted = true;
        continue;
      }
      // Calendar deleted: the queue recreates it on the next write
      if (r.status === 404) return;
      if (!r.ok) throw new Error(`list events ${r.status}: ${JSON.stringify(r.data)}`);

      await this.applyPage(conn, (r.data?.items ?? []) as GoogleEventIn[]);

      if (r.data?.nextPageToken) {
        pageToken = r.data.nextPageToken;
        continue;
      }
      await this.admin.from("google_calendar_connections")
        .update({ sync_token: r.data?.nextSyncToken ?? null, pulled_at: new Date().toISOString() })
        .eq("user_id", conn.user_id);
      return;
    }
  }

  private async applyPage(conn: PullConnection, items: GoogleEventIn[]) {
    if (!items.length) return;
    const { data: maps, error } = await this.admin
      .from("google_calendar_sync_map")
      .select("id, source_type, source_id, google_event_id")
      .eq("user_id", conn.user_id)
      .in("google_event_id", items.map((e) => e.id));
    if (error) throw error;
    const byEvent = new Map(((maps ?? []) as PulledMap[]).map((m) => [m.google_event_id, m]));
    for (const e of items) {
      try {
        await this.applyEvent(conn, e, byEvent.get(e.id));
      } catch (err) {
        // One bad event must not hold back the rest of the calendar
        console.error("[gcal pull]", conn.user_id, e.id, err);
      }
    }
  }

  private async applyEvent(conn: PullConnection, e: GoogleEventIn, m: PulledMap | undefined) {
    if (m) {
      // Activities are written only from Command OS
      if (m.source_type !== "appointment") return;
      const { data: ap, error } = await this.admin.from("appointments").select("*").eq("id", m.source_id).maybeSingle();
      if (error) throw error;
      if (!ap) return;

      if (e.status === "cancelled") {
        // The organizer deleting it cancels it for everyone; a participant only leaves it
        if (ap.created_by === conn.user_id) {
          await this.admin.from("appointments").delete().eq("id", ap.id);
        } else {
          const assigned = ((ap.assigned_to ?? []) as string[]).filter((u) => u !== conn.user_id);
          await this.admin.from("appointments").update({ assigned_to: assigned }).eq("id", ap.id);
        }
        return;
      }
      // Our own write coming back (the organizer's copy also carries the guests)
      const isOwner = ap.created_by === conn.user_id;
      if (eventMatches(e, appointmentEvent(ap, APP_URL, isOwner))) return;
      const fields = appointmentFromGoogle(e, ap.kind);
      if (fields) {
        await this.admin.from("appointments")
          .update({ ...fields, ...(isOwner ? { guest_emails: guestsFromGoogle(e) } : {}) })
          .eq("id", ap.id);
      }
      return;
    }

    if (e.status === "cancelled" || commandSourceOf(e)) return;
    const fields = appointmentFromGoogle(e);
    if (!fields) return;
    const start = new Date(fields.start_at).getTime();
    if (start < Date.now() - IMPORT_PAST_MS || start > Date.now() + IMPORT_FUTURE_MS) return;
    const workspaceId = await this.workspaceOf(conn.user_id);
    if (!workspaceId) return;

    // Map first, so the queue updates this same Google event instead of creating another
    const id = crypto.randomUUID();
    const { error: mapError } = await this.admin.from("google_calendar_sync_map").insert({
      user_id: conn.user_id,
      workspace_id: workspaceId,
      source_type: "appointment",
      source_id: id,
      google_event_id: e.id,
      origin: "google",
      last_synced_at: new Date().toISOString(),
    });
    if (mapError) throw mapError;
    const { error } = await this.admin.from("appointments").insert({
      id,
      workspace_id: workspaceId,
      created_by: conn.user_id,
      assigned_to: [],
      guest_emails: guestsFromGoogle(e),
      kind: "outro",
      ...fields,
    });
    if (error) {
      await this.admin.from("google_calendar_sync_map").delete().eq("user_id", conn.user_id).eq("source_id", id);
      throw error;
    }
  }
}

async function runPull(admin: SupabaseClient, started: number): Promise<number> {
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("*")
    .eq("status", "connected")
    .order("pulled_at", { ascending: true, nullsFirst: true });
  if (error) throw error;
  const pull = new Pull(admin);
  let done = 0;
  for (const conn of (data ?? []) as PullConnection[]) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      await pull.pullConnection(conn);
      done++;
    } catch (e) {
      if (!(e instanceof NeedsReconnectError)) console.error("[gcal pull]", conn.user_id, e);
    }
  }
  return done;
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
  const secret = await vaultSecret("gcal_worker_secret").catch(() => "");
  if (!secret || !safeEqual(req.headers.get("x-worker-secret") ?? "", secret)) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const admin = adminClient();
  const started = Date.now();
  let body: { mode?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }
  if (body.mode === "pull") {
    return jsonResponse({ pulled: await runPull(admin, started) });
  }

  const sync = new Sync(admin);
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
