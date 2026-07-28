import { LeadTemperature, LeadOriginType, LeadFunnelStatus, ProspectionLead } from '@/types/prospection';

export interface TemperatureBreakdown {
  label: string;
  points: number;
}

export interface TemperatureResult {
  temperature: LeadTemperature;
  score: number;
  breakdown: TemperatureBreakdown[];
}

const ORIGIN_POINTS: Record<LeadOriginType, { points: number; label: string }> = {
  indicacao: { points: 20, label: 'Indicação' },
  site: { points: 15, label: 'Site' },
  networking: { points: 15, label: 'Networking' },
  evento: { points: 12, label: 'Evento' },
  organico: { points: 10, label: 'Orgânico' },
  instagram: { points: 8, label: 'Instagram' },
  meta_ads: { points: 8, label: 'Meta Ads' },
  google_ads: { points: 8, label: 'Google Ads' },
  prospeccao_ativa: { points: 0, label: 'Prospecção Ativa' },
  outro: { points: 0, label: 'Outro' },
};

const FUNNEL_POINTS: Partial<Record<LeadFunnelStatus, { points: number; label: string }>> = {
  qualificado_crm: { points: 45, label: 'Qualificado CRM' },
  reuniao_agendada: { points: 35, label: 'Reunião agendada' },
  contato_realizado: { points: 18, label: 'Contato realizado' },
  mapeado: { points: 0, label: 'Mapeado' },
  nutricao: { points: -5, label: 'Nutrição' },
};

function daysBetween(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function lastContactPoints(lastContactDate: string): { points: number; label: string } {
  const days = daysBetween(lastContactDate);
  if (days === null) return { points: -10, label: 'Nunca contatado' };
  if (days <= 7) return { points: 20, label: `Contato há ${days}d` };
  if (days <= 14) return { points: 10, label: `Contato há ${days}d` };
  if (days <= 30) return { points: 0, label: `Contato há ${days}d` };
  if (days <= 60) return { points: -10, label: `Contato há ${days}d` };
  return { points: -20, label: `Contato há ${days}d` };
}

function nextActionPoints(nextActionDate: string): { points: number; label: string } {
  const days = daysBetween(nextActionDate);
  if (days === null) return { points: -5, label: 'Sem próxima ação' };
  // days > 0 means in the past (atrasada). days < 0 means in the future.
  if (days > 0) return { points: -15, label: `Ação atrasada (${days}d)` };
  const inDays = -days;
  if (inDays <= 7) return { points: 15, label: `Próxima ação em ${inDays}d` };
  if (inDays <= 30) return { points: 5, label: `Próxima ação em ${inDays}d` };
  return { points: 0, label: `Próxima ação em ${inDays}d` };
}

export function computeLeadTemperature(
  lead: Pick<ProspectionLead, 'origin' | 'funnelStatus' | 'lastContactDate' | 'nextActionDate'>
): TemperatureResult {
  const breakdown: TemperatureBreakdown[] = [];

  // Override: perdido = sempre frio
  if (lead.funnelStatus === 'perdido') {
    return {
      temperature: 'frio',
      score: 0,
      breakdown: [{ label: 'Lead perdido', points: 0 }],
    };
  }

  let score = 0;

  const origin = ORIGIN_POINTS[lead.origin] ?? { points: 0, label: String(lead.origin) };
  score += origin.points;
  breakdown.push({ label: `Origem: ${origin.label}`, points: origin.points });

  const funnel = FUNNEL_POINTS[lead.funnelStatus];
  if (funnel) {
    score += funnel.points;
    breakdown.push({ label: `Funil: ${funnel.label}`, points: funnel.points });
  }

  const last = lastContactPoints(lead.lastContactDate);
  score += last.points;
  breakdown.push({ label: last.label, points: last.points });

  const next = nextActionPoints(lead.nextActionDate);
  score += next.points;
  breakdown.push({ label: next.label, points: next.points });

  score = Math.max(0, Math.min(100, score));

  const temperature: LeadTemperature = score >= 70 ? 'quente' : score >= 40 ? 'morno' : 'frio';

  return { temperature, score, breakdown };
}
