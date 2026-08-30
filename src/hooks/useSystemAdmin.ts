import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSystemAdmin() {
  const { user } = useAuth();
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) {
        if (!cancelled) { setIsSystemAdmin(false); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('system_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setIsSystemAdmin(!!data);
        setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user]);

  return { isSystemAdmin, loading };
}
