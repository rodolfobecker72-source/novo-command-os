// What each role may do with the company's data. The database enforces the
// same rules (RLS); these helpers only keep the screens from offering actions
// that would be refused.

/** Proprietário e Administrador. */
export function isManagerRole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/** Quem trabalha com clientes, leads e orçamentos (vê valores). */
export function isCommercialRole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'vendedor';
}
