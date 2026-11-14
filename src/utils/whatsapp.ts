// WhatsApp number of a user (profiles.whatsapp). Brazilian numbers only,
// stored in international format (+55 + DDD + number) so future integrations
// can use it as is. The same rule is a CHECK constraint in the database.
//
// Accepted: a mobile (9 digits starting with 9) or a landline (8 digits
// starting with 2–5, used by WhatsApp Business), after a valid DDD (no zero).

const STORED = /^\+55[1-9]{2}(9\d{8}|[2-5]\d{7})$/;

/** ok: value is the number to store (null clears it); otherwise error says what is wrong. */
export interface WhatsappResult {
  ok: boolean;
  value: string | null;
  error: string | null;
}

const invalid = (error: string): WhatsappResult => ({ ok: false, value: null, error });

/** Turns what the user typed into the stored format; empty clears the number. */
export function normalizeWhatsapp(input: string): WhatsappResult {
  let digits = input.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return { ok: true, value: null, error: null };
  // With the country code: 55 + DDD + 8 or 9 digits
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) {
    return invalid('Informe o DDD e o número, por exemplo (35) 99999-8888.');
  }
  const value = `+55${digits}`;
  if (!STORED.test(value)) {
    return invalid(digits.length === 11
      ? 'Número inválido: o celular deve começar com 9 e o DDD não pode ter 0.'
      : 'Número inválido: confira o DDD e o número.');
  }
  return { ok: true, value, error: null };
}

/** "+5535999998888" → "(35) 99999-8888"; anything else is returned as is. */
export function formatWhatsapp(stored: string | null | undefined): string {
  if (!stored) return '';
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(stored);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : stored;
}

/** Mask while typing: (35) 99999-8888 or (35) 3197-8804. A pasted number
 *  with country code (+55…) or a leading 0 keeps only DDD and number. */
export function maskWhatsappInput(value: string): string {
  let d = value.replace(/\D/g, '').replace(/^0+/, '');
  if (d.startsWith('55') && (value.trim().startsWith('+') || d.length > 11)) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const local = d.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return local.length <= split
    ? `(${d.slice(0, 2)}) ${local}`
    : `(${d.slice(0, 2)}) ${local.slice(0, split)}-${local.slice(split)}`;
}
