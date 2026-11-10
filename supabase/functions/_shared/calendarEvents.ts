// Builds the Google Calendar event for an activity or appointment, and reads
// back events that people create or change in their "Command OS" calendar.
// Pure functions (no Deno APIs) so they can be unit tested with vitest.

export const TIME_ZONE = "America/Sao_Paulo";

export interface ActivityRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  end_date: string | null;
  assigned_to_user_id: string | null;
  assigned_to_user_ids: string[] | null;
  is_delivery: boolean;
  is_captacao: boolean;
  /** "HH:MM" or "HH:MM:SS"; without it the activity is an all-day event */
  start_time?: string | null;
  end_time?: string | null;
}

export interface ProjectInfo {
  project_name: string | null;
  client_name: string | null;
  proposal_id: string | null;
}

export interface AppointmentRow {
  id: string;
  title: string;
  kind: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  created_by: string;
  assigned_to: string[] | null;
  /** People invited by e-mail; Google sends them the invitation from the organizer's calendar */
  guest_emails?: string[] | null;
}

export interface GoogleEvent {
  summary: string;
  description: string;
  location?: string;
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
  source: { title: string; url: string };
  /** Marks events created by Command OS, so reading the calendar back never imports them */
  extendedProperties: { private: { command_source: string } };
  /** Only on the organizer's copy of an appointment */
  attendees?: { email: string }[];
}

/** Event as Google returns it when listing a calendar. */
export interface GoogleEventIn {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
  attendees?: { email?: string; self?: boolean; organizer?: boolean; resource?: boolean }[];
}

/** Appointment fields taken from a Google event. */
export interface AppointmentFields {
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
}

const ACTIVITY_STATUS: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

const APPOINTMENT_KIND: Record<string, string> = {
  reuniao: "Reunião",
  gravacao: "Gravação",
  entrega: "Entrega",
  visita: "Visita",
  outro: "Outro",
};

/** YYYY-MM-DD plus n days (calendar arithmetic, no time zone involved). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Calendar date of an instant in the app's time zone. */
export function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

/** São Paulo has had no daylight saving time since 2019. */
const UTC_OFFSET = "-03:00";

/** "HH:MM" from "HH:MM" or "HH:MM:SS"; null when missing or malformed. */
export function hhmm(t: string | null | undefined): string | null {
  const m = /^(\d{2}):(\d{2})/.exec(t ?? "");
  return m ? `${m[1]}:${m[2]}` : null;
}

function plusOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return h >= 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sourceTag(type: "activity" | "appointment", id: string) {
  return { private: { command_source: `${type}:${id}` } };
}

function unique(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export function activityRecipients(a: ActivityRow): string[] {
  if (!a.due_date) return [];
  const ids = a.assigned_to_user_ids?.length ? a.assigned_to_user_ids : [a.assigned_to_user_id];
  return unique(ids);
}

export function appointmentRecipients(a: AppointmentRow): string[] {
  return unique([a.created_by, ...(a.assigned_to ?? [])]);
}

// All-day events: Google's end date is exclusive, so a one-day event ends the next day.
// With a start time the event has hours, from the first day to the last.
export function activityEvent(a: ActivityRow, project: ProjectInfo | null, appUrl: string): GoogleEvent | null {
  if (!a.due_date) return null;
  const last = a.end_date && a.end_date > a.due_date ? a.end_date : a.due_date;
  const label = project?.project_name || project?.proposal_id || "Projeto";
  const tags = [a.is_captacao ? "Captação" : null, a.is_delivery ? "Entrega" : null].filter(Boolean);
  const startTime = hhmm(a.start_time);
  let endTime = hhmm(a.end_time);
  if (startTime && (!endTime || (last === a.due_date && endTime <= startTime))) endTime = plusOneHour(startTime);
  return {
    summary: `[${label}] ${a.title}`,
    description: [
      tags.length ? tags.join(" · ") : null,
      project?.client_name ? `Cliente: ${project.client_name}` : null,
      project?.proposal_id ? `Proposta: ${project.proposal_id}` : null,
      `Status: ${ACTIVITY_STATUS[a.status] ?? a.status}`,
    ].filter(Boolean).join("\n"),
    ...(startTime
      ? {
        start: { dateTime: `${a.due_date}T${startTime}:00`, timeZone: TIME_ZONE },
        end: { dateTime: `${last}T${endTime}:00`, timeZone: TIME_ZONE },
      }
      : { start: { date: a.due_date }, end: { date: addDays(last, 1) } }),
    source: { title: "Command OS", url: appUrl },
    extendedProperties: sourceTag("activity", a.id),
  };
}

/** First line of an appointment's description in Google ("Outro" adds nothing). */
function kindLine(kind: string): string | null {
  return kind === "outro" ? null : (APPOINTMENT_KIND[kind] ?? kind);
}

/** Lowercase, valid and without repeats. */
export function normalizeEmails(emails: (string | null | undefined)[] | null | undefined): string[] {
  const valid = (emails ?? [])
    .map((e) => (e ?? "").trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  return [...new Set(valid)].sort();
}

/**
 * `withGuests`: the copy in the organizer's calendar, which carries the
 * e-mail guests (each participant's own copy has none, so nobody is invited twice).
 */
export function appointmentEvent(a: AppointmentRow, appUrl: string, withGuests = false): GoogleEvent {
  const guests = withGuests ? normalizeEmails(a.guest_emails) : [];
  const base = {
    summary: a.title,
    description: [kindLine(a.kind), a.description?.trim() || null].filter(Boolean).join("\n\n"),
    ...(a.location?.trim() ? { location: a.location.trim() } : {}),
    source: { title: "Command OS", url: appUrl },
    extendedProperties: sourceTag("appointment", a.id),
    ...(guests.length ? { attendees: guests.map((email) => ({ email })) } : {}),
  };
  const hasEnd = a.end_at !== null && new Date(a.end_at).getTime() > new Date(a.start_at).getTime();

  if (a.all_day) {
    const first = localDate(a.start_at);
    const lastCandidate = hasEnd ? localDate(a.end_at!) : first;
    const last = lastCandidate > first ? lastCandidate : first;
    return { ...base, start: { date: first }, end: { date: addDays(last, 1) } };
  }

  const end = hasEnd ? a.end_at! : new Date(new Date(a.start_at).getTime() + 60 * 60 * 1000).toISOString();
  return {
    ...base,
    start: { dateTime: new Date(a.start_at).toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: new Date(end).toISOString(), timeZone: TIME_ZONE },
  };
}

// ============================================================================
// Reading the calendar back
// ============================================================================

/** "activity:<id>" or "appointment:<id>" when Command OS created the event. */
export function commandSourceOf(e: GoogleEventIn): string | null {
  return e.extendedProperties?.private?.command_source ?? null;
}

const instant = (t: { date?: string; dateTime?: string } | undefined) =>
  t?.dateTime ? `dt:${new Date(t.dateTime).getTime()}` : t?.date ? `d:${t.date}` : "";

/** E-mail guests of a Google event (not the organizer, the calendar itself or rooms). */
export function guestsFromGoogle(e: GoogleEventIn): string[] {
  return normalizeEmails((e.attendees ?? []).filter((a) => !a.self && !a.organizer && !a.resource).map((a) => a.email));
}

/** Whether the Google event still shows exactly what Command OS last sent. */
export function eventMatches(google: GoogleEventIn, expected: GoogleEvent): boolean {
  const expectedGuests = normalizeEmails((expected.attendees ?? []).map((a) => a.email));
  return guestsFromGoogle(google).join(",") === expectedGuests.join(",")
    && (google.summary ?? "") === expected.summary
    && (google.description ?? "").trim() === expected.description.trim()
    && (google.location ?? "").trim() === (expected.location ?? "")
    && instant(google.start) === instant(expected.start)
    && instant(google.end) === instant(expected.end);
}

/** Google Calendar's web editor saves descriptions as simple HTML. */
export function plainText(html: string): string {
  if (!/<[a-z][^>]*>|&[a-z#0-9]+;/i.test(html)) return html.trim();
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Appointment fields from an event typed in Google. `kind` is the
 * appointment's current kind, whose label Command OS puts at the top of the
 * description, so it is not copied back into the description.
 */
export function appointmentFromGoogle(e: GoogleEventIn, kind = "outro"): AppointmentFields | null {
  if (!e.start || !(e.start.date || e.start.dateTime)) return null;
  let description = plainText(e.description ?? "");
  // Strip the kind label Command OS writes on top (older events also carry "Outro")
  const line = APPOINTMENT_KIND[kind] ?? kind;
  if (line && description === line) description = "";
  else if (line && description.startsWith(`${line}\n\n`)) description = description.slice(line.length + 2).trim();
  const base = { title: (e.summary ?? "").trim() || "(sem título)", description, location: (e.location ?? "").trim() };

  if (e.start.date) {
    const endExclusive = e.end?.date && e.end.date > e.start.date ? e.end.date : addDays(e.start.date, 1);
    const last = addDays(endExclusive, -1);
    return {
      ...base,
      all_day: true,
      start_at: `${e.start.date}T00:00:00${UTC_OFFSET}`,
      end_at: `${last}T23:59:00${UTC_OFFSET}`,
    };
  }
  const start = new Date(e.start.dateTime!);
  const end = e.end?.dateTime ? new Date(e.end.dateTime) : null;
  return {
    ...base,
    all_day: false,
    start_at: start.toISOString(),
    end_at: end && end > start ? end.toISOString() : null,
  };
}
