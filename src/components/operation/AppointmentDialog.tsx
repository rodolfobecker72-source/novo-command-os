import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Appointment,
  APPOINTMENT_KIND_LABELS,
  AppointmentKind,
  NewAppointmentInput,
} from '@/types/appointment';
import { useCRM } from '@/contexts/CRMContext';
import { toast } from 'sonner';
import { TimeSelect, addMinutesToTime, minutesBetween } from '@/components/common/TimeSelect';
import { AppointmentGuests } from './AppointmentGuests';

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<Appointment> | null;
  defaultDate?: Date | null;
  onCreate: (input: NewAppointmentInput) => Promise<Appointment | null>;
  onUpdate?: (id: string, updates: Partial<Appointment>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

function toLocalInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalInputTime(d: Date): string {
  return format(d, 'HH:mm');
}

/** Start time for a new appointment: 09:00 on a picked day, else the next full hour today. */
function defaultStartTime(day: Date | null | undefined): string {
  if (day) return '09:00';
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next.getDate() === new Date().getDate() ? format(next, 'HH:mm') : '23:00';
}

function combineDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mm] = timeStr.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 0, mm || 0, 0);
}

export function AppointmentDialog({
  open, onOpenChange, initial, defaultDate, onCreate, onUpdate, onDelete,
}: AppointmentDialogProps) {
  const { clients, budgets } = useCRM();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<AppointmentKind>('reuniao');
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [budgetId, setBudgetId] = useState<string>('none');
  const [clientId, setClientId] = useState<string>('none');
  const [participants, setParticipants] = useState<string[]>([]);
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const seedDate = initial?.startAt ?? defaultDate ?? new Date();
    const seedEnd = initial?.endAt ?? null;
    // New appointments start at a sensible hour and last one hour
    const start = initial ? toLocalInputTime(seedDate) : defaultStartTime(defaultDate);
    setTitle(initial?.title ?? '');
    setKind((initial?.kind as AppointmentKind) ?? 'reuniao');
    setAllDay(initial?.allDay ?? false);
    setStartDate(toLocalInputDate(seedDate));
    setStartTime(start);
    setEndDate(seedEnd ? toLocalInputDate(seedEnd) : toLocalInputDate(seedDate));
    setEndTime(seedEnd ? toLocalInputTime(seedEnd) : addMinutesToTime(start, 60));
    setLocation(initial?.location ?? '');
    setDescription(initial?.description ?? '');
    setBudgetId(initial?.budgetId ?? 'none');
    setClientId(initial?.clientId ?? 'none');
    setParticipants(initial?.assignedTo ?? []);
    setGuestEmails(initial?.guestEmails ?? []);
  }, [open, initial, defaultDate]);

  const sortedBudgets = useMemo(
    () => [...budgets].sort((a, b) => a.proposalId.localeCompare(b.proposalId, 'pt-BR')),
    [budgets],
  );
  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR')),
    [clients],
  );

  // Moving the start keeps the duration when it all happens on one day
  const changeStartTime = (value: string) => {
    if (endDate === startDate && startTime && endTime) {
      const duration = minutesBetween(startTime, endTime);
      setEndTime(addMinutesToTime(value, duration > 0 ? duration : 60));
    }
    setStartTime(value);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Informe um título'); return; }
    if (!startDate) { toast.error('Informe a data'); return; }

    const start = allDay
      ? combineDateTime(startDate, '00:00')
      : combineDateTime(startDate, startTime || '00:00');
    const end = allDay
      ? (endDate ? combineDateTime(endDate, '23:59') : null)
      : (endDate ? combineDateTime(endDate, endTime || startTime || '00:00') : null);

    if (end && end < start) { toast.error('Fim deve ser depois do início'); return; }

    const payload: NewAppointmentInput = {
      assignedTo: participants,
      guestEmails,
      title: title.trim(),
      kind,
      description: description.trim(),
      location: location.trim(),
      startAt: start,
      endAt: end,
      allDay,
      color: initial?.color ?? null,
      budgetId: budgetId === 'none' ? null : budgetId,
      clientId: clientId === 'none' ? null : clientId,
      leadId: initial?.leadId ?? null,
    };

    setSaving(true);
    try {
      if (isEdit && initial?.id && onUpdate) {
        await onUpdate(initial.id, payload);
        toast.success('Compromisso atualizado');
      } else {
        const created = await onCreate(payload);
        if (!created) return;
        toast.success('Compromisso criado');
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initial?.id || !onDelete) return;
    if (!confirm('Excluir este compromisso?')) return;
    setSaving(true);
    try {
      await onDelete(initial.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar compromisso' : 'Novo compromisso'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="appt-title">Título *</Label>
            <Input id="appt-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Reunião com Acme" autoFocus />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={allDay} onCheckedChange={setAllDay} />
            <Label className="cursor-pointer" onClick={() => setAllDay(v => !v)}>Dia inteiro</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            {!allDay && (
              <div>
                <Label>Hora início</Label>
                <TimeSelect value={startTime} onChange={changeStartTime} aria-label="Hora de início" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fim (opcional)</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            {!allDay && (
              <div>
                <Label>Hora fim</Label>
                <TimeSelect value={endTime} onChange={setEndTime} aria-label="Hora de término" />
              </div>
            )}
          </div>

          {!allDay && (() => {
            const isEntrega = kind === 'entrega';
            const outOfHours =
              (startTime && (startTime < '08:00' || startTime > '18:00')) ||
              (endTime && (endTime < '08:00' || endTime > '18:00'));
            const lateDelivery = isEntrega && endTime && endTime > '18:00';
            const highlight = outOfHours || lateDelivery;
            return (
              <div className={`rounded-md border p-3 text-xs ${highlight ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200' : 'border-muted bg-muted/30 text-muted-foreground'}`}>
                <strong>Horário comercial:</strong> entregas de projetos ao cliente devem ocorrer no máximo entre <strong>17h e 18h</strong>, preservando o horário comercial (08h–18h).
                {lateDelivery && <div className="mt-1 font-medium">⚠ Esta entrega está fora do horário comercial recomendado.</div>}
                {outOfHours && !lateDelivery && <div className="mt-1 font-medium">⚠ Horário fora do expediente comercial (08h–18h).</div>}
              </div>
            );
          })()}

          <div>
            <Label>Local</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Onde será o compromisso" />
          </div>

          <AppointmentGuests
            participants={participants}
            onParticipantsChange={setParticipants}
            guestEmails={guestEmails}
            onGuestEmailsChange={setGuestEmails}
            organizerId={initial?.createdBy ?? null}
          />

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {isEdit && onDelete && (
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={saving} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{isEdit ? 'Salvar' : 'Criar'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
