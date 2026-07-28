export type LeadTemperature = 'frio' | 'morno' | 'quente';
export type LeadPriority = 'alta' | 'media' | 'baixa';
export type AcquisitionType = 'outbound' | 'inbound';

export type LeadOriginType =
  | 'prospeccao_ativa'
  | 'organico'
  | 'indicacao'
  | 'instagram'
  | 'meta_ads'
  | 'google_ads'
  | 'evento'
  | 'networking'
  | 'site'
  | 'outro';

export type LeadSegment =
  | 'construcao_imobiliario'
  | 'industria'
  | 'agronegocio'
  | 'saude'
  | 'educacao'
  | 'tecnologia'
  | 'financeiro'
  | 'varejo'
  | 'gastronomia'
  | 'turismo_hotelaria'
  | 'energia'
  | 'eventos'
  | 'servicos'
  | 'setor_publico'
  | 'terceiro_setor';

export type LeadFunnelStatus =
  | 'mapeado'
  | 'contato_realizado'
  | 'reuniao_agendada'
  | 'qualificado_crm'
  | 'perdido'
  | 'nutricao';

export interface ProspectionLead {
  id: string;
  // Basic info
  companyName: string;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  city: string;
  // Classification
  origin: LeadOriginType;
  segment: LeadSegment;
  acquisitionType: AcquisitionType;
  estimatedPotential: number;
  temperature: LeadTemperature;
  funnelStatus: LeadFunnelStatus;
  // Responsible
  prospectionResponsible: string;
  closingResponsible: string;
  // Follow-up
  lastContactDate: string;
  nextAction: string;
  nextActionDate: string;
  priority: LeadPriority;
  // Responsible user (workspace member)
  responsibleUserId?: string | null;
  temperatureManual?: boolean;
  meetingScheduledAt?: string | null;
  meetingHappened?: boolean | null;
  // Notes
  strategicNotes: string;
  // Meta
  createdAt: string;
  updatedAt: string;
}

export const LEAD_ORIGIN_LABELS: Record<LeadOriginType, string> = {
  prospeccao_ativa: 'Prospecção Ativa',
  organico: 'Orgânico',
  indicacao: 'Indicação',
  instagram: 'Instagram',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  evento: 'Evento',
  networking: 'Networking',
  site: 'Site',
  outro: 'Outro',
};

export const LEAD_SEGMENT_LABELS: Record<LeadSegment, string> = {
  agronegocio: 'Agronegócio',
  construcao_imobiliario: 'Construção e Imobiliário',
  educacao: 'Educação',
  energia: 'Energia',
  eventos: 'Eventos',
  financeiro: 'Financeiro',
  gastronomia: 'Gastronomia',
  industria: 'Indústria',
  saude: 'Saúde',
  servicos: 'Serviços',
  setor_publico: 'Setor Público',
  tecnologia: 'Tecnologia',
  terceiro_setor: 'Terceiro Setor',
  turismo_hotelaria: 'Turismo e Hotelaria',
  varejo: 'Varejo',
};

export const LEAD_TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  frio: 'Frio',
  morno: 'Morno',
  quente: 'Quente',
};

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const LEAD_FUNNEL_STATUS_LABELS: Record<LeadFunnelStatus, string> = {
  mapeado: 'Mapeado',
  contato_realizado: 'Contato Realizado',
  reuniao_agendada: 'Reunião Agendada',
  qualificado_crm: 'Qualificado para CRM',
  perdido: 'Perdido',
  nutricao: 'Nutrição',
};

export const FUNNEL_STATUS_ORDER: LeadFunnelStatus[] = [
  'mapeado',
  'contato_realizado',
  'reuniao_agendada',
  'qualificado_crm',
  'nutricao',
];

export const ACQUISITION_TYPE_LABELS: Record<AcquisitionType, string> = {
  outbound: 'Outbound',
  inbound: 'Inbound',
};
