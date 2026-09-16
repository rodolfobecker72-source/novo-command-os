import { useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useCRM } from '@/contexts/CRMContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, PAYMENT_STATUS_LABELS } from '@/types/crm';
import { Wallet, CheckCircle2, Clock, Lock } from 'lucide-react';
import { useTeamFinanceEnabled } from '@/hooks/useTeamFinanceEnabled';

interface Entry {
  budgetId: string;
  proposalId: string;
  projectName: string;
  clientName: string;
  description: string;
  realValue: number;
  paymentStatus: string;
  paymentDate: Date | null;
  month: string; // YYYY-MM
  isFreela: boolean;
}

export default function MyFinancePage() {
  const { profile, role } = useAuth();
  const { budgets, clients } = useCRM();
  const { enabled: teamFinanceEnabled, loading: settingsLoading } = useTeamFinanceEnabled();

  const myName = profile?.name || '';

  const entries = useMemo<Entry[]>(() => {
    if (!myName) return [];
    const list: Entry[] = [];
    const matches = (supplier?: string) => {
      if (!supplier) return false;
      // Members are stored as raw name; freelas as "Freela: Name"
      return supplier === myName;
    };

    const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));

    for (const b of budgets) {
      const ex = b.execution;
      if (!ex) continue;
      const month = b.executionMonth || (b.approvalDate ? new Date(b.approvalDate).toISOString().slice(0, 7) : '—');
      const clientName = clientMap.get(b.clientId) || '';

      const pushIfMine = (cost: any, descPrefix?: string) => {
        if (!matches(cost.supplier)) return;
        list.push({
          budgetId: b.id,
          proposalId: b.proposalId,
          projectName: b.projectName,
          clientName,
          description: descPrefix ? `${descPrefix} — ${cost.description}` : cost.description,
          realValue: Number(cost.realValue) || 0,
          paymentStatus: cost.paymentStatus || 'pendente',
          paymentDate: cost.paymentDate ? new Date(cost.paymentDate) : null,
          month,
          isFreela: false,
        });
      };

      ex.services?.forEach((svc) => {
        svc.costs?.forEach((c) => pushIfMine(c));
        svc.extraCosts?.forEach((c) => pushIfMine(c, 'Extra'));
      });
      ex.operationalCosts?.forEach((c) => pushIfMine(c, 'Operacional'));
      ex.extraOperationalCosts?.forEach((c) => pushIfMine(c, 'Operacional Extra'));
    }

    // Sort: month desc, then status (pendente first)
    return list.sort((a, b) => {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      if (a.paymentStatus !== b.paymentStatus) return a.paymentStatus === 'pendente' ? -1 : 1;
      return 0;
    });
  }, [budgets, clients, myName]);

  const totals = useMemo(() => {
    let pago = 0, pendente = 0, mesAtual = 0;
    const currentMonth = new Date().toISOString().slice(0, 7);
    entries.forEach((e) => {
      if (e.paymentStatus === 'pago') pago += e.realValue;
      else if (e.paymentStatus === 'pendente') pendente += e.realValue;
      if (e.month === currentMonth) mesAtual += e.realValue;
    });
    return { pago, pendente, mesAtual };
  }, [entries]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    entries.forEach((e) => {
      const arr = map.get(e.month) || [];
      arr.push(e);
      map.set(e.month, arr);
    });
    return Array.from(map.entries());
  }, [entries]);

  const formatMonth = (m: string) => {
    if (!m || m === '—') return 'Sem mês';
    const [y, mm] = m.split('-');
    const d = new Date(Number(y), Number(mm) - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <>
      <Header title="Meu Financeiro" subtitle="Trabalhos apontados a você nas execuções" />
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <CheckCircle2 className="w-4 h-4 text-success" /> Total Recebido
            </div>
            <div className="text-2xl font-bold mt-1 text-success">{formatCurrency(totals.pago)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Clock className="w-4 h-4 text-warning" /> Pendente
            </div>
            <div className="text-2xl font-bold mt-1 text-warning">{formatCurrency(totals.pendente)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Wallet className="w-4 h-4 text-primary" /> Mês Atual
            </div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(totals.mesAtual)}</div>
          </Card>
        </div>

        {entries.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Nenhum trabalho apontado a você ainda.
          </Card>
        ) : (
          grouped.map(([month, items]) => {
            const monthTotal = items.reduce((s, e) => s + e.realValue, 0);
            return (
              <Card key={month} className="overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 flex items-center justify-between border-b">
                  <h3 className="font-semibold capitalize">{formatMonth(month)}</h3>
                  <span className="text-sm font-semibold">{formatCurrency(monthTotal)}</span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Pgto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((e, i) => (
                        <TableRow key={`${e.budgetId}-${i}`}>
                          <TableCell className="font-medium">
                            #{e.proposalId} {e.projectName ? `- ${e.projectName}` : ''}
                          </TableCell>
                          <TableCell>{e.clientName}</TableCell>
                          <TableCell className="text-sm">{e.description}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(e.realValue)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                e.paymentStatus === 'pago'
                                  ? 'border-success/40 bg-success/10 text-success'
                                  : e.paymentStatus === 'cancelado'
                                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                    : 'border-warning/40 bg-warning/10 text-warning'
                              }
                            >
                              {PAYMENT_STATUS_LABELS[e.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS] || e.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {e.paymentDate ? new Date(e.paymentDate).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
