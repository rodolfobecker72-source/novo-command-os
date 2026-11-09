/** Proposal PDF style options set in Layout da Proposta. */
export type ProposalStyle = 'classico' | 'moderno';
export type CoverStyle = 'cor' | 'foto' | 'clara';
export type CornerStyle = 'arredondado' | 'reto';

export interface NextStep {
  title: string;
  text: string;
}

export interface NextStepsSettings {
  enabled: boolean;
  title: string;
  steps: NextStep[];
}

export const MAX_NEXT_STEPS = 4;

export const DEFAULT_NEXT_STEPS: NextStepsSettings = {
  enabled: true,
  title: 'Próximos passos',
  steps: [
    { title: 'Aprovação', text: 'Você confirma a proposta por e-mail ou WhatsApp.' },
    { title: 'Contrato', text: 'Enviamos o contrato para assinatura.' },
    { title: 'Agendamento', text: 'Alinhamos a programação e reservamos a equipe.' },
  ],
};

/** Saved value (or null) as a complete settings object. */
export function normalizeNextSteps(value: unknown): NextStepsSettings {
  if (!value || typeof value !== 'object') return DEFAULT_NEXT_STEPS;
  const v = value as Partial<NextStepsSettings>;
  const steps = Array.isArray(v.steps)
    ? v.steps
        .filter((s): s is NextStep => !!s && typeof s === 'object')
        .map((s) => ({ title: String(s.title ?? '').trim(), text: String(s.text ?? '').trim() }))
        .filter((s) => s.title || s.text)
        .slice(0, MAX_NEXT_STEPS)
    : DEFAULT_NEXT_STEPS.steps;
  return {
    enabled: v.enabled !== false,
    title: typeof v.title === 'string' && v.title.trim() ? v.title.trim() : DEFAULT_NEXT_STEPS.title,
    steps,
  };
}

/** wa.me link for a Brazilian number typed in any format, or null if it doesn't look like one. */
export function whatsappLink(phone: string | null | undefined): string | null {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 13 ? `https://wa.me/${digits}` : null;
}
