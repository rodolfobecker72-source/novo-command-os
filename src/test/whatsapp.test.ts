import { describe, expect, it } from 'vitest';
import { formatWhatsapp, maskWhatsappInput, normalizeWhatsapp } from '@/utils/whatsapp';

describe('normalizeWhatsapp', () => {
  it('accepts a mobile with DDD in any common writing', () => {
    for (const input of ['(35) 99999-8888', '35999998888', '+55 35 99999-8888', '55 35 99999 8888', '035 99999-8888']) {
      expect(normalizeWhatsapp(input)).toMatchObject({ ok: true, value: '+5535999998888' });
    }
  });

  it('accepts a landline (WhatsApp Business)', () => {
    expect(normalizeWhatsapp('(35) 3197-8804')).toMatchObject({ ok: true, value: '+553531978804' });
  });

  it('treats DDD 55 without country code as a DDD', () => {
    expect(normalizeWhatsapp('(55) 99999-8888')).toMatchObject({ ok: true, value: '+5555999998888' });
  });

  it('clears the number when empty', () => {
    expect(normalizeWhatsapp('  ')).toMatchObject({ ok: true, value: null });
  });

  it('rejects incomplete or invalid numbers', () => {
    for (const input of ['99999-8888', '(35) 9999-888', '(30) 99999-8888', '(35) 89999-8888', '(35) 1197-8804', '123456789012345']) {
      expect(normalizeWhatsapp(input).ok).toBe(false);
    }
  });
});

describe('formatWhatsapp', () => {
  it('shows the stored number with mask', () => {
    expect(formatWhatsapp('+5535999998888')).toBe('(35) 99999-8888');
    expect(formatWhatsapp('+553531978804')).toBe('(35) 3197-8804');
    expect(formatWhatsapp(null)).toBe('');
  });
});

describe('maskWhatsappInput', () => {
  it('masks while typing', () => {
    expect(maskWhatsappInput('3')).toBe('(3');
    expect(maskWhatsappInput('35999')).toBe('(35) 999');
    expect(maskWhatsappInput('3531978804')).toBe('(35) 3197-8804');
    expect(maskWhatsappInput('35999998888')).toBe('(35) 99999-8888');
    expect(maskWhatsappInput('3599999888899')).toBe('(35) 99999-8888');
  });

  it('drops the country code and leading 0 of a pasted number', () => {
    expect(maskWhatsappInput('+55 35 99999-8888')).toBe('(35) 99999-8888');
    expect(maskWhatsappInput('5535999998888')).toBe('(35) 99999-8888');
    expect(maskWhatsappInput('035 3197-8804')).toBe('(35) 3197-8804');
    expect(maskWhatsappInput('55999998888')).toBe('(55) 99999-8888');
  });
});
