import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  order: number;
}

const map = (r: any): ClientContact => ({
  id: r.id, clientId: r.client_id, name: r.name, role: r.role, email: r.email,
  phone: r.phone, isPrimary: r.is_primary, order: r.order,
});

export function useClientContacts(clientId: string | null | undefined) {
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!clientId) { setContacts([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('client_contacts').select('*').eq('client_id', clientId)
      .order('is_primary', { ascending: false }).order('order').order('created_at');
    if (error) console.error('[contacts]', error.message);
    setContacts((data || []).map(map));
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  return { contacts, loading, reload };
}

export async function addClientContact(workspaceId: string, clientId: string, c: Partial<ClientContact>) {
  const { data, error } = await supabase.from('client_contacts').insert({
    workspace_id: workspaceId, client_id: clientId, name: c.name || '', role: c.role || '',
    email: c.email || '', phone: c.phone || '', is_primary: !!c.isPrimary, order: c.order ?? 0,
  }).select().single();
  if (error) throw error;
  return map(data);
}

export async function updateClientContact(id: string, c: Partial<ClientContact>) {
  const u: any = {};
  if (c.name !== undefined) u.name = c.name;
  if (c.role !== undefined) u.role = c.role;
  if (c.email !== undefined) u.email = c.email;
  if (c.phone !== undefined) u.phone = c.phone;
  const { error } = await supabase.from('client_contacts').update(u).eq('id', id);
  if (error) throw error;
}

export async function deleteClientContact(id: string) {
  const { error } = await supabase.from('client_contacts').delete().eq('id', id);
  if (error) throw error;
}

/** Keeps the primary contact in sync with the company's main responsible fields. */
export async function syncPrimaryContact(workspaceId: string, clientId: string, name: string, email: string, phone: string) {
  const { data } = await supabase.from('client_contacts').select('id')
    .eq('client_id', clientId).eq('is_primary', true).limit(1).maybeSingle();
  if (data?.id) await updateClientContact(data.id, { name, email, phone });
  else await addClientContact(workspaceId, clientId, { name, email, phone, isPrimary: true });
}
