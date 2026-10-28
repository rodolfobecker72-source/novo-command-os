import type jsPDF from 'jspdf';
import type { Budget, BudgetVersion, Client } from '@/types/crm';
import { generateProposalPDF, type PDFLayoutSettings } from './pdfGenerator';

/**
 * Proposal with fictitious data, used by "Baixar PDF de exemplo" in
 * Layout da Proposta so the owner can check colors and texts without
 * opening a real budget.
 */
const SAMPLE_BUDGET = {
  proposalId: '0001',
  projectName: 'Cobertura de Evento',
  projectDescription: [
    'O projeto contempla a cobertura fotográfica do evento de fim de ano, com o objetivo de registrar os principais momentos, a interação entre os participantes e as atividades realizadas. A produção será feita por uma equipe de dois fotógrafos, com entrega dos arquivos digitais em alta resolução.',
    '',
    'Observações Importantes:',
    '- A cobertura será realizada por dois profissionais.',
    '- O período de captação será das 19h às 22h.',
    '- As imagens passarão por seleção, edição e tratamento.',
    '',
    'Responsabilidades do Cliente:',
    '- Disponibilizar as informações necessárias para o planejamento.',
    '- Informar previamente a programação do evento.',
    '- Garantir o acesso da equipe aos ambientes.',
  ].join('\n'),
  location: 'São Paulo, SP',
  hasExecutionDate: true,
  executionStartDate: new Date(),
  executionEndDate: null,
  paymentTerms: '10 dias após o serviço e emissão da NF',
  hideNfInPdf: false,
  hideOperationalInPdf: false,
  hideNfObservationInPdf: false,
} as unknown as Budget;

const SAMPLE_VERSION = {
  version: 1,
  nfCostPercentage: 13,
  margin: 0,
  operationalCosts: [],
  services: [
    {
      serviceType: 'foto',
      objective: 'Cobertura de Evento',
      deliveryType: 'dias_uteis',
      deliveryDays: 2,
      description: [
        'Realizar o registro fotográfico do evento, documentando os principais momentos, a participação dos convidados e os acontecimentos relevantes da programação.',
        '',
        'Captação',
        '- Equipe composta por 2 fotógrafos.',
        '- Cobertura presencial durante 3 horas.',
        '',
        'Especificações',
        '- Captação de fotografias em alta resolução.',
        '- Seleção, edição e tratamento das imagens.',
        '',
        'Entregas',
        '- Fotografias digitais em alta resolução.',
        '- Entrega digital em até 2 dias úteis.',
      ].join('\n'),
      costs: [{ description: '2 fotógrafos', value: 1305 }],
    },
  ],
} as unknown as BudgetVersion;

const SAMPLE_CLIENT = {
  companyName: 'Empresa Exemplo',
  responsiblePerson: 'Maria Silva',
} as unknown as Client;

export function generateSampleProposalPDF(layoutSettings: PDFLayoutSettings, responsibleName?: string): Promise<jsPDF> {
  return generateProposalPDF({
    budget: SAMPLE_BUDGET,
    version: SAMPLE_VERSION,
    client: SAMPLE_CLIENT,
    responsibleUser: responsibleName ? { id: 'sample', name: responsibleName, photo: '' } : null,
    layoutSettings,
    categoryLabels: { foto: 'Foto' },
    skipSave: true,
  });
}
