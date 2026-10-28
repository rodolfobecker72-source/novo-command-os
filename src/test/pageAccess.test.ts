import { describe, it, expect } from 'vitest';
import { canAccessPage } from '@/config/pages';

const member = (role: string | null, page_permissions: string[] = []) => ({ role, page_permissions });

describe('canAccessPage', () => {
  it('denies everything without membership', () => {
    expect(canAccessPage('boas-vindas', null)).toBe(false);
  });

  it('limits time_operacional to its pages', () => {
    expect(canAccessPage('gestao-projetos', member('time_operacional'))).toBe(true);
    expect(canAccessPage('crm', member('time_operacional'))).toBe(false);
    expect(canAccessPage('financeiro', member('time_operacional'))).toBe(false);
    expect(canAccessPage('usuarios', member('time_operacional'))).toBe(false);
  });

  it('treats an unknown role like the most restricted one', () => {
    expect(canAccessPage('crm', member('time_hero'))).toBe(false);
    expect(canAccessPage('usuarios', member('cargo_inexistente'))).toBe(false);
    expect(canAccessPage('gestao-projetos', member('time_hero'))).toBe(true);
  });

  it('keeps owner access and owner-only pages', () => {
    expect(canAccessPage('usuarios', member('owner'))).toBe(true);
    expect(canAccessPage('usuarios', member('admin'))).toBe(false);
  });

  it('respects explicit page permissions for vendedor', () => {
    expect(canAccessPage('crm', member('vendedor', ['crm']))).toBe(true);
    expect(canAccessPage('clientes', member('vendedor', ['crm']))).toBe(false);
  });
});
