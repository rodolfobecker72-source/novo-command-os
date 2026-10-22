import jsPDF from 'jspdf';
import { resolveTheme } from './pdfTheme';
import { Budget, Client, ServiceItem, DELIVERY_TYPE_LABELS, DeliveryType } from '@/types/crm';
import { PDFLayoutSettings } from '@/utils/pdfGenerator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addBusinessDays, addDays } from 'date-fns';

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
      } else reject(new Error('No canvas context'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

interface ProjectPDFParams {
  budget: Budget;
  client: Client;
  layoutSettings?: PDFLayoutSettings | null;
}

export async function generateProjectPDF({ budget, client, layoutSettings }: ProjectPDFParams) {
  const doc = new jsPDF();
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
  const accentBlue = [59, 130, 246] as [number, number, number];

  let logoData: { base64: string; width: number; height: number } | null = null;
  const headerLogoUrl = layoutSettings?.logoUrl || '/images/hero-logo-black.png';
  try { logoData = await loadImageAsBase64(headerLogoUrl); } catch {}

  let footerLogoData: { base64: string; width: number; height: number } | null = null;
  try {
    const { default: commandLogoUrl } = await import('@/assets/command-logo.png');
    footerLogoData = await loadImageAsBase64(commandLogoUrl);
  } catch {}

  let y = contentStartY;

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

  const drawLine = (yPos: number) => {
    doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  const addHeader = () => {
    if (logoData) {
      const logoH = 20;
      const logoW = logoH * (logoData.width / logoData.height);
      doc.addImage(logoData.base64, 'PNG', pageWidth - margin - logoW, headerY - 2, logoW, logoH);
    }
  };

  const addFooter = () => {
    if (footerLogoData) {
      const fH = 6;
      const fW = fH * (footerLogoData.width / footerLogoData.height);
      doc.addImage(footerLogoData.base64, 'PNG', pageWidth / 2 - fW / 2, pageHeight - 20, fW, fH);
    }
    doc.setFontSize(7);
    doc.setFont(__th.font, 'normal');
    setColor(lightGray);
    const parts: string[] = [];
    if (layoutSettings?.companyName) parts.push(layoutSettings.companyName.toUpperCase());
    if (layoutSettings?.website) parts.push(layoutSettings.website);
    if (layoutSettings?.email) parts.push(layoutSettings.email);
    const footerText = parts.length > 0 ? parts.join(' • ') : '';
    if (footerText) doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > footerTopY) {
      addHeader();
      addFooter();
      doc.addPage();
      y = contentStartY;
    }
    return y;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(16);
    doc.setFontSize(12);
    doc.setFont(__th.font, 'bold');
    setColor(black);
    doc.text(title, margin, y);
    y += 8;
  };

  const drawLabelValue = (label: string, value: string) => {
    ensureSpace(8);
    doc.setFontSize(9);
    doc.setFont(__th.font, 'bold');
    setColor(gray);
    const labelWidth = doc.getTextWidth(label + '  ');
    doc.text(label, margin, y);
    doc.setFont(__th.font, 'normal');
    setColor(darkGray);
    const maxValueWidth = contentWidth - labelWidth;
    const valueLines = doc.splitTextToSize(value, maxValueWidth) as string[];
    for (let li = 0; li < valueLines.length; li++) {
      if (li === 0) {
        doc.text(valueLines[li], margin + labelWidth, y);
      } else {
        y += 4.5;
        ensureSpace(5);
        doc.text(valueLines[li], margin + labelWidth, y);
      }
    }
    y += 7;
  };

  // ===== PAGE 1 =====
  addHeader();

  // Title
  doc.setFontSize(14);
  doc.setFont(__th.font, 'bold');
  setColor(black);
  doc.text('FICHA DO PROJETO', margin, headerY + 4);

  y = contentStartY;

  // Project identifier
  doc.setFontSize(12);
  doc.setFont(__th.font, 'bold');
  setColor(darkGray);
  const identifier = `${budget.proposalId} - ${budget.projectName}`;
  const idLines = doc.splitTextToSize(identifier, contentWidth - 50);
  doc.text(idLines, margin, y);
  y += idLines.length * 6 + 4;

  doc.setFontSize(8);
  doc.setFont(__th.font, 'normal');
  setColor(gray);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
  y += 10;

  drawLine(y);
  y += 10;

  // ===== CLIENT =====
  drawSectionTitle('CLIENTE');
  drawLabelValue('Empresa:', client.companyName);
  drawLabelValue('Responsável:', client.responsiblePerson);
  if (client.phone) drawLabelValue('Telefone:', client.phone);

  y += 3;
  drawLine(y);
  y += 10;

  // ===== EXECUTION INFO =====
  drawSectionTitle('INFORMAÇÕES DA EXECUÇÃO');
  if (budget.location) drawLabelValue('Local:', budget.location);

  if (budget.executionStartDate) {
    drawLabelValue('Início:', format(new Date(budget.executionStartDate), 'dd/MM/yyyy'));
  }
  if (budget.executionEndDate) {
    drawLabelValue('Fim:', format(new Date(budget.executionEndDate), 'dd/MM/yyyy'));
  }

  if (budget.objective) {
    drawLabelValue('Objetivo:', budget.objective);
  }

  y += 3;
  drawLine(y);
  y += 10;

  // ===== BRIEFING =====
  if (budget.projectDescription) {
    drawSectionTitle('BRIEFING DO PROJETO');
    ensureSpace(20);
    doc.setFontSize(10);
    doc.setFont(__th.font, 'normal');
    setColor(darkGray);
    const descLines = doc.splitTextToSize(budget.projectDescription, contentWidth) as string[];
    for (const line of descLines) {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 8;
    drawLine(y);
    y += 10;
  }

  // ===== SERVICES =====
  const approvedVer = budget.approvedVersion != null
    ? budget.versions?.find(v => v.version === budget.approvedVersion)
    : null;
  const latestVersion = approvedVer
    || (budget.versions?.length ? [...budget.versions].sort((a, c) => c.version - a.version)[0] : null);

  if (latestVersion?.services?.length) {
    // Always start services on a new page
    addHeader();
    addFooter();
    doc.addPage();
    y = contentStartY;
    drawSectionTitle('SERVIÇOS E PRAZOS DE ENTREGA');

    const services = latestVersion.services as ServiceItem[];
    const execStart = budget.executionStartDate ? new Date(budget.executionStartDate) : null;

    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      const blockHeight = 40 + (svc.description ? 20 : 0);
      ensureSpace(blockHeight);

      // Service card background
      doc.setFillColor(...__th.highlightBg);
      doc.roundedRect(margin, y - 2, contentWidth, 0.1, 2, 2, 'F'); // measure first

      // Service number + name
      doc.setFontSize(11);
      doc.setFont(__th.font, 'bold');
      setColor(accentBlue);
      const svcTitle = `${i + 1}. ${svc.serviceType}${svc.objective ? ` — ${svc.objective}` : ''}`;
      const svcTitleLines = doc.splitTextToSize(svcTitle, contentWidth);
      doc.text(svcTitleLines, margin, y);
      y += svcTitleLines.length * 5 + 3;

      // Description
      if (svc.description) {
        doc.setFontSize(9);
        doc.setFont(__th.font, 'normal');
        setColor(darkGray);
        const svcDescLines = doc.splitTextToSize(svc.description, contentWidth - 4) as string[];
        for (const line of svcDescLines) {
          ensureSpace(5);
          doc.text(line, margin + 2, y);
          y += 4.5;
        }
        y += 3;
      }

      // Delivery date
      if (svc.deliveryType) {
        ensureSpace(8);
        let deliveryDate: Date | null = null;
        if (svc.deliveryType === 'data_especifica' && (svc as any).deliveryDate) {
          deliveryDate = new Date((svc as any).deliveryDate + 'T12:00:00');
        } else if (execStart) {
          if (svc.deliveryType === 'realtime') {
            deliveryDate = new Date(execStart);
          } else if (svc.deliveryType === 'dias_uteis' && svc.deliveryDays) {
            deliveryDate = addBusinessDays(execStart, svc.deliveryDays);
            deliveryDate = addDays(deliveryDate, -1);
          } else if (svc.deliveryType === 'dias_corridos' && svc.deliveryDays) {
            deliveryDate = addDays(execStart, svc.deliveryDays);
            deliveryDate = addDays(deliveryDate, -1);
          }
        }
        if (deliveryDate) {
          doc.setFontSize(9);
          doc.setFont(__th.font, 'bold');
          setColor(accentBlue);
          doc.text(`Data de Entrega: ${format(deliveryDate, 'dd/MM/yyyy')}`, margin + 2, y);
          y += 5;
        }
      } else if (!svc.deliveryType) {
        ensureSpace(8);
        doc.setFontSize(9);
        doc.setFont(__th.font, 'italic');
        setColor(gray);
        doc.text('Data de entrega não definida', margin + 2, y);
        y += 5;
      }

      y += 8;

      // Separator between services
      if (i < services.length - 1) {
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.3);
        doc.line(margin + 10, y - 4, pageWidth - margin - 10, y - 4);
        y += 6;
      }
    }
  }

  // Finalize
  addHeader();
  addFooter();

  doc.save(`Ficha_Projeto_${budget.proposalId}_${budget.projectName.replace(/\s+/g, '_')}.pdf`);
}
