/** Atendimento do Command OS no WhatsApp (DDI + DDD + número). */
export const SUPPORT_WHATSAPP = '553531978804';

export const CANCELLATION_REASONS = [
  { value: 'preco', label: 'O preço não cabe no momento' },
  { value: 'faltou_recurso', label: 'Faltou algum recurso' },
  { value: 'nao_usei', label: 'Não estou usando' },
  { value: 'outro_sistema', label: 'Vou usar outro sistema' },
  { value: 'outro', label: 'Outro motivo' },
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]['value'];

export const CANCELLATION_REASON_LABEL: Record<string, string> = Object.fromEntries(
  CANCELLATION_REASONS.map((r) => [r.value, r.label]),
);

export function supportWhatsAppUrl(text: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
}
