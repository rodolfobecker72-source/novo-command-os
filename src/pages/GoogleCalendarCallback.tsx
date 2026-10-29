// Google sends the user back here (usually inside the connect popup) with
// `code` and `state`; the backend finishes the connection.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, X } from 'lucide-react';
import { GCAL_CHANNEL } from '@/lib/googleCalendarChannel';
import { invokeFunction } from '@/lib/edgeFunctions';

export default function GoogleCalendarCallback() {
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [errorMsg, setErrorMsg] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice in development; the code is single-use
    if (started.current) return;
    started.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const oauthState = params.get('state');
      if (params.get('error') || !code || !oauthState) {
        setErrorMsg(params.get('error') === 'access_denied'
          ? 'Você cancelou a autorização no Google.'
          : 'Autorização não concluída no Google.');
        setState('error');
        return;
      }
      const { error } = await invokeFunction('google-calendar-complete', { body: { code, state: oauthState } });
      if (error) {
        setErrorMsg(error.message);
        setState('error');
        return;
      }
      setState('done');
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel(GCAL_CHANNEL);
        channel.postMessage('connected');
        channel.close();
      }
      if (window.opener) setTimeout(() => window.close(), 1500);
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
            <h1 className="text-lg font-semibold">Google Agenda conectado</h1>
            <p className="text-sm text-muted-foreground">
              Seus eventos aparecem na agenda "Command OS" em até 1 minuto.
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
        {state !== 'working' && !window.opener && (
          <Link to="/boas-vindas" className="inline-block text-sm text-accent hover:underline">
            Voltar ao Command OS
          </Link>
        )}
      </div>
    </div>
  );
}
