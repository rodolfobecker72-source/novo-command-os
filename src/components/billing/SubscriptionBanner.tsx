import { Link } from 'react-router-dom';
import { AlertTriangle, Lock, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { daysUntil, useSubscription } from '@/hooks/useSubscription';

/** Top-of-app notice about the trial, an unpaid invoice or read-only mode. */
export function SubscriptionBanner() {
  const { role } = useAuth();
  const { data: sub } = useSubscription();
  if (!sub) return null;

  const isOwner = role === 'owner';
  const cta = isOwner ? (
    <Link to="/assinatura" className="font-semibold underline underline-offset-2 whitespace-nowrap">
      {sub.access === 'read_only' || sub.status === 'past_due' ? 'Regularizar' : 'Assinar'}
    </Link>
  ) : (
    <span className="whitespace-nowrap">Fale com o proprietário da empresa.</span>
  );

  if (sub.access === 'read_only') {
    return (
      <div className="flex items-start gap-2 px-4 py-2.5 text-sm bg-destructive/10 text-destructive border-b border-destructive/20">
        <Lock className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="flex-1">
          Modo somente leitura: a assinatura do Command OS não está ativa. Os dados continuam visíveis, mas não dá para criar
          nem editar. {cta}
        </p>
      </div>
    );
  }

  if (sub.status === 'past_due') {
    const days = daysUntil(sub.readOnlyAt);
    return (
      <div className="flex items-start gap-2 px-4 py-2.5 text-sm bg-warning/10 text-warning border-b border-warning/20">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="flex-1">
          Pagamento da assinatura pendente. Em {days} {days === 1 ? 'dia' : 'dias'} a empresa passa para somente leitura. {cta}
        </p>
      </div>
    );
  }

  if (sub.status === 'trialing' && !sub.hasCard) {
    const days = daysUntil(sub.trialEndsAt);
    return (
      <div className="flex items-start gap-2 px-4 py-2.5 text-sm bg-primary/10 text-primary border-b border-primary/20">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="flex-1">
          Teste grátis: {days === 0 ? 'termina hoje' : `${days} ${days === 1 ? 'dia restante' : 'dias restantes'}`}. {cta}
        </p>
      </div>
    );
  }

  return null;
}
