import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Configuração por workspace: se o time pode acessar a página "Meu Financeiro".
 */
export function useTeamFinanceEnabled() {
  const { workspace } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('workspace_settings')
      .select('team_finance_enabled')
      .eq('workspace_id', workspace.id)
      .maybeSingle();
    setEnabled(Boolean((data as any)?.team_finance_enabled));
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async (value: boolean) => {
      if (!workspace) return false;
      const { data: existing } = await supabase
        .from('workspace_settings')
        .select('id')
        .eq('workspace_id', workspace.id)
        .maybeSingle();

      const { error } = existing
        ? await supabase
            .from('workspace_settings')
            .update({ team_finance_enabled: value } as any)
            .eq('id', (existing as any).id)
        : await supabase
            .from('workspace_settings')
            .insert({ workspace_id: workspace.id, team_finance_enabled: value } as any);

      if (error) return false;
      setEnabled(value);
      return true;
    },
    [workspace],
  );

  return { enabled, loading, update, reload: load };
}
