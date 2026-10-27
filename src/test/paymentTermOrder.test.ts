import { describe, expect, it } from 'vitest';
import { activePaymentTerms, dragPaymentTerm, movePaymentTerm, sortPaymentTerms } from '@/utils/paymentTermOrder';

const terms = [
  { id: 'a', name: '40% ao fechar - 60% na entrega', description: '', active: true, sortOrder: 0, createdAt: '2026-10-01' },
  { id: 'b', name: 'Após serviço e emissão da NF', description: '', active: false, sortOrder: 1, createdAt: '2026-10-02' },
  { id: 'c', name: 'Entrada - 30 dias - 60 dias', description: '', active: true, sortOrder: 2, createdAt: '2026-10-03' },
];

describe('ordem das condições de pagamento', () => {
  it('arrasta diretamente do último ao primeiro mantendo a ordem da seleção', () => {
    const reordered = dragPaymentTerm(terms, 'c', 'a');
    expect(reordered.map(term => term.id)).toEqual(['c', 'a', 'b']);
    expect(activePaymentTerms(reordered).map(term => term.id)).toEqual(['c', 'a']);
    expect(reordered.map(term => term.sortOrder)).toEqual([0, 1, 2]);
    expect(dragPaymentTerm(terms, 'c', 'missing')).toEqual(terms);
  });
  it('permite mover condições e mantém a sequência ajustada na seleção', () => {
    const moved = movePaymentTerm(terms, 'c', -1);
    const reordered = movePaymentTerm(moved, 'c', -1);
    expect(sortPaymentTerms(reordered).map(term => term.id)).toEqual(['c', 'a', 'b']);
    expect(activePaymentTerms([...reordered].reverse()).map(term => term.id)).toEqual(['c', 'a']);
    expect(reordered.map(term => term.sortOrder)).toEqual([0, 1, 2]);
    expect(terms.map(term => term.id)).toEqual(['a', 'b', 'c']);
  });
  it('não move além do início ou fim da lista', () => {
    expect(movePaymentTerm(terms, 'a', -1)).toEqual(terms);
    expect(movePaymentTerm(terms, 'c', 1)).toEqual(terms);
  });
});