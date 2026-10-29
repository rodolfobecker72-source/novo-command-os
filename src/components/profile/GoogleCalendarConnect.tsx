import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Calendar, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { invokeFunction } from '@/lib/edgeFunctions';
import { GCAL_CHANNEL } from '@/lib/googleCalendarChannel';

interface Status {
  available: boolean;
  connected: boolean;
  needsReconnect: boolean;
  email: string | null;
}

export function GoogleCalendarConnect() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await invokeFunction<Status>('google-calendar-status');
    setStatus(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(GCAL_CHANNEL) : null;
    if (channel) {
      channel.onmessage = () => {
        load();
        setBusy(false);
        toast({ title: 'Google Agenda conectado', description: 'Seus eventos aparecem na agenda "Command OS" em até 1 minuto.' });
      };
    }
    return () => {
      window.removeEventListener('focus', onFocus);
      channel?.close();
    };
  }, [load, toast]);

  const handleConnect = async () => {
    // Opened before the request so the browser does not treat it as a pop-up ad
    const popup = window.open('', 'google-calendar-connect', 'width=520,height=680');
    setBusy(true);
    const { data, error } = await invokeFunction<{ url: string }>('google-calendar-connect-init');
    if (error || !data?.url) {
      popup?.close();
      setBusy(false);
      toast({ title: 'Erro ao iniciar conexão', description: error?.message, variant: 'destructive' });
      return;
    }
    if (popup) {
      popup.location.href = data.url;
      // Popup closed without finishing: release the button
      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          setBusy(false);
          load();
        }
      }, 1000);
    } else {
      window.location.href = data.url;
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o Google Agenda? A agenda "Command OS" e os eventos dela serão removidos da sua conta Google.')) return;
    setBusy(true);
    const { error } = await invokeFunction('google-calendar-disconnect');
    setBusy(false);
    if (error) {
      toast({ title: 'Erro ao desconectar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Google Agenda desconectado' });
    load();
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        <h3 className="font-medium text-sm">Google Agenda</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Suas atividades de projeto e compromissos aparecem numa agenda "Command OS" na sua conta Google.
        O sistema só acessa essa agenda, nunca os seus outros eventos.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Carregando…
        </div>
      ) : !status?.available ? (
        <p className="text-xs text-muted-foreground">A integração com o Google Agenda ainda não está disponível.</p>
      ) : status.connected ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Check className="w-4 h-4 text-success" />
            <span className="font-medium">{status.email || 'Conectado'}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={busy}>
            {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {status.needsReconnect && (
            <div className="flex items-start gap-2 text-xs text-warning">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>O acesso{status.email ? ` de ${status.email}` : ''} expirou ou foi removido no Google. Conecte de novo para voltar a sincronizar.</span>
            </div>
          )}
          <Button size="sm" onClick={handleConnect} disabled={busy}>
            {busy && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
            {status.needsReconnect ? 'Conectar de novo' : 'Conectar Google Agenda'}
          </Button>
        </div>
      )}
    </div>
  );
}
