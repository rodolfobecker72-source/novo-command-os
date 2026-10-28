export type RGB = [number, number, number];
export type PdfFont = 'helvetica' | 'times' | 'courier';

export interface BrandTheme {
  primary?: string | null;
  highlight?: string | null;
  secondary?: string | null;
  accent?: string | null;
  text?: string | null;
  highlightBg?: string | null;
  fontFamily?: string | null;
}

export interface ResolvedPdfTheme {
  primary: RGB;
  /** Brand highlight: bars, bullets, numbers and labels (falls back to primary). */
  highlight: RGB;
  secondary: RGB;
  accent: RGB;
  text: RGB;
  highlightBg: RGB;
  font: PdfFont;
}

export const DEFAULT_PDF_THEME: ResolvedPdfTheme = {
  primary: [0, 0, 0],
  highlight: [0, 0, 0],
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
  const primary = hexToRgb(t.primary) ?? DEFAULT_PDF_THEME.primary;
  return {
    primary,
    highlight: hexToRgb(t.highlight) ?? primary,
    secondary: hexToRgb(t.secondary) ?? DEFAULT_PDF_THEME.secondary,
    accent: hexToRgb(t.accent) ?? DEFAULT_PDF_THEME.accent,
    text: hexToRgb(t.text) ?? DEFAULT_PDF_THEME.text,
    highlightBg: hexToRgb(t.highlightBg) ?? DEFAULT_PDF_THEME.highlightBg,
    font: t.fontFamily ? mapFont(t.fontFamily) : DEFAULT_PDF_THEME.font,
  };
}

/** Text color that stays readable on top of `bg` (white on dark fills, near-black on light ones). */
export function contrastOn(bg: RGB): RGB {
  const [r, g, b] = bg.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? [17, 17, 17] : [255, 255, 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Editable theme colors, in the order shown in Layout da Proposta. */
export const BRAND_COLOR_FIELDS = [
  { key: 'primary', label: 'Principal', hint: 'Títulos, cabeçalho das tabelas e bloco do total' },
  { key: 'highlight', label: 'Destaque', hint: 'Faixas, marcadores, números e rótulos' },
  { key: 'text', label: 'Texto', hint: 'Texto corrido' },
  { key: 'secondary', label: 'Texto de apoio', hint: 'Dados da empresa e cabeçalho das páginas' },
  { key: 'highlightBg', label: 'Fundo das caixas', hint: 'Caixas de observações e nota fiscal' },
  { key: 'accent', label: 'Linhas', hint: 'Divisórias e bordas' },
] as const;

export type BrandColorKey = (typeof BRAND_COLOR_FIELDS)[number]['key'];
