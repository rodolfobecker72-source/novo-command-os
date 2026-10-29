import { describe, it, expect } from 'vitest';
import {
  activityEvent, activityRecipients, addDays, appointmentEvent, appointmentRecipients,
  type ActivityRow, type AppointmentRow,
} from '../../supabase/functions/_shared/calendarEvents';

const APP = 'https://app.example';

const activity = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  id: 'a1', title: 'Gravar entrevista', status: 'em_andamento', due_date: '2026-11-10', end_date: null,
  assigned_to_user_id: null, assigned_to_user_ids: ['u1', 'u2'], is_delivery: false, is_captacao: false, ...over,
});

const appointment = (over: Partial<AppointmentRow> = {}): AppointmentRow => ({
  id: 'p1', title: 'Reunião com cliente', kind: 'reuniao', description: '', location: '',
  start_at: '2026-11-10T13:00:00.000Z', end_at: null, all_day: false, created_by: 'u1', assigned_to: [], ...over,
});

describe('calendar events', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('makes a one-day activity end the next day (Google end date is exclusive)', () => {
    const ev = activityEvent(activity(), { project_name: 'Filme X', client_name: 'Cliente Y', proposal_id: '42' }, APP)!;
    expect(ev.start).toEqual({ date: '2026-11-10' });
    expect(ev.end).toEqual({ date: '2026-11-11' });
    expect(ev.summary).toBe('[Filme X] Gravar entrevista');
    expect(ev.description).toContain('Status: Em andamento');
  });

  it('spans multi-day activities through the end date', () => {
    const ev = activityEvent(activity({ end_date: '2026-11-12' }), null, APP)!;
    expect(ev.end).toEqual({ date: '2026-11-13' });
  });

  it('skips activities without a date', () => {
    expect(activityEvent(activity({ due_date: null }), null, APP)).toBeNull();
    expect(activityRecipients(activity({ due_date: null }))).toEqual([]);
  });

  it('falls back to the single assignee column', () => {
    expect(activityRecipients(activity({ assigned_to_user_ids: [], assigned_to_user_id: 'u9' }))).toEqual(['u9']);
  });

  it('gives timed appointments one hour when there is no end', () => {
    const ev = appointmentEvent(appointment(), APP);
    expect(ev.start).toEqual({ dateTime: '2026-11-10T13:00:00.000Z', timeZone: 'America/Sao_Paulo' });
    expect(ev.end).toEqual({ dateTime: '2026-11-10T14:00:00.000Z', timeZone: 'America/Sao_Paulo' });
  });

  it('uses the local (São Paulo) dates for all-day appointments', () => {
    // 00:00 and 23:59 in São Paulo (UTC-3)
    const ev = appointmentEvent(appointment({
      all_day: true, start_at: '2026-11-10T03:00:00.000Z', end_at: '2026-11-12T02:59:00.000Z',
    }), APP);
    expect(ev.start).toEqual({ date: '2026-11-10' });
    expect(ev.end).toEqual({ date: '2026-11-12' });
  });

  it('sends appointments to the creator and every participant once', () => {
    expect(appointmentRecipients(appointment({ assigned_to: ['u2', 'u1'] }))).toEqual(['u1', 'u2']);
  });
});
