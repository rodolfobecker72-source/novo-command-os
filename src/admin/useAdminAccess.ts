import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AdminAccess =
  | { state: 'loading' }
  | { state: 'signed_out' }
  | { state: 'not_admin' }
  | { state: 'needs_mfa'; session: Session }
  | { state: 'ready'; session: Session };

/**
 * Where the current visitor stands with the admin area: the account must be
 * listed in system_admins and the session must have passed 2-step
 * verification (aal2). The backend checks the same two things.
 */
export function useAdminAccess() {
  const [access, setAccess] = useState<AdminAccess>({ state: 'loading' });

  const check = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return setAccess({ state: 'signed_out' });

    const { data: admin } = await supabase
      .from('system_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!admin) return setAccess({ state: 'not_admin' });

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAccess(aal?.currentLevel === 'aal2' ? { state: 'ready', session } : { state: 'needs_mfa', session });
  }, []);

  useEffect(() => {
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Run outside the auth callback (supabase-js holds a lock while it runs)
      if (event !== 'TOKEN_REFRESHED') setTimeout(check, 0);
    });
    return () => subscription.unsubscribe();
  }, [check]);

  return { access, recheck: check };
}
