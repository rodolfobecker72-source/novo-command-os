import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
const signOut = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, auth: { signOut: () => signOut() } },
}));

import { invokeFunction } from '@/lib/edgeFunctions';

const httpError = (status: number, body: unknown) => ({
  message: 'Edge Function returned a non-2xx status code',
  context: new Response(JSON.stringify(body), { status }),
});

describe('invokeFunction', () => {
  beforeEach(() => { invoke.mockReset(); signOut.mockReset(); });

  it('returns data on success', async () => {
    invoke.mockResolvedValue({ data: { members: [] }, error: null });
    expect(await invokeFunction('list-workspace-members')).toEqual({ data: { members: [] }, error: null });
  });

  it('translates the error sent by the function', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'Only owners can access this' }) });
    const res = await invokeFunction('list-workspace-members');
    expect(res.error?.message).toBe('Apenas o Dono da conta pode fazer isso.');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out when the session is gone', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(401, { error: 'Not authenticated' }) });
    const res = await invokeFunction('list-workspace-members');
    expect(res.error?.message).toBe('Sua sessão expirou. Entre novamente.');
    expect(signOut).toHaveBeenCalled();
  });
});
