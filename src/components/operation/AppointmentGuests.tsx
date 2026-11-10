import { useEffect, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeFunction } from '@/lib/edgeFunctions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Member {
  id: string;
  name: string;
}

interface Props {
  /** Team members taking part (they see it in their own calendar) */
  participants: string[];
  onParticipantsChange: (ids: string[]) => void;
  guestEmails: string[];
  onGuestEmailsChange: (emails: string[]) => void;
  /** Who created the appointment; their Google calendar sends the invitations */
  organizerId: string | null;
}

/** Team participants and e-mail guests of an appointment. */
export function AppointmentGuests({ participants, onParticipantsChange, guestEmails, onGuestEmailsChange, organizerId }: Props) {
  const { workspace, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const isOrganizer = !organizerId || organizerId === user?.id;

  useEffect(() => {
    if (!workspace?.id) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase.from('workspace_members').select('user_id').eq('workspace_id', workspace.id);
      const ids = (rows || []).map((r: { user_id: string }) => r.user_id);
      if (!ids.length) return;
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids);
      if (cancelled) return;
      setMembers(
        (profiles || [])
          .filter((p: Member) => p.name)
          .sort((a: Member, b: Member) => a.name.localeCompare(b.name, 'pt-BR')),
      );
    })();
    return () => { cancelled = true; };
  }, [workspace?.id]);

  useEffect(() => {
    if (!isOrganizer || !guestEmails.length || googleConnected !== null) return;
    invokeFunction<{ connected: boolean }>('google-calendar-status').then(({ data }) => setGoogleConnected(!!data?.connected));
  }, [isOrganizer, guestEmails.length, googleConnected]);

  const organizer = organizerId ?? user?.id;
  const available = members.filter((m) => m.id !== organizer && !participants.includes(m.id));
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? 'Membro';

  const addEmail = () => {
    const value = email.trim().toLowerCase().replace(/[,;]$/, '');
    if (!value) return;
    if (!EMAIL.test(value)) { setEmailError('E-mail inválido'); return; }
    if (!guestEmails.includes(value)) onGuestEmailsChange([...guestEmails, value]);
    setEmail('');
    setEmailError('');
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1.5">
        <Label>Pessoas da equipe</Label>
        {participants.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {participants.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                {nameOf(id)}
                <button type="button" aria-label={`Remover ${nameOf(id)}`} onClick={() => onParticipantsChange(participants.filter((p) => p !== id))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {available.length > 0 && (
          <Select value="" onValueChange={(id) => onParticipantsChange([...participants, id])}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Adicionar pessoa da equipe" /></SelectTrigger>
            <SelectContent>
              {available.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <p className="text-[11px] text-muted-foreground">Aparece no calendário de cada um e no Google de quem estiver conectado.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="appt-guest-email">Convidar por e-mail</Label>
        <div className="flex gap-2">
          <Input
            id="appt-guest-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); } }}
            placeholder="nome@empresa.com"
          />
          <Button type="button" variant="outline" onClick={addEmail}>Adicionar</Button>
        </div>
        {emailError && <p className="text-[11px] text-destructive">{emailError}</p>}
        {guestEmails.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {guestEmails.map((g) => (
              <span key={g} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                <Mail className="w-3 h-3" />{g}
                <button type="button" aria-label={`Remover ${g}`} onClick={() => onGuestEmailsChange(guestEmails.filter((x) => x !== g))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <p className={`text-[11px] ${guestEmails.length && isOrganizer && googleConnected === false ? 'text-amber-600' : 'text-muted-foreground'}`}>
          {!isOrganizer
            ? 'Os convites saem pelo Google Agenda de quem criou o compromisso.'
            : guestEmails.length && googleConnected === false
              ? 'Conecte o Google Agenda em Meu perfil para os convites serem enviados. Sem isso, os e-mails ficam só anotados.'
              : 'O Google envia o convite pelo seu Google Agenda, e a pessoa pode aceitar ou recusar.'}
        </p>
      </div>
    </div>
  );
}
