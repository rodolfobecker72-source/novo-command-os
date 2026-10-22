import jsPDF from 'jspdf';
import { resolveTheme } from './pdfTheme';
import {
  Budget,
  Client,
  SERVICE_TYPE_LABELS,
  formatCurrency,
} from '@/types/crm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PDFLayoutSettings } from '@/utils/pdfGenerator';

interface FinancialReportParams {
  budget: Budget;
  client: Client;
  userName: string;
  layoutSettings?: PDFLayoutSettings | null;
  categoryLabels?: Record<string, string>;
  objectiveLabels?: Record<string, Record<string, string>>;
}

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
        resolve({ base64: canvas.toDataURL('image/png'), width: img.width, height: img.height });
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function generateFinancialReportPDF({ budget, client, userName, layoutSettings, categoryLabels: catLabels, objectiveLabels: objLabels }: FinancialReportParams): Promise<void> {
  const catLookup = catLabels || {};
  const objLookup = objLabels || {};
  const doc = new jsPDF();
  const __th = resolveTheme(layoutSettings?.brandTheme);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const headerY = 15;
  const contentStartY = 28;
  const footerTopY = pageHeight - 28;

  const black = __th.text;
  const darkGray = __th.secondary;
  const gray = [128, 128, 128] as [number, number, number];
  const lightGray = __th.accent;
  const green = [22, 101, 52] as [number, number, number];
  const red = [185, 28, 28] as [number, number, number];

  const titleSize = 14;
  const subtitleSize = 12;
  const normalSize = 10;
  const smallSize = 9;

  const generatedDate = format(new Date(), "dd/MM/yyyy", { locale: ptBR });

  let logoData: { base64: string; width: number; height: number } | null = null;
  const headerLogoUrl = layoutSettings?.logoUrl || '/images/hero-logo-black.png';
  try {
    logoData = await loadImageAsBase64(headerLogoUrl);
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  let footerLogoData: { base64: string; width: number; height: number } | null = null;
  try {
    const { default: commandLogoUrl } = await import('@/assets/command-logo.png');
    footerLogoData = await loadImageAsBase64(commandLogoUrl);
  } catch (e) {
    console.warn('Could not load footer logo:', e);
  }

  let y = contentStartY;

  const setColor = (color: [number, number, number]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const drawLine = (yPos: number) => {
    doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  const addHeader = () => {
    if (logoData) {
      const logoHeight = 20;
      const aspectRatio = logoData.width / logoData.height;
      const logoWidth = logoHeight * aspectRatio;
      doc.addImage(logoData.base64, 'PNG', pageWidth - margin - logoWidth, headerY - 2, logoWidth, logoHeight);
    }
  };

  const addFooter = () => {
    if (footerLogoData) {
      const fLogoH = 6;
      const fAspect = footerLogoData.width / footerLogoData.height;
      const fLogoW = fLogoH * fAspect;
      doc.addImage(footerLogoData.base64, 'PNG', pageWidth / 2 - fLogoW / 2, pageHeight - 20, fLogoW, fLogoH);
    }
    doc.setFontSize(7);
    doc.setFont(__th.font, 'normal');
    setColor(lightGray);
    const footerParts: string[] = [];
    if (layoutSettings?.companyName) footerParts.push(layoutSettings.companyName.toUpperCase());
    if (layoutSettings?.website) footerParts.push(layoutSettings.website);
    if (layoutSettings?.email) footerParts.push(layoutSettings.email);
    const footerText = footerParts.length > 0
      ? footerParts.join(' • ')
      : 'HERO AUDIOVISUAL • www.hero.rec.br • comercial@hero.rec.br';
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  };

  const ensureSpace = (neededHeight: number): number => {
    if (y + neededHeight > footerTopY) {
      addHeader();
      addFooter();
      doc.addPage();
      y = contentStartY;
    }
    return y;
  };

  // ============================================
  // PAGE 1: Header + Project Info + Financial Summary
  // ============================================
  addHeader();

  doc.setFontSize(titleSize);
  doc.setTextColor(...__th.primary);
  doc.setFont(__th.font, 'bold');
  setColor(black);
  doc.text('RELATÓRIO FINANCEIRO', margin, headerY + 4);

  y = contentStartY;

  // Project identifier
  const projectIdentifier = `${budget.proposalId} - ${budget.projectName}`;
  doc.setFontSize(subtitleSize);
  doc.setTextColor(...__th.primary);
  doc.setFont(__th.font, 'bold');
  setColor(darkGray);
  const identifierLines = doc.splitTextToSize(projectIdentifier, contentWidth - 50);
  doc.text(identifierLines, margin, y);
  y += identifierLines.length * 6 + 8;

  drawLine(y);
  y += 10;

  // CLIENT BLOCK
  doc.setFontSize(subtitleSize);
  doc.setTextColor(...__th.primary);
  doc.setFont(__th.font, 'bold');
  setColor(black);
  doc.text('CLIENTE', margin, y);
  y += 8;

  doc.setFontSize(normalSize);
  doc.setFont(__th.font, 'normal');
  setColor(darkGray);
  doc.text(`Empresa: ${client.companyName}`, margin, y);
  y += 6;
  doc.text(`Responsável: ${client.responsiblePerson}`, margin, y);
  y += 6;
  doc.text(`Data do Relatório: ${generatedDate}`, margin, y);
  y += 6;
  if (userName) {
    doc.text(`Gerado por: ${userName}`, margin, y);
    y += 6;
  }

  y += 12;
  drawLine(y);
  y += 10;

  // ============================================
  // CONSOLIDAÇÃO FINANCEIRA
  // ============================================
  doc.setFontSize(subtitleSize);
  doc.setTextColor(...__th.primary);
  doc.setFont(__th.font, 'bold');
  setColor(black);
  doc.text('CONSOLIDAÇÃO FINANCEIRA', margin, y);
  y += 12;

  const execution = budget.execution;
  const investimento = budget.finalValue || 0;

  // Helper to draw a row with label + value
  const drawRow = (label: string, value: string, opts?: { bold?: boolean; color?: [number, number, number]; labelColor?: [number, number, number] }) => {
    ensureSpace(8);
    doc.setFontSize(normalSize);
    doc.setFont(__th.font, opts?.bold ? 'bold' : 'normal');
    setColor(opts?.labelColor || darkGray);
    doc.text(label, margin, y);
    setColor(opts?.color || darkGray);
    doc.setFont(__th.font, opts?.bold ? 'bold' : 'normal');
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 7;
  };

  // Investimento Total
  drawRow('Investimento Total', formatCurrency(investimento), { bold: true, labelColor: black, color: black });
  y += 2;
  drawLine(y);
  y += 8;

  // Custos Reais por Entrega
  doc.setFontSize(normalSize);
  doc.setFont(__th.font, 'bold');
  setColor(black);
  doc.text('CUSTOS REAIS POR ENTREGA', margin, y);
  y += 8;

  let totalCustosReais = 0;

  if (execution?.services && execution.services.length > 0) {
    execution.services.forEach((svc: any, idx: number) => {
      const svcRealTotal = svc.costs?.reduce((sum: number, c: any) => sum + (c.realValue || 0), 0) || 0;
      const extraCostsTotal = svc.extraCosts?.reduce((sum: number, c: any) => sum + (c.realValue || 0), 0) || 0;
      const svcTotal = svcRealTotal + extraCostsTotal;
      totalCustosReais += svcTotal;

      const objLabel = objLookup[svc.serviceType]?.[svc.objective] || svc.objective || '';
      const svcLabel = `${idx + 1}. ${catLookup[svc.serviceType] || SERVICE_TYPE_LABELS[svc.serviceType] || svc.serviceType}${objLabel ? ` — ${objLabel}` : ''}`;
      drawRow(svcLabel, formatCurrency(svcTotal));

      // Detail: individual costs
      if (svc.costs && svc.costs.length > 0) {
        svc.costs.forEach((cost: any) => {
          if (cost.realValue > 0) {
            ensureSpace(6);
            doc.setFontSize(smallSize);
            doc.setFont(__th.font, 'normal');
            setColor(gray);
            const costDesc = cost.description || 'Item';
            doc.text(`    • ${costDesc}`, margin, y);
            doc.text(formatCurrency(cost.realValue || 0), pageWidth - margin, y, { align: 'right' });
            y += 5;
          }
        });
      }
      // Extra costs
      if (svc.extraCosts && svc.extraCosts.length > 0) {
        svc.extraCosts.forEach((cost: any) => {
          if (cost.realValue > 0) {
            ensureSpace(6);
            doc.setFontSize(smallSize);
            doc.setFont(__th.font, 'normal');
            setColor(gray);
            doc.text(`    • ${cost.description || 'Custo extra'} (extra)`, margin, y);
            doc.text(formatCurrency(cost.realValue || 0), pageWidth - margin, y, { align: 'right' });
            y += 5;
          }
        });
      }
      y += 2;
    });
  }

  // Despesas operacionais reais
  const opReal = execution?.operationalCosts?.reduce((sum: number, c: any) => sum + (c.realValue || 0), 0) || 0;
  const extraOpReal = execution?.extraOperationalCosts?.reduce((sum: number, c: any) => sum + (c.realValue || 0), 0) || 0;
  const totalOpReal = opReal + extraOpReal;

  if (totalOpReal > 0) {
    y += 2;
    drawRow('Despesas Operacionais', formatCurrency(totalOpReal));

    // Detail
    if (execution?.operationalCosts) {
      execution.operationalCosts.forEach((cost: any) => {
        if (cost.realValue > 0) {
          ensureSpace(6);
          doc.setFontSize(smallSize);
          doc.setFont(__th.font, 'normal');
          setColor(gray);
          doc.text(`    • ${cost.description || 'Operacional'}`, margin, y);
          doc.text(formatCurrency(cost.realValue || 0), pageWidth - margin, y, { align: 'right' });
          y += 5;
        }
      });
    }
    if (execution?.extraOperationalCosts) {
      execution.extraOperationalCosts.forEach((cost: any) => {
        if (cost.realValue > 0) {
          ensureSpace(6);
          doc.setFontSize(smallSize);
          doc.setFont(__th.font, 'normal');
          setColor(gray);
          doc.text(`    • ${cost.description || 'Extra'} (extra)`, margin, y);
          doc.text(formatCurrency(cost.realValue || 0), pageWidth - margin, y, { align: 'right' });
          y += 5;
        }
      });
    }
    totalCustosReais += totalOpReal;
  }

  y += 4;
  drawLine(y);
  y += 8;

  // Total Custos Reais
  drawRow('Total de Custos Reais', formatCurrency(totalCustosReais), { bold: true, labelColor: black, color: red });

  // Imposto NF
  const nfValue = execution?.nfTaxValue || 0;
  drawRow('Imposto NF', formatCurrency(nfValue));

  y += 2;
  drawLine(y);
  y += 10;

  // Margem Real
  const custoTotal = totalCustosReais + nfValue;
  const margemReais = investimento - custoTotal;
  const margemPercent = investimento > 0 ? (margemReais / investimento) * 100 : 0;
  const margemColor = margemReais >= 0 ? green : red;

  doc.setFontSize(subtitleSize);
  doc.setTextColor(...__th.primary);
  doc.setFont(__th.font, 'bold');
  setColor(black);
  doc.text('MARGEM REAL', margin, y);
  doc.setFontSize(titleSize);
  doc.setTextColor(...__th.primary);
  setColor(margemColor);
  doc.text(`${formatCurrency(margemReais)} (${margemPercent.toFixed(1)}%)`, pageWidth - margin, y, { align: 'right' });

  y += 16;

  // ============================================
  // RESUMO COMPARATIVO
  // ============================================
  ensureSpace(60);
  doc.setFontSize(subtitleSize);
  doc.setTextColor(...__th.primary);
  doc.setFont(__th.font, 'bold');
  setColor(black);
  doc.text('RESUMO', margin, y);
  y += 10;

  // Simple summary table
  const col1X = margin;
  const col2X = pageWidth - margin;

  doc.setFontSize(normalSize);
  doc.setFont(__th.font, 'bold');
  setColor(black);
  doc.text('Item', col1X, y);
  doc.text('Valor', col2X, y, { align: 'right' });
  y += 2;
  drawLine(y);
  y += 6;

  doc.setFont(__th.font, 'normal');
  setColor(darkGray);

  const summaryRows = [
    ['Investimento Total', formatCurrency(investimento)],
    ['(-) Custos Reais', formatCurrency(totalCustosReais)],
    ['(-) Imposto NF', formatCurrency(nfValue)],
  ];

  summaryRows.forEach(([label, value]) => {
    doc.text(label, col1X, y);
    doc.text(value, col2X, y, { align: 'right' });
    y += 7;
  });

  drawLine(y);
  y += 6;

  doc.setFont(__th.font, 'bold');
  setColor(margemColor);
  doc.text('= Margem Real', col1X, y);
  doc.text(`${formatCurrency(margemReais)} (${margemPercent.toFixed(1)}%)`, col2X, y, { align: 'right' });

  addHeader();
  addFooter();

  // Save
  const safeProjectName = budget.projectName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const fileName = `Relatorio_Financeiro_${budget.proposalId}_${safeProjectName}.pdf`;
  doc.save(fileName);
}
