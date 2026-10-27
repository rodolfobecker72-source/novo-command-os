export interface OrderedPaymentTerm {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export function sortPaymentTerms<T extends OrderedPaymentTerm>(terms: T[]): T[] {
  return [...terms].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function movePaymentTerm<T extends OrderedPaymentTerm>(terms: T[], id: string, direction: -1 | 1): T[] {
  const ordered = sortPaymentTerms(terms);
  const index = ordered.findIndex(term => term.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  const current = ordered[index];
  const adjacent = ordered[target];
  if (!current || !adjacent) return ordered;
  ordered[index] = adjacent;
  ordered[target] = current;
  return ordered.map((term, sortOrder) => ({ ...term, sortOrder }));
}

export function activePaymentTerms<T extends OrderedPaymentTerm>(terms: T[]): T[] {
  return sortPaymentTerms(terms).filter(term => term.active);
}

export function dragPaymentTerm<T extends OrderedPaymentTerm>(terms: T[], activeId: string, overId: string): T[] {
  const ordered = sortPaymentTerms(terms);
  const from = ordered.findIndex(term => term.id === activeId);
  const to = ordered.findIndex(term => term.id === overId);
  if (from < 0 || to < 0 || from === to) return ordered;
  const [moved] = ordered.splice(from, 1);
  if (!moved) return ordered;
  ordered.splice(to, 0, moved);
  return ordered.map((term, sortOrder) => ({ ...term, sortOrder }));
}