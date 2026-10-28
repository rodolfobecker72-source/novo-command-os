import { Budget, Client } from '@/types/crm';

// ============= CLIENT SCORE CALCULATOR =============
// Score baseado em 3 pilares:
// 1. Recorrência de projetos (positivo)
// 2. Margem real média (positivo)
// 3. Penalidade comercial por propostas não aprovadas (negativo)

export interface ScoreBreakdown {
  recurrencePoints: number;
  marginPoints: number;
  lostProposalsCount: number;
  commercialPenalty: number;
  finalScore: number;
  classification: 'A' | 'B' | 'C' | 'D';
  potentialBadge: 'alto_potencial' | 'neutro' | 'alto_custo_comercial';
}

// Calcula pontos de recorrência baseado em projetos aprovados
function calculateRecurrencePoints(approvedProjectsCount: number): number {
  // 0 projetos = 0 pts
  // 1 projeto = 15 pts
  // 2 projetos = 25 pts
  // 3 projetos = 35 pts
  // 4+ projetos = 50 pts (máximo)
  if (approvedProjectsCount === 0) return 0;
  if (approvedProjectsCount === 1) return 15;
  if (approvedProjectsCount === 2) return 25;
  if (approvedProjectsCount === 3) return 35;
  return 50;
}

// Calcula pontos de margem baseado na margem real média
function calculateMarginPoints(avgRealMargin: number): number {
  // Margem >= 50% = 50 pts
  // Margem >= 40% = 40 pts
  // Margem >= 30% = 30 pts
  // Margem >= 20% = 20 pts
  // Margem >= 10% = 10 pts
  // Margem < 10% = 5 pts
  if (avgRealMargin >= 50) return 50;
  if (avgRealMargin >= 40) return 40;
  if (avgRealMargin >= 30) return 30;
  if (avgRealMargin >= 20) return 20;
  if (avgRealMargin >= 10) return 10;
  return 5;
}

// Calcula penalidade comercial baseado em propostas perdidas
function calculateCommercialPenalty(lostProposalsCount: number): number {
  // 0 propostas = 0 pts
  // 1 proposta = -5 pts
  // 2 propostas = -10 pts
  // 3 propostas = -20 pts
  // 4+ propostas = -30 pts
  if (lostProposalsCount === 0) return 0;
  if (lostProposalsCount === 1) return 5;
  if (lostProposalsCount === 2) return 10;
  if (lostProposalsCount === 3) return 20;
  return 30;
}

// Determina classificação A/B/C/D
function getClassification(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

// Determina badge de potencial
function getPotentialBadge(
  recurrencePoints: number,
  marginPoints: number,
  lostProposalsCount: number
): 'alto_potencial' | 'neutro' | 'alto_custo_comercial' {
  // Alto custo comercial: muitas propostas perdidas (3+)
  if (lostProposalsCount >= 3) return 'alto_custo_comercial';
  
  // Alto potencial: boa recorrência ou boa margem
  if (recurrencePoints >= 25 || marginPoints >= 35) return 'alto_potencial';
  
  return 'neutro';
}

// Função principal para calcular o Client Score
export function calculateClientScore(
  clientId: string,
  budgets: Budget[]
): ScoreBreakdown {
  // Filtra projetos do cliente
  const clientBudgets = budgets.filter(b => b.clientId === clientId);
  
  // Projetos aprovados
  const approvedProjects = clientBudgets.filter(b => b.status === 'aprovada');
  
  // Projetos não aprovados (status = 'nao_aprovada')
  const lostProposals = clientBudgets.filter(b => b.status === 'nao_aprovada');
  
  // Calcula margem real média dos projetos aprovados com execução
  let avgRealMargin = 0;
  const projectsWithExecution = approvedProjects.filter(p => p.execution);
  if (projectsWithExecution.length > 0) {
    avgRealMargin = projectsWithExecution.reduce(
      (sum, p) => sum + (p.execution?.realMargin || 0),
      0
    ) / projectsWithExecution.length;
  }
  
  // Calcula pontos
  const recurrencePoints = calculateRecurrencePoints(approvedProjects.length);
  const marginPoints = projectsWithExecution.length > 0 
    ? calculateMarginPoints(avgRealMargin) 
    : 0;
  const lostProposalsCount = lostProposals.length;
  const commercialPenalty = calculateCommercialPenalty(lostProposalsCount);
  
  // Score final (mínimo 0, máximo 100)
  const rawScore = recurrencePoints + marginPoints - commercialPenalty;
  const finalScore = Math.max(0, Math.min(100, rawScore));
  
  // Classificação e badge
  const classification = getClassification(finalScore);
  const potentialBadge = getPotentialBadge(recurrencePoints, marginPoints, lostProposalsCount);
  
  return {
    recurrencePoints,
    marginPoints,
    lostProposalsCount,
    commercialPenalty,
    finalScore,
    classification,
    potentialBadge,
  };
}

// Labels para badges
export const POTENTIAL_BADGE_LABELS: Record<string, string> = {
  alto_potencial: 'Alto potencial',
  neutro: 'Neutro',
  alto_custo_comercial: 'Alto custo comercial',
};

export const POTENTIAL_BADGE_COLORS: Record<string, string> = {
  alto_potencial: 'bg-success/10 text-success border-success/20',
  neutro: 'bg-muted text-muted-foreground border-muted',
  alto_custo_comercial: 'bg-destructive/10 text-destructive border-destructive/20',
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  A: '🥇 Cliente A',
  B: '🥈 Cliente B',
  C: '🥉 Cliente C',
  D: '⚠️ Cliente D',
};
