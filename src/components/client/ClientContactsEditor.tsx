import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ContactDraft {
  id?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface Props {
  value: ContactDraft[];
  onChange: (v: ContactDraft[]) => void;
}

/** Editor for the additional (non-primary) responsibles of a company. */
export function ClientContactsEditor({ value, onChange }: Props) {
  const set = (i: number, patch: Partial<ContactDraft>) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <Label>Outros responsáveis</Label>
        <Button type="button" variant="outline" size="sm"
          onClick={() => onChange([...value, { name: '', role: '', email: '', phone: '' }])}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar responsável
        </Button>
      </div>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Cadastre aqui outras pessoas da empresa para quem você envia propostas.
        </p>
      )}
      {value.map((c, i) => (
        <div key={c.id || i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 p-3 rounded-lg border bg-muted/30">
          <Input placeholder="Nome *" value={c.name} onChange={(e) => set(i, { name: e.target.value })} />
          <Input placeholder="Cargo" value={c.role} onChange={(e) => set(i, { role: e.target.value })} />
          <Input placeholder="E-mail" type="email" value={c.email} onChange={(e) => set(i, { email: e.target.value })} />
          <Input placeholder="Telefone / WhatsApp" value={c.phone} onChange={(e) => set(i, { phone: e.target.value })} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remover responsável"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Persists the drafts for a client: inserts new, updates existing, deletes removed. */
export async function saveContactDrafts(
  workspaceId: string, clientId: string, drafts: ContactDraft[], existingIds: string[],
) {
  const { addClientContact, updateClientContact, deleteClientContact } = await import('@/hooks/useClientContacts');
  const valid = drafts.filter((d) => d.name.trim());
  const keep = new Set(valid.filter((d) => d.id).map((d) => d.id!));
  for (const id of existingIds) if (!keep.has(id)) await deleteClientContact(id);
  let order = 1;
  for (const d of valid) {
    const payload = { name: d.name.trim(), role: d.role.trim(), email: d.email.trim(), phone: d.phone.replace(/\D/g, ''), order: order++ };
    if (d.id) await updateClientContact(d.id, payload);
    else await addClientContact(workspaceId, clientId, payload);
  }
}
