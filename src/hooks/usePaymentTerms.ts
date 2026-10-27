import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { activePaymentTerms, type OrderedPaymentTerm } from '@/utils/paymentTermOrder';

export function usePaymentTerms(workspaceId?: string) {
  const [terms, setTerms] = useState<OrderedPaymentTerm[]>([]);
  useEffect(() => {
    setTerms([]);
    if (!workspaceId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from('payment_terms').select('*')
        .eq('workspace_id', workspaceId).order('sort_order').order('created_at').order('id');
      if (cancelled || !data) return;
      setTerms(activePaymentTerms(data.map(row => ({
        id: row.id, name: row.name, description: row.description, active: row.active,
        sortOrder: row.sort_order, createdAt: row.created_at,
      }))));
    };
    void load();
    const channel = supabase.channel(`payment-term-options-${workspaceId}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_terms', filter: `workspace_id=eq.${workspaceId}` }, load)
      .subscribe();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
      void supabase.removeChannel(channel);
    };
  }, [workspaceId]);
  return terms;
}