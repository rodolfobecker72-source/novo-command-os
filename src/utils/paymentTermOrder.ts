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