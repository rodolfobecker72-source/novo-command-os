import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Liberação individual da página "Meu Financeiro" por membro do time.
 * Cada membro tem um registro em team_finance_access (enabled true/false).
 */
export function useTeamFinanceEnabled() {
  const { workspace, user } = useAuth();
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('team_finance_access' as any)
      .select('user_id, enabled')
      .eq('workspace_id', workspace.id);
    const map: Record<string, boolean> = {};
    (data || []).forEach((r: any) => {
      map[r.user_id] = Boolean(r.enabled);
    });
    setAccessMap(map);
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  const setMemberEnabled = useCallback(
    async (userId: string, value: boolean) => {
      if (!workspace) return false;
      const { error } = await supabase.from('team_finance_access' as any).upsert(
        { workspace_id: workspace.id, user_id: userId, enabled: value } as any,
        { onConflict: 'workspace_id,user_id' },
      );
      if (error) return false;
      setAccessMap((prev) => ({ ...prev, [userId]: value }));
      return true;
    },
    [workspace],
  );

  const enabled = user ? Boolean(accessMap[user.id]) : false;

  return {
    enabled,
    accessMap,
    loading,
    setMemberEnabled,
    isEnabledFor: (userId: string) => Boolean(accessMap[userId]),
    reload: load,
  };
}
