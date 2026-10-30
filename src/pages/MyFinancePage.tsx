import { useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const { user, role } = useAuth();
  const { enabled: teamFinanceEnabled, loading: settingsLoading } = useTeamFinanceEnabled();

  // Only this person's own entries come from the database (matched by name in the
  // execution costs), so team members never receive other budget values.
  const { data: rows = [] } = useQuery({
    queryKey: ['my_finance_entries', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_finance_entries' as any);
      if (error) throw error;
      return (data || []) as {
        budget_id: string; proposal_id: string; project_name: string; client_name: string;
        description: string; real_value: number; payment_status: string; payment_date: string | null; month: string;
      }[];
    },
    enabled: !!user,
  });

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = rows.map((r) => ({
      budgetId: r.budget_id,
      proposalId: r.proposal_id,
      projectName: r.project_name,
      clientName: r.client_name,
      description: r.description,
      realValue: Number(r.real_value) || 0,
      paymentStatus: r.payment_status || 'pendente',
      paymentDate: r.payment_date ? new Date(r.payment_date) : null,
      month: r.month,
      isFreela: false,
    }));

    // Sort: month desc, then status (pendente first)
    return list.sort((a, b) => {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      if (a.paymentStatus !== b.paymentStatus) return a.paymentStatus === 'pendente' ? -1 : 1;
      return 0;
    });
  }, [rows]);

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

  const blocked = !settingsLoading && !teamFinanceEnabled && role !== 'owner';

  if (blocked) {
    return (
      <>
        <Header title="Meu Financeiro" subtitle="Trabalhos apontados a você nas execuções" />
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
          <Card className="p-8 text-center text-muted-foreground space-y-2">
            <Lock className="w-6 h-6 mx-auto text-muted-foreground" />
            <p>Esta área está desativada pela gestão do seu workspace.</p>
          </Card>
        </div>
      </>
    );
  }

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
