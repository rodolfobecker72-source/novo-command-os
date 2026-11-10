// ============= Appointments (compromissos do calendário) =============

export type AppointmentKind = 'reuniao' | 'gravacao' | 'entrega' | 'visita' | 'outro';

export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = {
  reuniao: 'Reunião',
  gravacao: 'Gravação',
  entrega: 'Entrega',
  visita: 'Visita',
  outro: 'Outro',
};

export const APPOINTMENT_KIND_COLORS: Record<AppointmentKind, { bg: string; border: string; text: string; dot: string }> = {
  reuniao: {
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/30',
    text: 'text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  gravacao: {
    bg: 'bg-fuchsia-500/15',
    border: 'border-fuchsia-500/30',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    dot: 'bg-fuchsia-500',
  },
  entrega: {
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  visita: {
    bg: 'bg-teal-500/15',
    border: 'border-teal-500/30',
    text: 'text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
  outro: {
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/30',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-500',
  },
};

export interface Appointment {
  id: string;
  workspaceId: string;
  createdBy: string;
  assignedTo: string[];
  /** Invited by e-mail (Google sends the invitation from the organizer's calendar) */
  guestEmails: string[];
  title: string;
  kind: AppointmentKind;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  color: string | null;
  budgetId: string | null;
  clientId: string | null;
  leadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewAppointmentInput = Omit<Appointment, 'id' | 'workspaceId' | 'createdBy' | 'createdAt' | 'updatedAt'>;

export function appointmentFromDb(row: any): Appointment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    createdBy: row.created_by,
    assignedTo: row.assigned_to || [],
    guestEmails: row.guest_emails || [],
    title: row.title,
    kind: row.kind,
    description: row.description || '',
    location: row.location || '',
    startAt: new Date(row.start_at),
    endAt: row.end_at ? new Date(row.end_at) : null,
    allDay: row.all_day,
    color: row.color,
    budgetId: row.budget_id,
    clientId: row.client_id,
    leadId: row.lead_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function appointmentToDb(a: Partial<Appointment>): any {
  const row: any = {};
  if (a.assignedTo !== undefined) row.assigned_to = a.assignedTo;
  if (a.guestEmails !== undefined) row.guest_emails = a.guestEmails;
  if (a.title !== undefined) row.title = a.title;
  if (a.kind !== undefined) row.kind = a.kind;
  if (a.description !== undefined) row.description = a.description;
  if (a.location !== undefined) row.location = a.location;
  if (a.startAt !== undefined) row.start_at = a.startAt.toISOString();
  if (a.endAt !== undefined) row.end_at = a.endAt ? a.endAt.toISOString() : null;
  if (a.allDay !== undefined) row.all_day = a.allDay;
  if (a.color !== undefined) row.color = a.color;
  if (a.budgetId !== undefined) row.budget_id = a.budgetId;
  if (a.clientId !== undefined) row.client_id = a.clientId;
  if (a.leadId !== undefined) row.lead_id = a.leadId;
  return row;
}
