import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Times of the day every 15 minutes: "00:00" … "23:45". */
export const TIME_OPTIONS: string[] = Array.from({ length: 96 }, (_, i) =>
  `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
);

const NONE = '__none__';

interface TimeSelectProps {
  /** "HH:MM", or '' for no time */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Label of the option that clears the time (omit to always require a time) */
  clearLabel?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Dropdown to pick a time in 15-minute steps; keeps an off-grid saved value selectable. */
export function TimeSelect({ value, onChange, placeholder = 'Horário', clearLabel, className, disabled, ...rest }: TimeSelectProps) {
  const options = value && !TIME_OPTIONS.includes(value) ? [...TIME_OPTIONS, value].sort() : TIME_OPTIONS;
  return (
    <Select value={value || (clearLabel ? NONE : undefined)} onValueChange={(v) => onChange(v === NONE ? '' : v)} disabled={disabled}>
      <SelectTrigger className={cn('tabular-nums', className)} aria-label={rest['aria-label']}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {clearLabel && <SelectItem value={NONE}>{clearLabel}</SelectItem>}
        {options.map((t) => (
          <SelectItem key={t} value={t} className="tabular-nums">{t}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "HH:MM" plus minutes, kept within the same day. */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(Math.max(h * 60 + m + minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Minutes between two "HH:MM" times (negative when `to` is earlier). */
export function minutesBetween(from: string, to: string): number {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return th * 60 + tm - (fh * 60 + fm);
}
