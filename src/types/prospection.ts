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

/** Status do funil é dinâmico por workspace (tabela lead_statuses). */
export type LeadFunnelStatus = string;

/** Papéis especiais que disparam comportamentos automáticos. */
export type LeadStatusRole = 'meeting' | 'qualified';

export interface LeadStatus {
  id: string;
  key: string;
  label: string;
  color: string;
  order: number;
  role: LeadStatusRole | null;
  isDefault: boolean;
}

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
  responsibleUserId2?: string | null;
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

/** Rótulos de fallback dos status padrão (usados antes do carregamento e para seed). */
export const LEAD_FUNNEL_STATUS_LABELS: Record<string, string> = {
  mapeado: 'Mapeado',
  contato_realizado: 'Contato Realizado',
  reuniao_agendada: 'Reunião Agendada',
  qualificado_crm: 'Qualificado para CRM',
  nutricao: 'Nutrição',
};

export const FUNNEL_STATUS_ORDER: LeadFunnelStatus[] = [
  'mapeado',
  'contato_realizado',
  'reuniao_agendada',
  'qualificado_crm',
  'nutricao',
];

/** Status padrão criados automaticamente em um workspace novo. */
export const DEFAULT_LEAD_STATUSES: Omit<LeadStatus, 'id'>[] = [
  { key: 'mapeado', label: 'Mapeado', color: 'slate', order: 0, role: null, isDefault: true },
  { key: 'contato_realizado', label: 'Contato Realizado', color: 'blue', order: 1, role: null, isDefault: true },
  { key: 'reuniao_agendada', label: 'Reunião Agendada', color: 'amber', order: 2, role: 'meeting', isDefault: true },
  { key: 'qualificado_crm', label: 'Qualificado para CRM', color: 'green', order: 3, role: 'qualified', isDefault: true },
  { key: 'nutricao', label: 'Nutrição', color: 'violet', order: 4, role: null, isDefault: true },
];

export const LEAD_STATUS_COLORS: { key: string; label: string; badge: string; hex: string; dot: string }[] = [
  { key: 'slate', label: 'Cinza', badge: 'bg-muted text-muted-foreground border-border', hex: '#94a3b8', dot: 'bg-slate-400' },
  { key: 'blue', label: 'Azul', badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20', hex: '#3b82f6', dot: 'bg-blue-500' },
  { key: 'amber', label: 'Âmbar', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/20', hex: '#f59e0b', dot: 'bg-amber-500' },
  { key: 'green', label: 'Verde', badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25', hex: '#10b981', dot: 'bg-emerald-500' },
  { key: 'violet', label: 'Roxo', badge: 'bg-violet-500/10 text-violet-600 border-violet-500/20', hex: '#8b5cf6', dot: 'bg-violet-500' },
  { key: 'pink', label: 'Rosa', badge: 'bg-pink-500/10 text-pink-600 border-pink-500/20', hex: '#ec4899', dot: 'bg-pink-500' },
  { key: 'red', label: 'Vermelho', badge: 'bg-red-500/10 text-red-600 border-red-500/20', hex: '#ef4444', dot: 'bg-red-500' },
  { key: 'teal', label: 'Turquesa', badge: 'bg-teal-500/10 text-teal-600 border-teal-500/20', hex: '#14b8a6', dot: 'bg-teal-500' },
];

export function getStatusColor(color: string) {
  return LEAD_STATUS_COLORS.find(c => c.key === color) || LEAD_STATUS_COLORS[0];
}

export const LEAD_STATUS_ROLE_LABELS: Record<LeadStatusRole, string> = {
  meeting: 'Reunião agendada',
  qualified: 'Qualificado para CRM',
};

export const ACQUISITION_TYPE_LABELS: Record<AcquisitionType, string> = {
  outbound: 'Outbound',
  inbound: 'Inbound',
};
