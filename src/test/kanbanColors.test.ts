import { describe, it, expect } from 'vitest';
import { DEFAULT_KANBAN_COLUMNS } from '@/types/crm';
import { columnColorClasses, nextColumnColor } from '@/utils/kanbanColors';

describe('kanban column colors', () => {
  it('gives every default column its own color', () => {
    const dots = DEFAULT_KANBAN_COLUMNS.map(c => columnColorClasses(c.color).dot);
    expect(new Set(dots).size).toBe(DEFAULT_KANBAN_COLUMNS.length);
  });

  it('falls back to neutral for unknown or empty colors', () => {
    expect(columnColorClasses('').dot).toBe('bg-slate-500');
    expect(columnColorClasses('bg-whatever-200').dot).toBe('bg-slate-500');
  });

  it('hands a new column a color no other column uses', () => {
    const existing = DEFAULT_KANBAN_COLUMNS.map(c => c.color);
    const next = nextColumnColor(existing);
    const used = existing.map(c => columnColorClasses(c).dot);
    expect(used).not.toContain(columnColorClasses(next).dot);
  });
});
