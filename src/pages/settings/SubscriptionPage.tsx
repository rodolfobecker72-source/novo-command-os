import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, Loader2, Lock, MessageCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/types/crm';
import { invokeFunction } from '@/lib/edgeFunctions';
import { daysUntil, Subscription, useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { CANCELLATION_REASONS, CancellationReason, supportWhatsAppUrl } from '@/config/cancellation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR') : '—');

function statusInfo(sub: Subscription): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; detail: string } {
  if (sub.access === 'read_only') {
    return { label: 'Somente leitura', variant: 'destructive', detail: 'Assine para voltar a criar e editar.' };
  }
  switch (sub.status) {
    case 'trialing':
      return sub.hasCard
        ? { label: 'Assinada', variant: 'default', detail: `A primeira cobrança acontece em ${fmtDate(sub.trialEndsAt)}, no fim do teste.` }
        : { label: 'Teste grátis', variant: 'secondary', detail: `Termina em ${fmtDate(sub.trialEndsAt)} (${daysUntil(sub.trialEndsAt)} dias).` };
    case 'active':
      return { label: 'Ativa', variant: 'default', detail: `Próxima cobrança em ${fmtDate(sub.currentPeriodEnd)}, no cartão cadastrado.` };
    case 'past_due':
      return { label: 'Pagamento pendente', variant: 'destructive', detail: `Regularize até ${fmtDate(sub.readOnlyAt)} para não passar a somente leitura.` };
    case 'canceled':
      return { label: 'Cancelada', variant: 'outline', detail: `Acesso completo até ${fmtDate(sub.readOnlyAt)}.` };
  }
}

export function SubscriptionPage() {
  const { data: sub, isLoading, refetch } = useSubscription();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState<CancellationReason | ''>('');
  const [note, setNote] = useState('');
  const { workspace } = useAuth();
  const whatsappUrl = supportWhatsAppUrl(
    `Olá! Quero cancelar a assinatura do Command OS${workspace?.name ? ` da empresa ${workspace.name}` : ''}.`,
  );

  // Back from Asaas: the confirmation arrives by webhook a few seconds later
  const returnedFromCheckout = params.get('retorno') === 'sucesso';
  useEffect(() => {
    if (!returnedFromCheckout) return;
    toast.success('Pagamento enviado. Estamos confirmando com o Asaas.');
    const timer = window.setInterval(() => refetch(), 4000);
    const stop = window.setTimeout(() => {
      window.clearInterval(timer);
      setParams({}, { replace: true });
    }, 60_000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); };
  }, [returnedFromCheckout, refetch, setParams]);

  const subscribe = async () => {
    setBusy(true);
    const { data, error } = await invokeFunction<{ url: string }>('billing-checkout');
    if (error || !data?.url) {
      setBusy(false);
      toast.error(error?.message ?? 'Não foi possível abrir o pagamento.');
      return;
    }
    window.location.href = data.url;
  };

  const cancel = async () => {
    if (!reason) return;
    setBusy(true);
    const { error } = await invokeFunction('billing-cancel', { body: { reason, note } });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setConfirmCancel(false);
    toast.success('Assinatura cancelada.');
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
  };

  if (isLoading || !sub) {
    return (
      <>
        <Header title="Assinatura" subtitle="Plano e pagamento do Command OS" />
        <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      </>
    );
  }

  const info = statusInfo(sub);
  const canSubscribe = !sub.hasCard || sub.status === 'canceled';
  // Card on file but a charge failed: pay it on its Asaas page
  const canPayPending = sub.hasCard && sub.status === 'past_due';
  const canCancel = sub.hasCard && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due');
  const waiting = returnedFromCheckout && !sub.hasCard;

  return (
    <>
      <Header title="Assinatura" subtitle="Plano e pagamento do Command OS" />
      <div className="p-4 md:p-6 max-w-3xl space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{sub.planName}</CardTitle>
              <Badge variant={info.variant}>{info.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold">
                {formatCurrency(sub.price)}
                <span className="text-sm font-normal text-muted-foreground"> /mês</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">{info.detail}</p>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-muted-foreground" />
                {sub.memberCount} de {sub.maxUsers ?? '∞'} usuários
              </span>
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                Cartão de crédito, cobrança mensal automática
              </span>
            </div>

            {waiting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Confirmando o pagamento…
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {canSubscribe && (
                <Button onClick={subscribe} disabled={busy || waiting}>
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  {sub.status === 'trialing' && sub.access === 'full' ? 'Assinar agora' : 'Assinar'}
                </Button>
              )}
              {canPayPending && (
                <Button onClick={subscribe} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                  Pagar mensalidade pendente
                </Button>
              )}
              {canCancel && (
                <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={busy}>
                  Cancelar assinatura
                </Button>
              )}
            </div>
            {canSubscribe && sub.status === 'trialing' && sub.access === 'full' && (
              <p className="text-xs text-muted-foreground">
                Assinando durante o teste, a primeira cobrança só acontece quando o teste terminar.
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              O cartão é digitado na página segura do Asaas; o Command OS não recebe os dados do cartão.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar a assinatura</DialogTitle>
            <DialogDescription>
              Antes de ir, conta pra gente o motivo. Isso nos ajuda a melhorar o Command OS.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as CancellationReason)} className="space-y-2">
              {CANCELLATION_REASONS.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem id={`motivo-${r.value}`} value={r.value} />
                  <Label htmlFor={`motivo-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
            <Textarea
              placeholder="Quer contar mais? (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={3}
            />

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm">Prefere conversar antes? A gente pode ajudar a resolver.</p>
              <Button variant="outline" size="sm" asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Falar com a gente no WhatsApp
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Não haverá novas cobranças. A empresa continua com acesso completo até{' '}
              {fmtDate(sub.status === 'trialing' ? sub.trialEndsAt : sub.currentPeriodEnd ?? sub.trialEndsAt)} e depois passa para
              somente leitura. Dá para assinar de novo quando quiser.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Voltar</Button>
            <Button variant="destructive" onClick={cancel} disabled={!reason || busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
