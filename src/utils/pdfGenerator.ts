import jsPDF, { GState } from 'jspdf';
import QRCode from 'qrcode';
import { resolveTheme, contrastOn, mix, type RGB } from './pdfTheme';
import {
  normalizeNextSteps, whatsappLink, type CornerStyle, type CoverStyle, type NextStepsSettings, type ProposalStyle,
} from './proposalStyle';
import { registerBrandFont } from './pdfFonts';
import { parseRichText, type RichBlock } from './pdfRichText';
import {
  BudgetVersion,
  Budget,
  Client,
  OBJECTIVES_BY_SERVICE,
  formatCurrency,
  SERVICE_TYPE_LABELS,
} from '@/types/crm';
interface PDFUser {
  id: string;
  name: string;
  photo: string;
}
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PDFLayoutSettings {
  logoUrl: string;
  companyName: string;
  website: string;
  email: string;
  pdfTitle?: string;
  sectionClientTitle?: string;
  sectionBriefingTitle?: string;
  sectionInclusionsTitle?: string;
  sectionServicesTitle?: string;
  sectionOperationalTitle?: string;
  sectionInvestmentTitle?: string;
  sectionTotalTitle?: string;
  validityText?: string;
  /** Days the proposal is valid (Regras Comerciais); wins over validityText */
  validityDays?: number;
  companyCnpj?: string;
  companyAddress?: string;
  companyCityLine?: string;
  brandTheme?: import('./pdfTheme').BrandTheme | null;
  coverPdfUrl?: string;
  backPdfUrl?: string;
  proposalStyle?: ProposalStyle;
  coverStyle?: CoverStyle;
  coverImageUrl?: string;
  cornerStyle?: CornerStyle;
  nextSteps?: NextStepsSettings | null;
  whatsapp?: string;
}

interface PDFGeneratorParams {
  budget: Budget;
  version: BudgetVersion;
  client: Client;
  responsibleUser: PDFUser | null;
  layoutSettings?: PDFLayoutSettings | null;
  categoryLabels?: Record<string, string>;
  objectiveLabels?: Record<string, Record<string, string>>;
}

// Helper function to load image as base64 with dimensions
async function loadImageAsBase64(url: string): Promise<{ base64: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve({
          base64: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height
        });
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

/** Photo cropped to fill a page of the given proportions, as a compact JPEG. */
async function loadCoverPhoto(url: string, aspect: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  let sw = img.width;
  let sh = img.height;
  if (sw / sh > aspect) sw = sh * aspect; else sh = sw / aspect;
  const outH = Math.min(1600, Math.round(sh));
  const canvas = document.createElement('canvas');
  canvas.height = outH;
  canvas.width = Math.round(outH * aspect);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

const PT_TO_MM = 0.3528;
const WHITE: RGB = [255, 255, 255];

export async function generateProposalPDF({
  budget,
  version,
  client,
  responsibleUser,
  layoutSettings,
  categoryLabels: catLabels,
  objectiveLabels: objLabels,
  existingDoc,
  skipSave,
}: PDFGeneratorParams & { existingDoc?: jsPDF; skipSave?: boolean }): Promise<jsPDF> {
  const catLookup = catLabels || {};
  const objLookup = objLabels || {};
  const doc = existingDoc || new jsPDF();
  const th = resolveTheme(layoutSettings?.brandTheme);
  const setFont = await registerBrandFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const headerLineY = 30;
  const contentTop = 40;
  const footerLineY = pageHeight - 18;
  const contentBottom = footerLineY - 8;

  // Configurable texts with fallbacks
  const t = {
    pdfTitle: layoutSettings?.pdfTitle || 'PROPOSTA COMERCIAL',
    briefing: layoutSettings?.sectionBriefingTitle || 'BRIEFING DO PROJETO',
    services: layoutSettings?.sectionServicesTitle || 'SERVIÇOS',
    operational: layoutSettings?.sectionOperationalTitle || 'DESPESAS OPERACIONAIS',
    investment: layoutSettings?.sectionInvestmentTitle || 'COMPOSIÇÃO DO INVESTIMENTO',
    total: layoutSettings?.sectionTotalTitle || 'INVESTIMENTO TOTAL',
    validity: layoutSettings?.validityDays
      ? `Validade: ${layoutSettings.validityDays} ${layoutSettings.validityDays === 1 ? 'dia' : 'dias'}`
      : layoutSettings?.validityText || 'Validade: 30 dias',
  };

  const projectIdentifier = `${budget.proposalId} - ${budget.projectName} - Versão ${version.version}`;
  const generatedDate = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  let logoData: { base64: string; width: number; height: number } | null = null;
  if (layoutSettings?.logoUrl) {
    try {
      logoData = await loadImageAsBase64(layoutSettings.logoUrl);
    } catch (error) {
      console.warn('Could not load logo:', error);
    }
  }

  let footerLogoData: { base64: string; width: number; height: number } | null = null;
  try {
    const { default: commandLogoUrl } = await import('@/assets/command-logo.png');
    footerLogoData = await loadImageAsBase64(commandLogoUrl);
  } catch (error) {
    console.warn('Could not load footer logo:', error);
  }

  // Moderno style: rounded boxes, sentence-case titles and sections that flow
  // one after the other instead of starting a new page each
  const modern = layoutSettings?.proposalStyle === 'moderno';
  const coverStyle: CoverStyle = layoutSettings?.coverStyle ?? 'cor';
  const radius = modern && layoutSettings?.cornerStyle !== 'reto' ? 3 : 0;
  const nextSteps = normalizeNextSteps(layoutSettings?.nextSteps);
  const waLink = whatsappLink(layoutSettings?.whatsapp);

  let coverPhoto: string | null = null;
  if (modern && coverStyle === 'foto' && layoutSettings?.coverImageUrl) {
    try {
      coverPhoto = await loadCoverPhoto(layoutSettings.coverImageUrl, pageWidth / pageHeight);
    } catch (error) {
      console.warn('Could not load cover photo:', error);
    }
  }

  let y = contentTop;

  // ---------- drawing helpers ----------
  const textColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const fillColor = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const drawColor = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const hline = (yy: number, c: RGB = th.accent, w = 0.2, x1 = margin, x2 = pageWidth - margin) => {
    drawColor(c);
    doc.setLineWidth(w);
    doc.line(x1, yy, x2, yy);
  };
  const lineHeight = (sizePt: number, factor = 1.4) => sizePt * PT_TO_MM * factor;
  const spacedWidth = (str: string, spacing: number) => doc.getTextWidth(str) + spacing * Math.max(0, str.length - 1);
  /** Draws wrapped lines one by one (y = top of the first line), so they align with single-line text. */
  const textLines = (lines: string[], x: number, top: number, factor: number, opts: { charSpace?: number } = {}) => {
    const lh = lineHeight(doc.getFontSize(), factor);
    lines.forEach((line, i) => doc.text(line, x, top + i * lh, { baseline: 'top', ...opts }));
  };

  /** Small uppercase label with letter spacing (y = top of the text). */
  const label = (
    str: string,
    x: number,
    yy: number,
    opts: { color?: RGB; size?: number; spacing?: number; align?: 'left' | 'right'; weight?: 'bold' | 'medium' } = {},
  ) => {
    const spacing = opts.spacing ?? 0.5;
    setFont(opts.weight ?? 'bold');
    doc.setFontSize(opts.size ?? 6.5);
    textColor(opts.color ?? th.highlight);
    const upper = str.toUpperCase();
    const xx = opts.align === 'right' ? x - spacedWidth(upper, spacing) : x;
    doc.text(upper, xx, yy, { baseline: 'top', charSpace: spacing });
  };

  /** Rectangle with the style's corners. */
  const box = (x: number, yy: number, w: number, h: number, style: 'F' | 'S' | 'FD', r = radius) => {
    if (r > 0) doc.roundedRect(x, yy, w, h, r, r, style); else doc.rect(x, yy, w, h, style);
  };
  /** Light tint of the highlight color (subtotals, step numbers). */
  const highlightTint = mix(th.highlight, WHITE, 0.88);
  /** Highlight color that stays visible on top of `bg`. */
  const highlightOn = (bg: RGB): RGB => (contrastOn(bg)[0] > 128 ? mix(th.highlight, WHITE, 0.45) : th.highlight);
  /** "BRIEFING DO PROJETO" -> "Briefing do projeto"; titles already in mixed case are kept. */
  const sentenceCase = (str: string) =>
    str === str.toUpperCase() && /[A-ZÀ-Ý]/.test(str) ? str.charAt(0) + str.slice(1).toLowerCase() : str;
  const withOpacity = (opacity: number, draw: () => void) => {
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity }));
    draw();
    doc.restoreGraphicsState();
  };

  const fitImage = (img: { width: number; height: number }, maxW: number, maxH: number) => {
    const ratio = img.width / img.height;
    let h = maxH;
    let w = h * ratio;
    if (w > maxW) { w = maxW; h = w / ratio; }
    return { w, h };
  };

  const drawInnerHeader = () => {
    let leftWidth = 0;
    if (logoData) {
      const { w, h } = fitImage(logoData, 45, 11);
      doc.addImage(logoData.base64, 'PNG', margin, 13 + (11 - h) / 2, w, h);
      leftWidth = w;
    } else if (layoutSettings?.companyName) {
      setFont('extrabold');
      doc.setFontSize(12);
      textColor(th.primary);
      const name = layoutSettings.companyName.toUpperCase();
      doc.text(name, margin, 15, { baseline: 'top' });
      leftWidth = doc.getTextWidth(name);
    }
    if (modern) {
      setFont('medium');
      doc.setFontSize(7);
      textColor(th.secondary);
      let ref = `Nº ${budget.proposalId} · ${budget.projectName} · Versão ${version.version}`;
      const maxW = contentWidth - leftWidth - 10;
      if (doc.getTextWidth(ref) > maxW) {
        while (ref.length > 4 && doc.getTextWidth(`${ref}…`) > maxW) ref = ref.slice(0, -1);
        ref = `${ref.trimEnd()}…`;
      }
      doc.text(ref, pageWidth - margin, 17.2, { baseline: 'top', align: 'right' });
      hline(headerLineY, th.accent, 0.2);
      return;
    }
    // Keep the identifier clear of the logo, cutting it with an ellipsis if needed
    setFont('medium');
    doc.setFontSize(6.5);
    const maxIdWidth = contentWidth - leftWidth - 10;
    let headerId = projectIdentifier.toUpperCase();
    while (headerId.length > 4 && spacedWidth(headerId, 0.35) > maxIdWidth) headerId = headerId.slice(0, -2);
    if (headerId !== projectIdentifier.toUpperCase()) headerId = `${headerId.trimEnd()}…`;
    label(headerId, pageWidth - margin, 17.2, { color: th.secondary, size: 6.5, spacing: 0.35, align: 'right', weight: 'medium' });
    hline(headerLineY, th.accent, 0.2);
  };

  const drawFooter = () => {
    hline(footerLineY, th.accent, 0.2);
    const fy = footerLineY + 4.2;
    let fx = margin;
    doc.setFontSize(6.5);
    const parts = [layoutSettings?.website, layoutSettings?.email].filter(Boolean) as string[];
    if (layoutSettings?.companyName) {
      setFont('bold');
      textColor(th.text);
      const name = layoutSettings.companyName.toUpperCase();
      doc.text(name, fx, fy, { baseline: 'top' });
      fx += doc.getTextWidth(name);
    }
    parts.forEach((part, i) => {
      if (i > 0 || layoutSettings?.companyName) {
        setFont('bold');
        textColor(th.highlight);
        doc.text(' • ', fx, fy, { baseline: 'top' });
        fx += doc.getTextWidth(' • ');
      }
      setFont('medium');
      textColor(th.secondary);
      doc.text(part, fx, fy, { baseline: 'top' });
      fx += doc.getTextWidth(part);
    });
    if (footerLogoData) {
      const { w, h } = fitImage(footerLogoData, 30, 4.4);
      doc.addImage(footerLogoData.base64, 'PNG', pageWidth - margin - w, footerLineY + 3.2, w, h);
    }
  };

  const newPage = () => {
    doc.addPage();
    drawInnerHeader();
    drawFooter();
    y = contentTop;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > contentBottom) newPage();
  };

  const sectionHeading = (num: number, title: string, keepWith = 0) => {
    if (modern) {
      const size = 8.5;
      ensureSpace(size + 6 + keepWith);
      fillColor(th.highlight);
      box(margin, y, size, size, 'F', radius ? 2.2 : 0);
      setFont('extrabold');
      doc.setFontSize(8.5);
      textColor(contrastOn(th.highlight));
      doc.text(String(num).padStart(2, '0'), margin + size / 2, y + size / 2, { baseline: 'middle', align: 'center' });
      doc.setFontSize(18);
      textColor(th.primary);
      const lines = doc.splitTextToSize(sentenceCase(title), contentWidth - size - 4) as string[];
      const lh = lineHeight(18, 1.1);
      lines.forEach((line, i) => doc.text(line, margin + size + 4, y + size / 2 + i * lh, { baseline: 'middle' }));
      y += size + (lines.length - 1) * lh + 6;
      return;
    }
    ensureSpace(32);
    drawColor(th.highlight);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1.2, margin + 10, y + 1.2);
    label(String(num).padStart(2, '0'), margin + 13, y, { size: 7 });
    y += 6;
    setFont('extrabold');
    doc.setFontSize(22);
    textColor(th.primary);
    const lines = doc.splitTextToSize(title.toUpperCase(), contentWidth) as string[];
    textLines(lines, margin, y, 1.1);
    y += lines.length * lineHeight(22, 1.1) + 7;
  };

  // ---------- text blocks ----------
  const BODY = 10;
  const paragraph = (str: string) => {
    setFont('normal');
    doc.setFontSize(BODY);
    textColor(th.text);
    const lh = lineHeight(BODY, 1.55);
    const lines = doc.splitTextToSize(str, contentWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(lh);
      doc.text(line, margin, y, { baseline: 'top' });
      y += lh;
    });
    y += 4;
  };

  /** Measures (and optionally draws) a bullet list; returns its height. */
  const bulletList = (items: string[], x: number, top: number, width: number, size: number, draw: boolean) => {
    setFont('normal');
    doc.setFontSize(size);
    const lh = lineHeight(size, 1.45);
    const gap = 1.8;
    let yy = top;
    items.forEach((item) => {
      const lines = doc.splitTextToSize(item, width - 5) as string[];
      if (draw) {
        fillColor(th.highlight);
        doc.circle(x + 0.8, yy + size * PT_TO_MM * 0.5, 0.75, 'F');
        textColor(th.text);
        textLines(lines, x + 5, yy, 1.45);
      }
      yy += lines.length * lh + gap;
    });
    return yy - top - (items.length ? gap : 0);
  };

  /** Title above a list; returns its height. */
  const listTitle = (
    title: string | null, x: number, top: number, width: number, size: number, draw: boolean,
    opts: { upper?: boolean; color?: RGB } = {},
  ) => {
    if (!title) return 0;
    setFont('bold');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(opts.upper === false ? title : title.toUpperCase(), width - 4) as string[];
    if (draw) {
      textColor(opts.color ?? th.text);
      textLines(lines, x, top, 1.35, { charSpace: 0.2 });
    }
    return lines.length * lineHeight(size, 1.35);
  };

  /** Fallback for lists too tall for a box/column: flows across pages. */
  const plainList = (list: { title: string | null; items: string[] }) => {
    if (list.title) {
      ensureSpace(12);
      y += listTitle(list.title, margin, y, contentWidth, 9.5, true) + 3;
    }
    list.items.forEach((item) => {
      const h = bulletList([item], margin, y, contentWidth, 9.5, false);
      ensureSpace(h);
      bulletList([item], margin, y, contentWidth, 9.5, true);
      y += h + 1.8;
    });
    y += 3;
  };

  // Briefing lists: tinted boxes, two per row
  const listBoxes = (lists: { title: string | null; items: string[] }[]) => {
    const pad = 7;
    const gap = 5;
    for (let i = 0; i < lists.length; i += 2) {
      const row = lists.slice(i, i + 2);
      const w = (contentWidth - gap * (row.length - 1)) / row.length;
      const inner = w - pad * 2;
      const titleOpts = modern ? { upper: false, color: th.primary } : {};
      const heights = row.map((l) => {
        const th1 = listTitle(l.title, 0, 0, inner, 9.5, false, titleOpts);
        return pad * 2 + th1 + (th1 ? 3.5 : 0) + bulletList(l.items, 0, 0, inner, 9, false);
      });
      const h = Math.max(...heights);
      if (h > contentBottom - contentTop) {
        row.forEach(plainList);
        continue;
      }
      ensureSpace(h);
      row.forEach((l, idx) => {
        const x = margin + idx * (w + gap);
        fillColor(th.highlightBg);
        box(x, y, w, h, 'F');
        let yy = y + pad;
        const titleH = listTitle(l.title, x + pad, yy, inner, 9.5, true, titleOpts);
        if (titleH) yy += titleH + 3.5;
        bulletList(l.items, x + pad, yy, inner, 9, true);
      });
      y += h + gap;
    }
    y += 2;
  };

  // Service lists: up to three columns per row
  const listColumns = (lists: { title: string | null; items: string[] }[]) => {
    const gap = 6;
    for (let i = 0; i < lists.length; i += 3) {
      const row = lists.slice(i, i + 3);
      const w = (contentWidth - gap * (row.length - 1)) / row.length;
      const heights = row.map((l) => {
        const th1 = listTitle(l.title, 0, 0, modern ? w - 3.4 : w, 8.5, false);
        return th1 + (th1 ? 5 : 0) + bulletList(l.items, 0, 0, w, 8.5, false);
      });
      const h = Math.max(...heights);
      if (h > contentBottom - contentTop) {
        row.forEach(plainList);
        continue;
      }
      ensureSpace(h + 2);
      row.forEach((l, idx) => {
        const x = margin + idx * (w + gap);
        let yy = y;
        if (modern && l.title) {
          fillColor(th.highlight);
          box(x, yy + 0.5, 2, 2, 'F', radius ? 0.5 : 0);
        }
        const titleH = modern
          ? listTitle(l.title, x + 3.4, yy, w - 3.4, 8.5, true, { color: th.primary })
          : listTitle(l.title, x, yy, w, 8.5, true);
        if (titleH) {
          if (modern) hline(yy + titleH + 1.2, highlightTint, 0.7, x, x + w);
          else hline(yy + titleH + 1.2, th.highlight, 0.35, x, x + w);
          yy += titleH + 5;
        }
        bulletList(l.items, x, yy, w, 8.5, true);
      });
      y += h + 6;
    }
  };

  const richBlocks = (blocks: RichBlock[], listMode: 'boxes' | 'columns') => {
    let group: { title: string | null; items: string[] }[] = [];
    const flush = () => {
      if (!group.length) return;
      if (listMode === 'boxes') listBoxes(group); else listColumns(group);
      group = [];
    };
    blocks.forEach((b) => {
      if (b.type === 'list') { group.push(b); return; }
      flush();
      paragraph(b.text);
    });
    flush();
  };

  /** Bordered strip of label/value cells (Local, Data, Pagamento...). */
  const infoStrip = (cells: [string, string][]) => {
    if (!cells.length) return;
    const pad = 4;
    setFont('bold');
    doc.setFontSize(9.5);
    const natural = cells.map(([l, v]) => {
      const valueW = doc.getTextWidth(v);
      doc.setFontSize(6.5);
      const labelW = spacedWidth(`${l.toUpperCase()}:`, 0.5);
      doc.setFontSize(9.5);
      return Math.max(valueW, labelW, 20) + pad * 2;
    });
    const total = natural.reduce((a, b) => a + b, 0);
    const cardGap = modern ? 3 : 0;
    const available = contentWidth - cardGap * (cells.length - 1);
    const widths = natural.map((n) => (n / total) * available);
    const valueLines = cells.map(([, v], i) => doc.splitTextToSize(v, widths[i] - pad * 2) as string[]);
    const h = pad + 3 + 2.5 + Math.max(...valueLines.map((l) => l.length)) * lineHeight(9.5, 1.35) + pad;
    ensureSpace(h + 4);
    y += 2;
    if (modern) {
      let cx = margin;
      cells.forEach(([l], i) => {
        drawColor(th.accent);
        doc.setLineWidth(0.3);
        box(cx, y, widths[i], h, 'S');
        label(l, cx + pad, y + pad);
        setFont('bold');
        doc.setFontSize(9.5);
        textColor(th.text);
        textLines(valueLines[i], cx + pad, y + pad + 5, 1.35);
        cx += widths[i] + cardGap;
      });
      y += h + 8;
      return;
    }
    drawColor(th.primary);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, h);
    let x = margin;
    cells.forEach(([l], i) => {
      if (i > 0) {
        drawColor(th.accent);
        doc.setLineWidth(0.2);
        doc.line(x, y, x, y + h);
      }
      label(`${l}:`, x + pad, y + pad);
      setFont('bold');
      doc.setFontSize(9.5);
      textColor(th.text);
      textLines(valueLines[i], x + pad, y + pad + 5.5, 1.35);
      x += widths[i];
    });
    y += h + 8;
  };

  const chips = (items: string[]) => {
    if (!items.length) return;
    const h = 7;
    const padX = 3;
    const gap = 3;
    let x = margin;
    setFont('medium');
    doc.setFontSize(7.5);
    ensureSpace(h + 4);
    items.forEach((item) => {
      const w = doc.getTextWidth(item) + padX * 2;
      if (x + w > pageWidth - margin && x > margin) {
        x = margin;
        y += h + 2;
      }
      if (modern) {
        fillColor(th.highlightBg);
        doc.roundedRect(x, y, w, h, radius ? h / 2 : 0, radius ? h / 2 : 0, 'F');
      } else {
        drawColor(th.accent);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 1, 1, 'S');
      }
      textColor(th.text);
      doc.text(item, x + padX, y + h / 2, { baseline: 'middle' });
      x += w + gap;
    });
    y += h + 5;
  };

  /** `reserveAfter` keeps the last row together with what follows it (the subtotal). */
  const itemsTable = (descriptions: string[], reserveAfter = 0) => {
    const headH = 8;
    const onPrimary = contrastOn(th.primary);
    const drawHead = () => {
      if (modern) {
        hline(y, th.accent, 0.2);
        return;
      }
      fillColor(th.primary);
      doc.rect(margin, y, contentWidth, headH, 'F');
      label('#', margin + 4, y + 2.9, { color: onPrimary });
      label('Descrição', margin + 20, y + 2.9, { color: onPrimary });
      y += headH;
    };
    ensureSpace((modern ? 0 : headH) + 12);
    drawHead();
    descriptions.forEach((desc, i) => {
      setFont('normal');
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(desc || '—', contentWidth - 24) as string[];
      const rowH = lines.length * lineHeight(9.5, 1.35) + 5.4;
      const isLast = i === descriptions.length - 1;
      if (y + rowH + (isLast ? reserveAfter : 0) > contentBottom) { newPage(); drawHead(); }
      setFont('bold');
      textColor(th.highlight);
      doc.text(String(i + 1), margin + (modern ? 1 : 4), y + 2.7, { baseline: 'top' });
      setFont('normal');
      textColor(th.text);
      textLines(lines, margin + (modern ? 9 : 20), y + 2.7, 1.35);
      hline(y + rowH, th.accent, 0.2);
      y += rowH;
    });
  };

  const subtotal = (value: number, title = 'Subtotal do serviço') => {
    if (modern) {
      const h = 9;
      y += 3;
      ensureSpace(h);
      fillColor(highlightTint);
      box(margin, y, contentWidth, h, 'F', radius ? 2 : 0);
      setFont('bold');
      doc.setFontSize(9.5);
      textColor(th.highlight);
      doc.text(title, margin + 4, y + h / 2, { baseline: 'middle' });
      doc.text(formatCurrency(value), pageWidth - margin - 4, y + h / 2, { baseline: 'middle', align: 'right' });
      y += h + 4;
      return;
    }
    y += 5;
    ensureSpace(10);
    setFont('bold');
    doc.setFontSize(10.5);
    textColor(th.text);
    const str = `Subtotal: ${formatCurrency(value)}`;
    const w = doc.getTextWidth(str);
    doc.text(str, pageWidth - margin - w, y, { baseline: 'top' });
    hline(y + 5.8, th.highlight, 0.4, pageWidth - margin - w, pageWidth - margin);
    y += 9;
  };

  // ============================================
  // COVER
  // ============================================
  const validityMatch = t.validity.match(/^([^:]{1,30}):\s*(.+)$/);
  const validityCell: [string, string] = validityMatch
    ? [validityMatch[1].trim(), validityMatch[2].trim()]
    : ['Validade', t.validity];

  const drawModernCover = () => {
    const light = coverStyle === 'clara';
    const bg: RGB = light ? WHITE : th.primary;
    if (!light) {
      fillColor(th.primary);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      if (coverPhoto) {
        doc.addImage(coverPhoto, 'JPEG', 0, 0, pageWidth, pageHeight);
        // Brand color over the photo keeps the text readable
        withOpacity(0.78, () => {
          fillColor(th.primary);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
        });
      }
    }
    const onBg = light ? th.text : contrastOn(bg);
    const titleColor = light ? th.primary : onBg;
    const soft = mix(onBg, bg, 0.3);

    // Brand: logo on a white badge over color, so any logo stays visible
    let by = 22;
    if (logoData) {
      const { w, h } = fitImage(logoData, 60, 16);
      if (!light) {
        fillColor(WHITE);
        box(margin - 4, by - 4, w + 8, h + 8, 'F', radius ? 2.5 : 0);
      }
      doc.addImage(logoData.base64, 'PNG', margin, by, w, h);
      by += h + (light ? 5 : 9);
    } else if (layoutSettings?.companyName) {
      setFont('extrabold');
      doc.setFontSize(14);
      textColor(titleColor);
      doc.text(layoutSettings.companyName.toUpperCase(), margin, by, { baseline: 'top' });
      by += 8;
    }
    const companyLine = [
      layoutSettings?.companyCnpj ? `CNPJ ${layoutSettings.companyCnpj}` : '',
      layoutSettings?.companyCityLine || '',
    ].filter(Boolean).join(' · ');
    if (companyLine) {
      setFont('normal');
      doc.setFontSize(7.5);
      textColor(soft);
      doc.text(companyLine, margin, by, { baseline: 'top' });
    }

    // Title block
    let ty = 108;
    label(`${t.pdfTitle} · Nº ${budget.proposalId} · Versão ${version.version}`, margin, ty, {
      color: light ? th.highlight : highlightOn(bg), size: 7, spacing: 0.9,
    });
    ty += 9;
    setFont('medium');
    doc.setFontSize(16);
    textColor(mix(titleColor, bg, 0.15));
    doc.text('Proposta para', margin, ty, { baseline: 'top' });
    ty += 8.5;
    setFont('extrabold');
    doc.setFontSize(34);
    textColor(titleColor);
    const nameLines = (doc.splitTextToSize(client.companyName || '—', contentWidth * 0.9) as string[]).slice(0, 3);
    textLines(nameLines, margin, ty, 1.08);
    ty += nameLines.length * lineHeight(34, 1.08) + 4;
    setFont('medium');
    doc.setFontSize(13);
    textColor(mix(onBg, bg, 0.1));
    const projectLines = (doc.splitTextToSize(budget.projectName, contentWidth * 0.9) as string[]).slice(0, 2);
    textLines(projectLines, margin, ty, 1.3);
    ty += projectLines.length * lineHeight(13, 1.3) + 7;
    fillColor(th.highlight);
    box(margin, ty, 18, 1.6, 'F', radius ? 0.8 : 0);

    // Details at the bottom
    const cells: [string, string][] = [['Data', generatedDate], validityCell];
    if (client.responsiblePerson) cells.push(['Aos cuidados de', client.responsiblePerson]);
    if (responsibleUser) cells.push(['Atendimento', responsibleUser.name]);
    const gap = 3;
    const cw = (contentWidth - gap * (cells.length - 1)) / cells.length;
    const ch = 17;
    const cy = pageHeight - margin - ch;
    cells.forEach(([l, v], i) => {
      const cx = margin + i * (cw + gap);
      if (light) {
        fillColor(th.highlightBg);
        box(cx, cy, cw, ch, 'F');
      } else {
        withOpacity(0.1, () => {
          fillColor(onBg);
          box(cx, cy, cw, ch, 'F');
        });
      }
      label(l, cx + 4, cy + 4, { color: light ? th.highlight : soft, size: 6, spacing: 0.6 });
      setFont('bold');
      doc.setFontSize(9.5);
      textColor(titleColor);
      const line = (doc.splitTextToSize(v, cw - 8) as string[])[0] ?? '';
      doc.text(line, cx + 4, cy + 9.5, { baseline: 'top' });
    });
  };

  if (modern) {
    drawModernCover();
  } else {
    if (logoData) {
      const { w, h } = fitImage(logoData, 75, 20);
      doc.addImage(logoData.base64, 'PNG', margin, 20, w, h);
    } else if (layoutSettings?.companyName) {
      setFont('extrabold');
      doc.setFontSize(18);
      textColor(th.primary);
      doc.text(layoutSettings.companyName.toUpperCase(), margin, 22, { baseline: 'top' });
    }

    let infoY = 21;
    if (layoutSettings?.companyName) {
      setFont('bold');
      doc.setFontSize(7.5);
      textColor(th.text);
      doc.text(layoutSettings.companyName, pageWidth - margin, infoY, { baseline: 'top', align: 'right' });
      infoY += 4.2;
    }
    setFont('normal');
    doc.setFontSize(7);
    textColor(th.secondary);
    [
      layoutSettings?.companyCnpj ? `CNPJ: ${layoutSettings.companyCnpj}` : '',
      layoutSettings?.companyAddress || '',
      layoutSettings?.companyCityLine || '',
    ].filter(Boolean).forEach((line) => {
      doc.text(line, pageWidth - margin, infoY, { baseline: 'top', align: 'right' });
      infoY += 3.8;
    });

    let ty = 92;
    setFont('extrabold');
    doc.setFontSize(40);
    textColor(th.primary);
    const titleLines = doc.splitTextToSize(t.pdfTitle.toUpperCase(), contentWidth * 0.82) as string[];
    textLines(titleLines, margin, ty, 1.05);
    ty += titleLines.length * lineHeight(40, 1.05) + 7;
    fillColor(th.highlight);
    doc.rect(margin, ty, 22, 1.5, 'F');
    ty += 9;
    setFont('bold');
    doc.setFontSize(14);
    textColor(th.text);
    const idLines = doc.splitTextToSize(projectIdentifier, contentWidth) as string[];
    textLines(idLines, margin, ty, 1.3);
    ty += idLines.length * lineHeight(14, 1.3);

    const coverCells: [string, string][] = [
      ['Empresa', client.companyName || '—'],
      ['Responsável', client.responsiblePerson || '—'],
      ['Data da proposta', generatedDate],
    ];
    if (responsibleUser) coverCells.push(['Responsável pelo atendimento', responsibleUser.name]);
    const cellH = 21;
    const colW = contentWidth / 2;
    const gridRows = Math.ceil(coverCells.length / 2);
    const gridTop = Math.max(ty + 20, contentBottom - gridRows * cellH - 18);
    hline(gridTop, th.primary, 0.4);
    coverCells.forEach(([l, v], i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const top = gridTop + row * cellH;
      const x = margin + col * colW + (col ? 6 : 0);
      label(`${l}:`, x, top + 6);
      setFont('bold');
      doc.setFontSize(10.5);
      textColor(th.text);
      const lines = (doc.splitTextToSize(v, colW - 8) as string[]).slice(0, 2);
      textLines(lines, x, top + 10.5, 1.25);
      if (col === 1 || i === coverCells.length - 1) hline(top + cellH, th.accent, 0.2);
    });
    drawColor(th.accent);
    doc.setLineWidth(0.2);
    doc.line(margin + colW, gridTop, margin + colW, gridTop + gridRows * cellH);
    drawFooter();

  }

  // ============================================
  // 01 — BRIEFING
  // ============================================
  newPage();
  sectionHeading(1, t.briefing);
  richBlocks(parseRichText(budget.projectDescription), 'boxes');

  const infoCells: [string, string][] = [];
  if (budget.location) infoCells.push(['Local', budget.location]);
  if (budget.hasExecutionDate && budget.executionStartDate) {
    const startDate = format(new Date(budget.executionStartDate), "dd/MM/yyyy", { locale: ptBR });
    if (budget.executionEndDate) {
      const endDate = format(new Date(budget.executionEndDate), "dd/MM/yyyy", { locale: ptBR });
      infoCells.push(['Período', `${startDate} a ${endDate}`]);
    } else {
      infoCells.push(['Data', startDate]);
    }
  }
  if (budget.paymentTerms) infoCells.push(['Pagamento', budget.paymentTerms]);
  infoCells.push(validityCell);
  infoStrip(infoCells);

  // ============================================
  // 02 — SERVICES
  // ============================================
  let totalProductionCost = 0;
  version.services.forEach(s => { totalProductionCost += s.costs.reduce((sum, c) => sum + c.value, 0); });

  const hideNf = !!budget.hideNfInPdf;
  const hideOp = !!budget.hideOperationalInPdf;
  const hideNfObs = !!budget.hideNfObservationInPdf;
  const preNfPct = version.nfCostPercentage ?? 13; // 0% is a valid rate (no invoice)
  const preMarginPct = version.margin || 0;
  const preOpTotal = (version.operationalCosts || []).reduce((sum, c) => sum + c.value, 0);
  const preTotalCosts = totalProductionCost + preOpTotal;
  const preDivisor = 1 - (preMarginPct / 100) - (preNfPct / 100);
  const preTotalProject = preDivisor > 0 ? preTotalCosts / preDivisor : preTotalCosts;
  const preNfValue = preTotalProject * (preNfPct / 100);
  const preMarginValue = preTotalProject - preTotalCosts - preNfValue;
  // When hiding NF/Operacional in the PDF, distribute its value proportionally into services
  const preToDistribute = totalProductionCost + preMarginValue + (hideNf ? preNfValue : 0) + (hideOp ? preOpTotal : 0);

  const serviceName = (serviceType: string) => catLookup[serviceType] || SERVICE_TYPE_LABELS[serviceType] || serviceType;
  const objectiveName = (serviceType: string, objective: string) =>
    objLookup[serviceType]?.[objective]
    || (OBJECTIVES_BY_SERVICE[serviceType] || []).find(o => o.value === objective)?.label
    || objective
    || '';

  if (modern) {
    y += 8;
    sectionHeading(2, t.services, 40);
  } else {
    newPage();
    sectionHeading(2, t.services);
  }

  version.services.forEach((service, serviceIndex) => {
    const serviceProductionCost = service.costs.reduce((sum, c) => sum + c.value, 0);
    const serviceWeight = totalProductionCost > 0 ? serviceProductionCost / totalProductionCost : 0;
    const serviceDisplayValue = serviceWeight * preToDistribute;

    if (serviceIndex > 0) y += 10;
    ensureSpace(45);

    const chipItems: string[] = [];
    const objectiveLabel = objectiveName(service.serviceType, service.objective);
    if (objectiveLabel) chipItems.push(modern ? objectiveLabel : `Objetivo: ${objectiveLabel}`);
    const deliveryPrefix = modern ? 'Entrega' : 'Prazo de entrega:';
    if (service.deliveryType === 'realtime') {
      chipItems.push(`${deliveryPrefix} ${modern ? 'no mesmo dia (real time)' : 'Real time (mesmo dia)'}`);
    } else if (service.deliveryType === 'dias_uteis') {
      chipItems.push(`${deliveryPrefix} ${modern ? 'em ' : ''}${service.deliveryDays || ''} dias úteis`);
    } else if (service.deliveryType === 'dias_corridos') {
      chipItems.push(`${deliveryPrefix} ${modern ? 'em ' : ''}${service.deliveryDays || ''} dias corridos`);
    } else if (service.deliveryType === 'data_especifica' && (service as any).deliveryDate) {
      const d = new Date((service as any).deliveryDate + 'T12:00:00');
      chipItems.push(`${deliveryPrefix} ${modern ? 'em ' : ''}${d.toLocaleDateString('pt-BR')}`);
    }

    if (modern) {
      // Colored bar with the service name, and its chips inside when they fit
      const headH = 11;
      const onPrimary = contrastOn(th.primary);
      fillColor(th.primary);
      box(margin, y, contentWidth, headH, 'F');
      setFont('extrabold');
      doc.setFontSize(10);
      textColor(highlightOn(th.primary));
      const num = String(serviceIndex + 1).padStart(2, '0');
      doc.text(num, margin + 5, y + headH / 2, { baseline: 'middle' });
      const nameX = margin + 5 + doc.getTextWidth(num) + 3;
      doc.setFontSize(12);
      textColor(onPrimary);
      const name = serviceName(service.serviceType).toUpperCase();
      doc.text(name, nameX, y + headH / 2, { baseline: 'middle' });
      const nameEnd = nameX + doc.getTextWidth(name);

      setFont('medium');
      doc.setFontSize(7);
      const chipW = chipItems.map((c) => doc.getTextWidth(c) + 6);
      const chipsTotal = chipW.reduce((a, b) => a + b, 0) + 2 * Math.max(0, chipW.length - 1);
      const inside = chipItems.length > 0 && nameEnd + 8 + chipsTotal < pageWidth - margin - 4;
      if (inside) {
        let cx = pageWidth - margin - 4 - chipsTotal;
        chipItems.forEach((c, i) => {
          fillColor(mix(th.primary, onPrimary, 0.16));
          doc.roundedRect(cx, y + headH / 2 - 2.8, chipW[i], 5.6, 2.8, 2.8, 'F');
          textColor(onPrimary);
          doc.text(c, cx + 3, y + headH / 2, { baseline: 'middle' });
          cx += chipW[i] + 2;
        });
      }
      y += headH + 5;
      if (!inside) chips(chipItems);
    } else {
      setFont('extrabold');
      doc.setFontSize(17);
      textColor(th.highlight);
      const num = `${serviceIndex + 1}.`;
      doc.text(num, margin, y, { baseline: 'top' });
      const numW = doc.getTextWidth(num) + 3;
      doc.setFontSize(13);
      textColor(th.primary);
      doc.text(serviceName(service.serviceType).toUpperCase(), margin + numW, y + 1.3, { baseline: 'top' });
      y += 10;
      chips(chipItems);
    }

    richBlocks(parseRichText(service.description), 'columns');

    if (service.costs.length > 0) itemsTable(service.costs.map((c) => c.description), 15);
    subtotal(serviceDisplayValue);
  });

  // OPERATIONAL COSTS
  const operationalCostItems = version.operationalCosts || [];
  let operationalTotal = 0;
  operationalCostItems.forEach(c => { operationalTotal += c.value; });

  if (operationalCostItems.length > 0 && !hideOp) {
    y += 10;
    ensureSpace(40);
    setFont('extrabold');
    doc.setFontSize(13);
    textColor(th.primary);
    doc.text(modern ? sentenceCase(t.operational) : t.operational.toUpperCase(), margin, y, { baseline: 'top' });
    y += 9;
    itemsTable(operationalCostItems.map((c) => c.description), 15);
    subtotal(operationalTotal, 'Subtotal');
  }

  // ============================================
  // 03 — INVESTMENT
  // ============================================
  const versionNfPercentage = version.nfCostPercentage ?? 13;
  const versionMarginPct = version.margin || 0;

  const totalCosts = totalProductionCost + operationalTotal;
  const divisor = 1 - (versionMarginPct / 100) - (versionNfPercentage / 100);
  const totalProjectValue = divisor > 0 ? totalCosts / divisor : totalCosts;
  const nfValue = totalProjectValue * (versionNfPercentage / 100);
  const marginValue = totalProjectValue - totalCosts - nfValue;
  const totalToDistribute = totalProductionCost + marginValue + (hideNf ? nfValue : 0) + (hideOp ? operationalTotal : 0);

  const investmentRows: [string, number][] = version.services.map((service, idx) => {
    const serviceCost = service.costs.reduce((sum, c) => sum + c.value, 0);
    const weight = totalProductionCost > 0 ? serviceCost / totalProductionCost : 0;
    const objLabel = objectiveName(service.serviceType, service.objective);
    return [`${idx + 1}. ${serviceName(service.serviceType)}${objLabel ? ` — ${objLabel}` : ''}`, weight * totalToDistribute];
  });
  if (operationalTotal > 0 && !hideOp) investmentRows.push(['Despesas Operacionais', operationalTotal]);
  if (!hideNf) investmentRows.push([`Nota Fiscal (${versionNfPercentage}%)`, nfValue]);

  if (modern) {
    // Keep the rows and the total together when they fit on one page
    y += 8;
    sectionHeading(3, t.investment, Math.min(investmentRows.length * 10 + 40, contentBottom - contentTop - 20));
    hline(y, th.accent, 0.2);
  } else {
    newPage();
    sectionHeading(3, t.investment);
    hline(y, th.primary, 0.4);
  }
  investmentRows.forEach(([rowLabel, value]) => {
    setFont('normal');
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(rowLabel, contentWidth - 50) as string[];
    const rowH = lines.length * lineHeight(10.5, 1.35) + 7;
    ensureSpace(rowH);
    textColor(th.text);
    textLines(lines, margin, y + 3.5, 1.35);
    setFont('bold');
    doc.text(formatCurrency(value), pageWidth - margin, y + 3.5, { baseline: 'top', align: 'right' });
    hline(y + rowH, th.accent, 0.2);
    y += rowH;
  });

  // TOTAL
  y += 7;
  if (modern) {
    const onPrimary = contrastOn(th.primary);
    const value = formatCurrency(totalProjectValue);
    setFont('extrabold');
    doc.setFontSize(24);
    const valueW = doc.getTextWidth(value);
    // Payment terms and validity on the right, when there is room
    const termsW = contentWidth - 20 - valueW - 12;
    const termLines: string[] = [];
    setFont('normal');
    doc.setFontSize(8.5);
    if (budget.paymentTerms && termsW > 30) termLines.push(...(doc.splitTextToSize(budget.paymentTerms, termsW) as string[]).slice(0, 3));
    if (termsW > 30) termLines.push(`${validityCell[0]}: ${validityCell[1]}`);
    const totalH = Math.max(26, 14 + termLines.length * lineHeight(8.5, 1.45) + (budget.paymentTerms ? 4 : 0));
    ensureSpace(totalH);
    fillColor(th.primary);
    box(margin, y, contentWidth, totalH, 'F', radius ? 4 : 0);
    label(t.total, margin + 10, y + totalH / 2 - 7, { color: highlightOn(th.primary), size: 7, spacing: 0.8 });
    setFont('extrabold');
    doc.setFontSize(24);
    textColor(onPrimary);
    doc.text(value, margin + 10, y + totalH / 2 + 3, { baseline: 'middle' });
    if (termLines.length) {
      const lh = lineHeight(8.5, 1.45);
      let ty = y + totalH / 2 - ((termLines.length + (budget.paymentTerms ? 1 : 0)) * lh) / 2;
      if (budget.paymentTerms) {
        setFont('bold');
        doc.setFontSize(9);
        textColor(onPrimary);
        doc.text('Pagamento', pageWidth - margin - 10, ty, { baseline: 'top', align: 'right' });
        ty += lh;
      }
      setFont('normal');
      doc.setFontSize(8.5);
      textColor(mix(onPrimary, th.primary, 0.12));
      termLines.forEach((line, i) => doc.text(line, pageWidth - margin - 10, ty + i * lh, { baseline: 'top', align: 'right' }));
    }
    y += totalH + 6;
  } else {
    const totalH = 22;
    ensureSpace(totalH);
    const onPrimary = contrastOn(th.primary);
    fillColor(th.primary);
    doc.rect(margin, y, contentWidth, totalH, 'F');
    fillColor(th.highlight);
    doc.rect(margin, y, 1.6, totalH, 'F');
    label(t.total, margin + 12, y + totalH / 2 - 1.6, { color: onPrimary, size: 9.5, spacing: 0.3 });
    setFont('extrabold');
    doc.setFontSize(22);
    textColor(onPrimary);
    doc.text(formatCurrency(totalProjectValue), pageWidth - margin - 10, y + totalH / 2, { baseline: 'middle', align: 'right' });
    y += totalH + 8;
  }

  // Observação sobre faturamento / Nota Fiscal
  if (!hideNfObs) {
    const obsTitle = 'Observação sobre faturamento — Emissão de Nota Fiscal';
    const companyName = layoutSettings?.companyName ? ` da ${layoutSettings.companyName.toUpperCase()}` : '';
    const obsBody = `A emissão de Nota Fiscal é obrigatória para esta proposta. Os valores apresentados já consideram a tributação incidente sobre o serviço prestado, de acordo com a alíquota vigente${companyName}.`;
    const pad = 8;
    setFont('normal');
    doc.setFontSize(9);
    const bodyLines = doc.splitTextToSize(obsBody, contentWidth - pad * 2) as string[];
    const boxH = pad + 5 + 2.5 + bodyLines.length * lineHeight(9, 1.55) + pad - 2;
    ensureSpace(boxH);
    fillColor(th.highlightBg);
    box(margin, y, contentWidth, boxH, 'F');
    setFont('bold');
    doc.setFontSize(9.5);
    textColor(modern ? th.primary : th.text);
    doc.text(obsTitle, margin + pad, y + pad, { baseline: 'top' });
    setFont('normal');
    doc.setFontSize(9);
    textColor(th.text);
    textLines(bodyLines, margin + pad, y + pad + 7.5, 1.55);
    y += boxH;
  }

  // ============================================
  // 04 — NEXT STEPS (moderno)
  // ============================================
  if (modern && nextSteps.enabled && nextSteps.steps.length) {
    const steps = nextSteps.steps;
    const gap = 4;
    const pad = 5;
    const w = (contentWidth - gap * (steps.length - 1)) / steps.length;
    const measure = (step: { title: string; text: string }) => {
      setFont('bold');
      doc.setFontSize(10);
      const titleLines = doc.splitTextToSize(step.title, w - pad * 2) as string[];
      setFont('normal');
      doc.setFontSize(8.5);
      const textLinesArr = step.text ? (doc.splitTextToSize(step.text, w - pad * 2) as string[]) : [];
      return { titleLines, textLinesArr };
    };
    const measured = steps.map(measure);
    const cardH = Math.max(...measured.map((m) =>
      pad + 7 + 4 + m.titleLines.length * lineHeight(10, 1.3) + (m.textLinesArr.length ? 1.5 + m.textLinesArr.length * lineHeight(8.5, 1.45) : 0) + pad,
    ));
    // Contact card: who answers, with a QR code that opens WhatsApp
    const contactName = responsibleUser?.name || layoutSettings?.companyName || '';
    const contactLine = [layoutSettings?.whatsapp, layoutSettings?.email].filter(Boolean).join(' · ');
    const hasContact = Boolean(contactName || contactLine);
    const qrSize = 22;
    const cardHc = hasContact ? (waLink ? qrSize + 12 : 26) : 0;
    y += 10;
    // Steps and contact card stay together on one page
    sectionHeading(4, nextSteps.title, cardH + (hasContact ? 6 + cardHc : 0));
    steps.forEach((_, i) => {
      const x = margin + i * (w + gap);
      const { titleLines, textLinesArr } = measured[i];
      drawColor(th.accent);
      doc.setLineWidth(0.3);
      box(x, y, w, cardH, 'S');
      fillColor(highlightTint);
      doc.circle(x + pad + 3.5, y + pad + 3.5, 3.5, 'F');
      setFont('extrabold');
      doc.setFontSize(9);
      textColor(th.highlight);
      doc.text(String(i + 1), x + pad + 3.5, y + pad + 3.5, { baseline: 'middle', align: 'center' });
      let ty = y + pad + 7 + 4;
      setFont('bold');
      doc.setFontSize(10);
      textColor(th.primary);
      textLines(titleLines, x + pad, ty, 1.3);
      ty += titleLines.length * lineHeight(10, 1.3) + 1.5;
      setFont('normal');
      doc.setFontSize(8.5);
      textColor(th.secondary);
      textLines(textLinesArr, x + pad, ty, 1.45);
    });
    y += cardH + 6;

    if (hasContact) {
      ensureSpace(cardHc);
      fillColor(th.highlightBg);
      box(margin, y, contentWidth, cardHc, 'F', radius ? 4 : 0);
      const cy = y + cardHc / 2;
      const avatarR = 7.5;
      const ax = margin + 8 + avatarR;
      fillColor(th.primary);
      doc.circle(ax, cy, avatarR, 'F');
      setFont('extrabold');
      doc.setFontSize(14);
      textColor(contrastOn(th.primary));
      doc.text((contactName.trim()[0] || '·').toUpperCase(), ax, cy, { baseline: 'middle', align: 'center' });
      const tx = ax + avatarR + 6;
      const textMax = contentWidth - (tx - margin) - (waLink ? qrSize + 14 : 8);
      label('Seu contato', tx, cy - 8.5, { size: 6.5, spacing: 0.8 });
      setFont('bold');
      doc.setFontSize(12.5);
      textColor(th.primary);
      doc.text((doc.splitTextToSize(contactName, textMax) as string[])[0] ?? '', tx, cy - 4, { baseline: 'top' });
      if (contactLine) {
        setFont('normal');
        doc.setFontSize(8.5);
        textColor(th.text);
        doc.text((doc.splitTextToSize(contactLine, textMax) as string[])[0] ?? '', tx, cy + 2.6, { baseline: 'top' });
      }
      if (waLink) {
        const qx = pageWidth - margin - 6 - qrSize;
        const qy = y + 4;
        fillColor(WHITE);
        box(qx - 2, qy - 2, qrSize + 4, qrSize + 6.5, 'F', radius ? 2 : 0);
        const qr = QRCode.create(waLink, { errorCorrectionLevel: 'M' });
        const n = qr.modules.size;
        const cell = qrSize / n;
        fillColor(th.text);
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (qr.modules.get(r, c)) doc.rect(qx + c * cell, qy + r * cell, cell + 0.02, cell + 0.02, 'F');
          }
        }
        doc.link(qx, qy, qrSize, qrSize, { url: waLink });
        setFont('medium');
        doc.setFontSize(5.5);
        textColor(th.secondary);
        doc.text('Falar no WhatsApp', qx + qrSize / 2, qy + qrSize + 1, { baseline: 'top', align: 'center' });
      }
      y += cardHc;
    }
  }

  // Save
  if (!skipSave) {
    const safeProjectName = budget.projectName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const fileName = `${budget.proposalId}_${safeProjectName}_V${version.version}.pdf`;
    await saveWithCustomPages(doc, layoutSettings, fileName);
  }
  return doc;
}

async function fetchPdfBytes(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return await res.arrayBuffer();
  } catch (err) {
    console.warn('Não foi possível carregar página personalizada:', err);
    return null;
  }
}

/** Mescla capa (início) e contracapa (fim) enviadas pelo usuário com o PDF gerado. */
export async function buildFinalPdfBlob(doc: jsPDF, layoutSettings?: PDFLayoutSettings | null): Promise<Blob> {
  const cover = layoutSettings?.coverPdfUrl;
  const back = layoutSettings?.backPdfUrl;
  if (!cover && !back) return doc.output('blob');
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  const append = async (bytes: ArrayBuffer | null) => {
    if (!bytes) return;
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(pg => out.addPage(pg));
    } catch (err) {
      console.warn('PDF personalizado inválido:', err);
    }
  };
  if (cover) await append(await fetchPdfBytes(cover));
  await append(doc.output('arraybuffer'));
  if (back) await append(await fetchPdfBytes(back));
  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export async function saveWithCustomPages(doc: jsPDF, layoutSettings: PDFLayoutSettings | null | undefined, fileName: string) {
  if (!layoutSettings?.coverPdfUrl && !layoutSettings?.backPdfUrl) { doc.save(fileName); return; }
  const blob = await buildFinalPdfBlob(doc, layoutSettings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
