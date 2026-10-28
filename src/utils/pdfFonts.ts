import type jsPDF from 'jspdf';

/** Font styles the proposal PDF uses, mapped to Montserrat weights. */
export type BrandFontStyle = 'normal' | 'medium' | 'bold' | 'extrabold';

export const BRAND_FONT_NAME = 'Montserrat';

const FONT_FILES: Record<BrandFontStyle, string> = {
  normal: '/fonts/montserrat/Montserrat_400Regular.ttf',
  medium: '/fonts/montserrat/Montserrat_500Medium.ttf',
  bold: '/fonts/montserrat/Montserrat_700Bold.ttf',
  extrabold: '/fonts/montserrat/Montserrat_800ExtraBold.ttf',
};

// Base64 of each TTF, fetched once per session.
let fontDataPromise: Promise<Record<BrandFontStyle, string>> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function loadFontData(): Promise<Record<BrandFontStyle, string>> {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all(
      (Object.entries(FONT_FILES) as [BrandFontStyle, string][]).map(async ([style, url]) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Font ${url}: ${res.status}`);
        return [style, toBase64(await res.arrayBuffer())] as const;
      }),
    ).then((entries) => Object.fromEntries(entries) as Record<BrandFontStyle, string>);
    fontDataPromise.catch(() => { fontDataPromise = null; });
  }
  return fontDataPromise;
}

/**
 * Registers Montserrat on the document. Returns a setter for the four styles;
 * if the font files can't be loaded it falls back to Helvetica so the PDF is
 * still generated.
 */
export async function registerBrandFont(doc: jsPDF): Promise<(style: BrandFontStyle) => void> {
  try {
    const data = await loadFontData();
    (Object.keys(FONT_FILES) as BrandFontStyle[]).forEach((style) => {
      const file = `${BRAND_FONT_NAME}-${style}.ttf`;
      doc.addFileToVFS(file, data[style]);
      doc.addFont(file, BRAND_FONT_NAME, style);
    });
    return (style) => doc.setFont(BRAND_FONT_NAME, style);
  } catch (err) {
    console.warn('Não foi possível carregar a fonte Montserrat; usando Helvetica.', err);
    return (style) => doc.setFont('helvetica', style === 'normal' || style === 'medium' ? 'normal' : 'bold');
  }
}
