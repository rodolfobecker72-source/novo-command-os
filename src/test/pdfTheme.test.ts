import { describe, it, expect } from 'vitest';
import { resolveTheme, DEFAULT_PDF_THEME } from '@/utils/pdfTheme';

describe('resolveTheme', () => {
  it('keeps defaults when theme is missing', () => {
    expect(resolveTheme(null)).toEqual(DEFAULT_PDF_THEME);
  });
  it('applies valid hex and ignores invalid', () => {
    const r = resolveTheme({ primary: '#002cbe', secondary: 'azul', fontFamily: 'serif' });
    expect(r.primary).toEqual([0, 44, 190]);
    expect(r.secondary).toEqual(DEFAULT_PDF_THEME.secondary);
    expect(r.font).toBe('times');
  });
});
