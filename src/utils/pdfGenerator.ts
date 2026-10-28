import jsPDF from 'jspdf';
import { resolveTheme, contrastOn, type RGB } from './pdfTheme';
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
  companyCnpj?: string;
  companyAddress?: string;
  companyCityLine?: string;
  brandTheme?: import('./pdfTheme').BrandTheme | null;
  coverPdfUrl?: string;
  backPdfUrl?: string;
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

const PT_TO_MM = 0.3528;

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
    validity: layoutSettings?.validityText || 'Validade: 30 dias',
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

  const sectionHeading = (num: number, title: string) => {
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
  const listTitle = (title: string | null, x: number, top: number, width: number, size: number, draw: boolean) => {
    if (!title) return 0;
    setFont('bold');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(title.toUpperCase(), width - 4) as string[];
    if (draw) {
      textColor(th.text);
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
      const heights = row.map((l) => {
        const th1 = listTitle(l.title, 0, 0, inner, 9.5, false);
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
        doc.rect(x, y, w, h, 'F');
        let yy = y + pad;
        const titleH = listTitle(l.title, x + pad, yy, inner, 9.5, true);
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
        const th1 = listTitle(l.title, 0, 0, w, 8.5, false);
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
        const titleH = listTitle(l.title, x, yy, w, 8.5, true);
        if (titleH) {
          hline(yy + titleH + 1.2, th.highlight, 0.35, x, x + w);
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
    const widths = natural.map((n) => (n / total) * contentWidth);
    const valueLines = cells.map(([, v], i) => doc.splitTextToSize(v, widths[i] - pad * 2) as string[]);
    const h = pad + 3 + 2.5 + Math.max(...valueLines.map((l) => l.length)) * lineHeight(9.5, 1.35) + pad;
    ensureSpace(h + 4);
    y += 2;
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
      drawColor(th.accent);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, h, 1, 1, 'S');
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
      fillColor(th.primary);
      doc.rect(margin, y, contentWidth, headH, 'F');
      label('#', margin + 4, y + 2.9, { color: onPrimary });
      label('Descrição', margin + 20, y + 2.9, { color: onPrimary });
      y += headH;
    };
    ensureSpace(headH + 12);
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
      doc.text(String(i + 1), margin + 4, y + 2.7, { baseline: 'top' });
      setFont('normal');
      textColor(th.text);
      textLines(lines, margin + 20, y + 2.7, 1.35);
      hline(y + rowH, th.accent, 0.2);
      y += rowH;
    });
  };

  const subtotal = (value: number) => {
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
  const validityMatch = t.validity.match(/^([^:]{1,30}):\s*(.+)$/);
  infoCells.push(validityMatch ? [validityMatch[1].trim(), validityMatch[2].trim()] : ['Validade', t.validity]);
  infoStrip(infoCells);

  // ============================================
  // 02 — SERVICES
  // ============================================
  let totalProductionCost = 0;
  version.services.forEach(s => { totalProductionCost += s.costs.reduce((sum, c) => sum + c.value, 0); });

  const hideNf = !!budget.hideNfInPdf;
  const hideOp = !!budget.hideOperationalInPdf;
  const hideNfObs = !!budget.hideNfObservationInPdf;
  const preNfPct = version.nfCostPercentage || 13;
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

  newPage();
  sectionHeading(2, t.services);

  version.services.forEach((service, serviceIndex) => {
    const serviceProductionCost = service.costs.reduce((sum, c) => sum + c.value, 0);
    const serviceWeight = totalProductionCost > 0 ? serviceProductionCost / totalProductionCost : 0;
    const serviceDisplayValue = serviceWeight * preToDistribute;

    if (serviceIndex > 0) y += 10;
    ensureSpace(45);

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

    const chipItems: string[] = [];
    const objectiveLabel = objectiveName(service.serviceType, service.objective);
    if (objectiveLabel) chipItems.push(`Objetivo: ${objectiveLabel}`);
    if (service.deliveryType === 'realtime') {
      chipItems.push('Prazo de entrega: Real time (mesmo dia)');
    } else if (service.deliveryType === 'dias_uteis') {
      chipItems.push(`Prazo de entrega: ${service.deliveryDays || ''} dias úteis`);
    } else if (service.deliveryType === 'dias_corridos') {
      chipItems.push(`Prazo de entrega: ${service.deliveryDays || ''} dias corridos`);
    } else if (service.deliveryType === 'data_especifica' && (service as any).deliveryDate) {
      const d = new Date((service as any).deliveryDate + 'T12:00:00');
      chipItems.push(`Prazo de entrega: ${d.toLocaleDateString('pt-BR')}`);
    }
    chips(chipItems);

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
    doc.text(t.operational.toUpperCase(), margin, y, { baseline: 'top' });
    y += 9;
    itemsTable(operationalCostItems.map((c) => c.description), 15);
    subtotal(operationalTotal);
  }

  // ============================================
  // 03 — INVESTMENT
  // ============================================
  const versionNfPercentage = version.nfCostPercentage || 13;
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

  newPage();
  sectionHeading(3, t.investment);
  hline(y, th.primary, 0.4);
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
    doc.rect(margin, y, contentWidth, boxH, 'F');
    setFont('bold');
    doc.setFontSize(9.5);
    textColor(th.text);
    doc.text(obsTitle, margin + pad, y + pad, { baseline: 'top' });
    setFont('normal');
    doc.setFontSize(9);
    textLines(bodyLines, margin + pad, y + pad + 7.5, 1.55);
    y += boxH;
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
