import { FormEvent, useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import type { AdminAccess } from './useAdminAccess';

function Shell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function CredentialsStep({ notice }: { notice?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError('E-mail ou senha incorretos.');
  };

  return (
    <Shell title="Administração do Command OS" description="Acesso restrito à equipe do Command OS.">
      <form onSubmit={submit} className="space-y-4">
        {notice && <p className="text-sm text-destructive text-center">{notice}</p>}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Entrar
        </Button>
      </form>
    </Shell>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="000000"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      className="text-center text-lg tracking-[0.4em]"
      autoFocus
    />
  );
}

/** First access: register an authenticator app, then confirm with a code. */
function EnrollStep({ onDone }: { onDone: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      // A half-finished earlier enrollment blocks a new one
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Command OS Admin' });
      if (err || !data) {
        setError('Não foi possível iniciar a configuração. Recarregue a página.');
        return;
      }
      setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!factor) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (err) setError('Código inválido. Confira o horário do celular e tente o código atual.');
    else onDone();
  };

  return (
    <Shell
      title="Ative a verificação em duas etapas"
      description="Escaneie o QR code com um app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…) e digite o código de 6 dígitos."
    >
      {!factor && !error && (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      )}
      {factor && (
        <form onSubmit={submit} className="space-y-4">
          <img src={factor.qr} alt="QR code para o app autenticador" className="mx-auto w-48 h-48 rounded-lg bg-white p-2" />
          <p className="text-xs text-muted-foreground text-center break-all">
            Sem câmera? Digite esta chave no app: <span className="font-mono text-foreground">{factor.secret}</span>
          </p>
          <CodeInput value={code} onChange={setCode} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </form>
      )}
      {!factor && error && <p className="text-sm text-destructive text-center">{error}</p>}
    </Shell>
  );
}

function VerifyStep({ factorId, onDone }: { factorId: string; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (err) setError('Código inválido. Use o código atual do app autenticador.');
    else onDone();
  };

  return (
    <Shell title="Verificação em duas etapas" description="Digite o código de 6 dígitos do seu app autenticador.">
      <form onSubmit={submit} className="space-y-4">
        <CodeInput value={code} onChange={setCode} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Verificar
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>
          Usar outra conta
        </Button>
      </form>
    </Shell>
  );
}

function MfaStep({ onDone }: { onDone: () => void }) {
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => setFactorId(data?.totp?.[0]?.id ?? null));
  }, []);

  if (factorId === undefined) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  return factorId ? <VerifyStep factorId={factorId} onDone={onDone} /> : <EnrollStep onDone={onDone} />;
}

export function AdminLogin({ access, onChange }: { access: AdminAccess; onChange: () => void }) {
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (access.state === 'not_admin') {
      setNotice('Esta conta não tem acesso à administração.');
      supabase.auth.signOut();
    }
  }, [access.state]);

  if (access.state === 'needs_mfa') return <MfaStep onDone={onChange} />;
  return <CredentialsStep notice={notice} />;
}
