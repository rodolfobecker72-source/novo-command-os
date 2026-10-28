import { describe, it, expect } from 'vitest';
import { resolveTheme, DEFAULT_PDF_THEME, contrastOn, rgbToHex } from '@/utils/pdfTheme';

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

describe('brand highlight and contrast', () => {
  it('uses the primary color when no highlight is set', () => {
    expect(resolveTheme({ primary: '#123456' }).highlight).toEqual([0x12, 0x34, 0x56]);
    expect(resolveTheme({ primary: '#123456', highlight: '#2bb8c4' }).highlight).toEqual([0x2b, 0xb8, 0xc4]);
  });
  it('picks readable text on top of a fill', () => {
    expect(contrastOn([0, 0, 0])).toEqual([255, 255, 255]);
    expect(contrastOn([228, 240, 240])).toEqual([17, 17, 17]);
  });
  it('converts rgb back to hex', () => {
    expect(rgbToHex([43, 184, 196])).toBe('#2bb8c4');
  });
});
