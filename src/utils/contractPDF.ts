import jsPDF from 'jspdf';
import { resolveTheme } from './pdfTheme';
import { formatCurrency, formatCNPJ, formatPhone, BudgetVersion, ServiceItem, Budget, Client } from '@/types/crm';
import { generateProposalPDF, PDFLayoutSettings, saveWithCustomPages } from '@/utils/pdfGenerator';

interface ContractPDFParams {
  template: string;
  budget: Budget;
  version: BudgetVersion;
  client: Client;
  layoutSettings?: PDFLayoutSettings | null;
  responsibleUser?: { id: string; name: string; photo: string } | null;
}

type ContractBlock =
  | { type: 'title'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'spacer' };

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '___/___/______';
  try {
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return String(dateStr);
  }
}

function buildServicesList(version: BudgetVersion): string {
  if (!version.services || version.services.length === 0) return 'Conforme proposta comercial anexa.';
  return version.services.map((s: ServiceItem, i: number) => {
    const objective = s.objective ? ` — ${s.objective}` : '';
    return `${i + 1}. ${s.serviceType}${objective}`;
  }).join('\n');
}

function buildExecutionDates(budget: Budget): string {
  if (!budget.hasExecutionDate) return '';
  const start = formatDate(budget.executionStartDate);
  const end = formatDate(budget.executionEndDate);
  return `Início: ${start}\nTérmino: ${end}`;
}

function isTitleLine(line: string): boolean {
  return /^(CONTRATO|CLÁUSULA|CONTRATANTE|CONTRATADA|___)/i.test(line.trim());
}

function isStandaloneParagraphLine(line: string): boolean {
  return /^((\d+(?:[.-]\d+)*[.)]?|[•\-–])\s+|[a-zA-Z]\)\s+)/.test(line.trim());
}

function buildContractBlocks(text: string): ContractBlock[] {
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalizedText) return [];

  const rawLines = normalizedText.split('\n');
  const blocks: ContractBlock[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    blocks.push({
      type: 'paragraph',
      text: paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim(),
    });
    paragraphBuffer = [];
  };

  for (const rawLine of rawLines) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      flushParagraph();
      blocks.push({ type: 'spacer' });
      continue;
    }

    if (isTitleLine(trimmedLine)) {
      flushParagraph();
      blocks.push({ type: 'title', text: trimmedLine });
      continue;
    }

    if (isStandaloneParagraphLine(trimmedLine)) {
      flushParagraph();
      paragraphBuffer = [trimmedLine];
      continue;
    }

    paragraphBuffer.push(trimmedLine);
  }

  flushParagraph();
  return blocks;
}

function drawJustifiedLine(doc: jsPDF, line: string, x: number, y: number, maxWidth: number) {
  const words = line.trim().split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    doc.text(line, x, y);
    return;
  }

  const renderedLine = words.join(' ');
  const lineWidth = doc.getTextWidth(renderedLine);

  if (lineWidth < maxWidth * 0.72) {
    doc.text(renderedLine, x, y);
    return;
  }

  const wordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
  const gapWidth = (maxWidth - wordsWidth) / (words.length - 1);

  let cursorX = x;
  words.forEach((word, index) => {
    doc.text(word, cursorX, y);
    if (index < words.length - 1) {
      cursorX += doc.getTextWidth(word) + gapWidth;
    }
  });
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

export async function generateContractPDF(params: ContractPDFParams) {
  const { template, budget, version, client, layoutSettings, responsibleUser } = params;

  let text = template;
  const cepFormatted = client.zipCode
    ? client.zipCode.replace(/\D/g, '').replace(/^(\d{5})(\d{3}).*/, '$1-$2')
    : '';
  const enderecoLinha1Parts = [client.address, client.addressNumber].filter(Boolean).join(', ');
  const enderecoLinha1 = client.addressComplement ? `${enderecoLinha1Parts} — ${client.addressComplement}` : enderecoLinha1Parts;
  const enderecoLinha2Parts = [
    client.neighborhood,
    [client.city, client.state].filter(Boolean).join('/'),
    cepFormatted ? `CEP ${cepFormatted}` : '',
  ].filter(Boolean).join(' — ');
  const enderecoCompleto = [enderecoLinha1, enderecoLinha2Parts].filter(Boolean).join(' — ');

  const replacements: Record<string, string> = {
    '{{empresa_cliente}}': client.companyName || '',
    '{{cnpj}}': client.cnpj ? formatCNPJ(client.cnpj) : '',
    '{{responsavel}}': client.legalRepresentativeName || client.responsiblePerson || '',
    '{{representante_legal}}': client.legalRepresentativeName || '',
    '{{cpf_representante}}': client.legalRepresentativeCpf
      ? client.legalRepresentativeCpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : '',
    '{{email_cliente}}': client.email || '',
    '{{telefone_cliente}}': client.phone ? formatPhone(client.phone) : '',
    '{{endereco}}': client.address || '',
    '{{numero}}': client.addressNumber || '',
    '{{complemento}}': client.addressComplement || '',
    '{{bairro}}': client.neighborhood || '',
    '{{cep}}': cepFormatted,
    '{{cidade}}': client.city || '',
    '{{estado}}': client.state || '',
    '{{endereco_completo}}': enderecoCompleto,
    '{{inscricao_estadual}}': client.stateRegistration || '',
    '{{inscricao_municipal}}': client.municipalRegistration || '',
    '{{empresa_contratada}}': layoutSettings?.companyName || '',
    '{{website_contratada}}': layoutSettings?.website || '',
    '{{email_contratada}}': layoutSettings?.email || '',
    '{{proposta_id}}': budget.proposalId || '',
    '{{nome_projeto}}': budget.projectName || '',
    '{{descricao_projeto}}': budget.projectDescription || '',
    '{{valor_total}}': budget.finalValue ? formatCurrency(budget.finalValue) : formatCurrency(version.fullPrice),
    '{{condicoes_pagamento}}': budget.paymentTerms || '',
    '{{datas_execucao}}': buildExecutionDates(budget),
    '{{data_aprovacao}}': formatDate(budget.approvalDate),
    '{{servicos}}': buildServicesList(version),
  };

  for (const [key, value] of Object.entries(replacements)) {
    text = text.split(key).join(value);
  }

  const blocks = buildContractBlocks(text);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const __th = resolveTheme(layoutSettings?.brandTheme);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 6;
  const normalSize = 11;
  const headerY = 15;
  const contentStartY = 28;
  const footerTopY = pageHeight - 28;
  const lightGray = __th.accent;

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
      const footerLogoHeight = 6;
      const footerAspect = footerLogoData.width / footerLogoData.height;
      const footerLogoWidth = footerLogoHeight * footerAspect;
      doc.addImage(footerLogoData.base64, 'PNG', pageWidth / 2 - footerLogoWidth / 2, pageHeight - 20, footerLogoWidth, footerLogoHeight);
    }

    doc.setFontSize(7);
    doc.setFont(__th.font, 'normal');
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);

    const footerParts: string[] = [];
    if (layoutSettings?.companyName) footerParts.push(layoutSettings.companyName.toUpperCase());
    if (layoutSettings?.website) footerParts.push(layoutSettings.website);
    if (layoutSettings?.email) footerParts.push(layoutSettings.email);

    const footerText = footerParts.join(' • ');
    if (footerText) {
      doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  };

  let y = contentStartY;
  let currentFont: 'normal' | 'bold' = 'normal';
  let currentPageHasBodyContent = false;

  const applyBodyStyle = () => {
    doc.setFont(__th.font, currentFont);
    doc.setFontSize(normalSize);
    doc.setTextColor(0, 0, 0);
  };

  const startPage = (createNewPage = false) => {
    if (createNewPage) {
      doc.addPage();
    }
    y = contentStartY;
    currentPageHasBodyContent = false;
    addHeader();
    applyBodyStyle();
  };

  const closePage = () => {
    addFooter();
  };

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > footerTopY) {
      closePage();
      startPage(true);
    }
  };

  startPage();

  for (const block of blocks) {
    if (block.type === 'spacer') {
      ensureSpace(lineHeight);
      y += lineHeight;
      continue;
    }

    if (block.type === 'title') {
      currentFont = 'bold';
      applyBodyStyle();

      const titleLines = doc.splitTextToSize(block.text, contentWidth) as string[];
      for (const titleLine of titleLines) {
        ensureSpace(lineHeight);
        applyBodyStyle();
        doc.text(titleLine, margin, y);
        y += lineHeight;
        currentPageHasBodyContent = true;
      }
      continue;
    }

    currentFont = 'normal';
    applyBodyStyle();

    const paragraphLines = doc.splitTextToSize(block.text, contentWidth) as string[];
    for (let i = 0; i < paragraphLines.length; i++) {
      ensureSpace(lineHeight);
      applyBodyStyle();

      const isLastLine = i === paragraphLines.length - 1;
      if (isLastLine) {
        doc.text(paragraphLines[i], margin, y);
      } else {
        drawJustifiedLine(doc, paragraphLines[i], margin, y, contentWidth);
      }

      y += lineHeight;
      currentPageHasBodyContent = true;
    }
  }

  if (currentPageHasBodyContent) {
    closePage();
    doc.addPage();
  }

  await generateProposalPDF({
    budget,
    version,
    client,
    responsibleUser: responsibleUser || null,
    layoutSettings,
    existingDoc: doc,
    skipSave: true,
  });

  const safeProjectName = budget.projectName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const fileName = `Contrato_Proposta_${budget.proposalId}_${safeProjectName}.pdf`;
  await saveWithCustomPages(doc, layoutSettings, fileName);
}
