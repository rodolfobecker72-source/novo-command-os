// Visual style for each CRM column. The column's saved `color` (e.g.
// "bg-purple-100 text-purple-700 ...") names its color family; every family
// maps to a distinct hue that works in both light and dark themes.
// Class names are written out in full so Tailwind keeps them in the build.

export interface ColumnColorClasses {
  bg: string;
  border: string;
  dot: string;
  header: string;
}

const PALETTE: Record<string, ColumnColorClasses> = {
  sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/40', dot: 'bg-sky-500', header: 'bg-sky-500/15' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/40', dot: 'bg-violet-500', header: 'bg-violet-500/15' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/40', dot: 'bg-amber-500', header: 'bg-amber-500/15' },
  blue: { bg: 'bg-blue-600/10', border: 'border-blue-600/40', dot: 'bg-blue-600', header: 'bg-blue-600/15' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/40', dot: 'bg-orange-500', header: 'bg-orange-500/15' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/40', dot: 'bg-red-500', header: 'bg-red-500/15' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', dot: 'bg-emerald-500', header: 'bg-emerald-500/15' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/40', dot: 'bg-pink-500', header: 'bg-pink-500/15' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/40', dot: 'bg-teal-500', header: 'bg-teal-500/15' },
  slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/40', dot: 'bg-slate-500', header: 'bg-slate-500/15' },
};

// Theme token names used by the default columns → palette family
const ALIASES: Record<string, string> = {
  info: 'sky',
  purple: 'violet',
  warning: 'amber',
  accent: 'blue',
  destructive: 'red',
  success: 'emerald',
  muted: 'slate',
};

/** Families offered to new columns, in the order they are handed out. */
export const COLUMN_COLOR_FAMILIES = ['pink', 'teal', 'violet', 'orange', 'sky', 'amber', 'emerald', 'blue', 'red'];

function familyOf(color: string | null | undefined): string {
  const match = /bg-([a-z]+)/.exec(color || '');
  const name = match?.[1] ?? '';
  const family = ALIASES[name] ?? name;
  return PALETTE[family] ? family : 'slate';
}

export function columnColorClasses(color: string | null | undefined): ColumnColorClasses {
  return PALETTE[familyOf(color)];
}

/** Saved `color` value for a new column: the first family no other column uses. */
export function nextColumnColor(existing: (string | null | undefined)[]): string {
  const used = new Set(existing.map(familyOf));
  const family = COLUMN_COLOR_FAMILIES.find(f => !used.has(f)) ?? 'slate';
  return `bg-${family}-500/10`;
}
