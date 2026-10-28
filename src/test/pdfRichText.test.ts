import { describe, it, expect } from 'vitest';
import { parseRichText } from '@/utils/pdfRichText';

describe('parseRichText', () => {
  it('returns nothing for empty text', () => {
    expect(parseRichText('')).toEqual([]);
    expect(parseRichText(null)).toEqual([]);
  });

  it('splits briefing text into a paragraph and titled lists', () => {
    const text = [
      'O projeto contempla a cobertura.',
      '',
      'Observações Importantes:',
      '- A cobertura será feita por dois profissionais.',
      '- O evento ocorre das 18h às 24h.',
      '',
      'Responsabilidades do Cliente:',
      '- Disponibilizar as informações.',
    ].join('\n');

    expect(parseRichText(text)).toEqual([
      { type: 'paragraph', text: 'O projeto contempla a cobertura.' },
      { type: 'list', title: 'Observações Importantes', items: ['A cobertura será feita por dois profissionais.', 'O evento ocorre das 18h às 24h.'] },
      { type: 'list', title: 'Responsabilidades do Cliente', items: ['Disponibilizar as informações.'] },
    ]);
  });

  it('accepts titles without colon and lists without blank line before', () => {
    const text = 'Descrição do serviço.\nCaptação\n- Equipe de 2 fotógrafos.\n- 3 horas.';
    expect(parseRichText(text)).toEqual([
      { type: 'paragraph', text: 'Descrição do serviço.' },
      { type: 'list', title: 'Captação', items: ['Equipe de 2 fotógrafos.', '3 horas.'] },
    ]);
  });

  it('keeps a list without title and multi-line paragraphs', () => {
    const text = 'Linha um\nlinha dois\n\n• item a\n• item b';
    expect(parseRichText(text)).toEqual([
      { type: 'paragraph', text: 'Linha um\nlinha dois' },
      { type: 'list', title: null, items: ['item a', 'item b'] },
    ]);
  });
});

describe('parseRichText long lead-in', () => {
  it('does not turn a long sentence into a list title', () => {
    const sentence = 'Realizar o registro fotográfico completo do evento, com foco nos momentos principais.';
    expect(parseRichText(`${sentence}\n- item`)).toEqual([
      { type: 'paragraph', text: sentence },
      { type: 'list', title: null, items: ['item'] },
    ]);
  });
});
