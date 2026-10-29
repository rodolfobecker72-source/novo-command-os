// Builds the Google Calendar event for an activity or appointment.
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
}

export interface GoogleEvent {
  summary: string;
  description: string;
  location?: string;
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
  source: { title: string; url: string };
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
export function activityEvent(a: ActivityRow, project: ProjectInfo | null, appUrl: string): GoogleEvent | null {
  if (!a.due_date) return null;
  const last = a.end_date && a.end_date > a.due_date ? a.end_date : a.due_date;
  const label = project?.project_name || project?.proposal_id || "Projeto";
  const tags = [a.is_captacao ? "Captação" : null, a.is_delivery ? "Entrega" : null].filter(Boolean);
  return {
    summary: `[${label}] ${a.title}`,
    description: [
      tags.length ? tags.join(" · ") : null,
      project?.client_name ? `Cliente: ${project.client_name}` : null,
      project?.proposal_id ? `Proposta: ${project.proposal_id}` : null,
      `Status: ${ACTIVITY_STATUS[a.status] ?? a.status}`,
    ].filter(Boolean).join("\n"),
    start: { date: a.due_date },
    end: { date: addDays(last, 1) },
    source: { title: "Command OS", url: appUrl },
  };
}

export function appointmentEvent(a: AppointmentRow, appUrl: string): GoogleEvent {
  const kind = APPOINTMENT_KIND[a.kind] ?? a.kind;
  const base = {
    summary: a.title,
    description: [kind, a.description?.trim() || null].filter(Boolean).join("\n\n"),
    ...(a.location?.trim() ? { location: a.location.trim() } : {}),
    source: { title: "Command OS", url: appUrl },
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
