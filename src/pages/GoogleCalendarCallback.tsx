// Landing page after the gateway completes Google OAuth for the popup.
// Extracts the code from the URL and posts it to `google-calendar-complete`
// so the backend can exchange it for the per-user connection_key.
import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function GoogleCalendarCallback() {
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const success = params.get('success');
      if (!code || success === 'false') {
        setErrorMsg('Autorização não concluída no Google.');
        setState('error');
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke('google-calendar-complete', {
          body: { code },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setState('done');
        setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 1500);
      } catch (e: any) {
        setErrorMsg(e?.message ?? String(e));
        setState('error');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-3 max-w-sm">
        {state === 'working' && (
          <>
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <h1 className="text-lg font-semibold">Finalizando conexão…</h1>
          </>
        )}
        {state === 'done' && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-success" />
            </div>
            <h1 className="text-lg font-semibold">Google Calendar conectado</h1>
            <p className="text-sm text-muted-foreground">
              Você já pode fechar esta janela e voltar para o Command OS.
            </p>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold">Não foi possível concluir</h1>
            <p className="text-sm text-muted-foreground break-words">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
