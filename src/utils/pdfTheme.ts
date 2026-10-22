export type RGB = [number, number, number];
export type PdfFont = 'helvetica' | 'times' | 'courier';

export interface BrandTheme {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  text?: string | null;
  highlightBg?: string | null;
  fontFamily?: string | null;
}

export interface ResolvedPdfTheme {
  primary: RGB;
  secondary: RGB;
  accent: RGB;
  text: RGB;
  highlightBg: RGB;
  font: PdfFont;
}

export const DEFAULT_PDF_THEME: ResolvedPdfTheme = {
  primary: [0, 0, 0],
  secondary: [80, 80, 80],
  accent: [200, 200, 200],
  text: [0, 0, 0],
  highlightBg: [248, 248, 248],
  font: 'helvetica',
};

export function hexToRgb(hex?: string | null): RGB | null {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mapFont(f?: string | null): PdfFont {
  const v = (f || '').toLowerCase();
  if (v.includes('mono') || v.includes('courier')) return 'courier';
  if (v === 'serif' || v.includes('times') || (v.includes('serif') && !v.includes('sans'))) return 'times';
  return 'helvetica';
}

export function resolveTheme(t?: BrandTheme | null): ResolvedPdfTheme {
  if (!t) return DEFAULT_PDF_THEME;
  return {
    primary: hexToRgb(t.primary) ?? DEFAULT_PDF_THEME.primary,
    secondary: hexToRgb(t.secondary) ?? DEFAULT_PDF_THEME.secondary,
    accent: hexToRgb(t.accent) ?? DEFAULT_PDF_THEME.accent,
    text: hexToRgb(t.text) ?? DEFAULT_PDF_THEME.text,
    highlightBg: hexToRgb(t.highlightBg) ?? DEFAULT_PDF_THEME.highlightBg,
    font: t.fontFamily ? mapFont(t.fontFamily) : DEFAULT_PDF_THEME.font,
  };
}
