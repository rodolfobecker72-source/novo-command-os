import { describe, it, expect } from 'vitest';
import {
  activityEvent, activityRecipients, addDays, appointmentEvent, appointmentFromGoogle, appointmentRecipients,
  commandSourceOf, eventMatches, plainText, type ActivityRow, type AppointmentRow, type GoogleEventIn,
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

  it('gives activities with a start time hours in Google', () => {
    const ev = activityEvent(activity({ start_time: '14:30:00', end_time: '16:00:00' }), null, APP)!;
    expect(ev.start).toEqual({ dateTime: '2026-11-10T14:30:00', timeZone: 'America/Sao_Paulo' });
    expect(ev.end).toEqual({ dateTime: '2026-11-10T16:00:00', timeZone: 'America/Sao_Paulo' });
  });

  it('makes a timed activity last one hour when the end time is missing or earlier', () => {
    expect(activityEvent(activity({ start_time: '09:00' }), null, APP)!.end)
      .toEqual({ dateTime: '2026-11-10T10:00:00', timeZone: 'America/Sao_Paulo' });
    expect(activityEvent(activity({ start_time: '09:00', end_time: '08:00' }), null, APP)!.end)
      .toEqual({ dateTime: '2026-11-10T10:00:00', timeZone: 'America/Sao_Paulo' });
  });

  it('runs a timed multi-day activity from the first day to the last', () => {
    const ev = activityEvent(activity({ end_date: '2026-11-12', start_time: '18:00', end_time: '10:00' }), null, APP)!;
    expect(ev.end).toEqual({ dateTime: '2026-11-12T10:00:00', timeZone: 'America/Sao_Paulo' });
  });

  it('tags the events it creates so they are never imported back', () => {
    expect(commandSourceOf(appointmentEvent(appointment(), APP) as unknown as GoogleEventIn)).toBe('appointment:p1');
    expect(commandSourceOf(activityEvent(activity(), null, APP) as unknown as GoogleEventIn)).toBe('activity:a1');
  });
});

describe('reading Google events back', () => {
  const g = (over: Partial<GoogleEventIn> = {}): GoogleEventIn => ({
    id: 'g1', status: 'confirmed', summary: 'Almoço com fornecedor',
    start: { dateTime: '2026-11-10T12:00:00-03:00' }, end: { dateTime: '2026-11-10T13:30:00-03:00' }, ...over,
  });

  it('turns a timed Google event into an appointment', () => {
    expect(appointmentFromGoogle(g({ location: ' Centro ', description: 'Levar portfólio' }))).toEqual({
      title: 'Almoço com fornecedor', description: 'Levar portfólio', location: 'Centro',
      start_at: '2026-11-10T15:00:00.000Z', end_at: '2026-11-10T16:30:00.000Z', all_day: false,
    });
  });

  it('turns an all-day Google event into the same days in Command OS', () => {
    const f = appointmentFromGoogle(g({ start: { date: '2026-11-10' }, end: { date: '2026-11-12' } }))!;
    expect(f).toMatchObject({ all_day: true, start_at: '2026-11-10T00:00:00-03:00', end_at: '2026-11-11T23:59:00-03:00' });
    // Sending it back gives Google the same dates
    const back = appointmentEvent(appointment({ ...f, kind: 'outro', description: '' }), APP);
    expect(back.start).toEqual({ date: '2026-11-10' });
    expect(back.end).toEqual({ date: '2026-11-12' });
  });

  it('recognizes its own write coming back, so it does not loop', () => {
    const f = appointmentFromGoogle(g({ description: 'Levar portfólio' }))!;
    const sent = appointmentEvent(appointment({ ...f, kind: 'outro' }), APP);
    const echoed = g({
      summary: sent.summary, description: sent.description,
      start: { dateTime: '2026-11-10T12:00:00-03:00' }, end: { dateTime: '2026-11-10T13:30:00-03:00' },
    });
    expect(eventMatches(echoed, sent)).toBe(true);
    expect(eventMatches({ ...echoed, summary: 'Outro título' }, sent)).toBe(false);
    expect(eventMatches({ ...echoed, end: { dateTime: '2026-11-10T14:00:00-03:00' } }, sent)).toBe(false);
  });

  it('drops the kind label Command OS writes on top of the description', () => {
    expect(appointmentFromGoogle(g({ description: 'Reunião\n\nPauta: orçamento' }), 'reuniao')!.description).toBe('Pauta: orçamento');
    expect(appointmentFromGoogle(g({ description: 'Reunião' }), 'reuniao')!.description).toBe('');
    expect(appointmentFromGoogle(g({ description: 'Outro\n\nTexto' }), 'outro')!.description).toBe('Texto');
  });

  it('reads the simple HTML of Google descriptions as text', () => {
    expect(plainText('Linha 1<br>Linha 2 &amp; mais<br><b>fim</b>')).toBe('Linha 1\nLinha 2 & mais\nfim');
    expect(plainText('sem html')).toBe('sem html');
  });

  it('names events without a title', () => {
    expect(appointmentFromGoogle(g({ summary: '  ' }))!.title).toBe('(sem título)');
  });
});
