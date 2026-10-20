import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useClientContacts, addClientContact } from '@/hooks/useClientContacts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  clientId: string;
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
}

/** Lets the user pick which responsible of the company the proposal is addressed to. */
export function ContactSelect({ clientId, value, onChange, label = 'Responsável pela proposta' }: Props) {
  const { workspace } = useAuth();
  const { contacts, reload } = useClientContacts(clientId);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', role: '', email: '', phone: '' });

  // Default to the primary contact when nothing is selected or selection belongs to another company
  useEffect(() => {
    if (contacts.length === 0) return;
    if (!value || !contacts.some((c) => c.id === value)) {
      onChange((contacts.find((c) => c.isPrimary) || contacts[0]).id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);

  const save = async () => {
    if (!draft.name.trim() || !workspace) return toast.error('Informe o nome do responsável');
    try {
      const c = await addClientContact(workspace.id, clientId, {
        ...draft, name: draft.name.trim(), phone: draft.phone.replace(/\D/g, ''), order: contacts.length,
      });
      await reload();
      onChange(c.id);
      setAdding(false);
      setDraft({ name: '', role: '', email: '', phone: '' });
      toast.success('Responsável adicionado');
    } catch (e: any) {
      toast.error('Erro ao adicionar: ' + e.message);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select value={value || ''} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
          <SelectContent className="z-[200]">
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name || '(sem nome)'}{c.role ? ` — ${c.role}` : ''}{c.isPrimary ? ' (principal)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="icon" aria-label="Novo responsável" onClick={() => setAdding((a) => !a)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {adding && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg border bg-muted/30">
          <Input placeholder="Nome *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="Cargo" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
          <Input placeholder="E-mail" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          <Input placeholder="Telefone / WhatsApp" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={save}>Salvar responsável</Button>
          </div>
        </div>
      )}
    </div>
  );
}
