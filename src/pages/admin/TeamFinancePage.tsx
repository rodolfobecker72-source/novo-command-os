import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, PAYMENT_STATUS_LABELS, PaymentStatus } from '@/types/crm';
import { Wallet, CheckCircle2, Clock, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useTeamFinanceEnabled } from '@/hooks/useTeamFinanceEnabled';

type Source =
  | { kind: 'service'; serviceId: string; costId: string; isExtra: boolean }
  | { kind: 'operational'; costId: string; isExtra: boolean };

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
  source: Source;
}

export function TeamFinancePage() {
  const { workspace } = useAuth();
  const { budgets, clients, updateExecutionCost, updateExecution } = useCRM();
  const {
    enabled: teamFinanceEnabled,
    loading: settingsLoading,
    update: updateTeamFinance,
  } = useTeamFinanceEnabled();
  const [people, setPeople] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');

  // Load workspace member names
  useEffect(() => {
    if (!workspace) return;
    (async () => {
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspace.id);
      const ids = (memberData || []).map((m: any) => m.user_id);
      let names: string[] = [];
      if (ids.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', ids);
        names = (profilesData || []).map((p: any) => p.name).filter(Boolean);
      }
      setPeople(names);
    })();
  }, [workspace]);

  // Suppliers found in executions (includes freelas)
  const suppliers = useMemo(() => {
    const set = new Set<string>(people);
    for (const b of budgets) {
      const ex = b.execution;
      if (!ex) continue;
      ex.services?.forEach((svc) => {
        svc.costs?.forEach((c) => c.supplier && set.add(c.supplier));
        svc.extraCosts?.forEach((c) => c.supplier && set.add(c.supplier));
      });
      ex.operationalCosts?.forEach((c) => c.supplier && set.add(c.supplier));
      ex.extraOperationalCosts?.forEach((c) => c.supplier && set.add(c.supplier));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [budgets, people]);

  const entries = useMemo<Entry[]>(() => {
    if (!selected) return [];
    const list: Entry[] = [];
    const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));

    for (const b of budgets) {
      const ex = b.execution;
      if (!ex) continue;
      const month =
        b.executionMonth ||
        (b.approvalDate ? new Date(b.approvalDate).toISOString().slice(0, 7) : '—');
      const clientName = clientMap.get(b.clientId) || '';

      const push = (cost: any, source: Source, descPrefix?: string) => {
        if (cost.supplier !== selected) return;
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
          source,
        });
      };

      ex.services?.forEach((svc) => {
        svc.costs?.forEach((c) =>
          push(c, { kind: 'service', serviceId: svc.id, costId: c.id, isExtra: false }),
        );
        svc.extraCosts?.forEach((c) =>
          push(c, { kind: 'service', serviceId: svc.id, costId: c.id, isExtra: true }, 'Extra'),
        );
      });
      ex.operationalCosts?.forEach((c) =>
        push(c, { kind: 'operational', costId: c.id, isExtra: false }, 'Operacional'),
      );
      ex.extraOperationalCosts?.forEach((c) =>
        push(c, { kind: 'operational', costId: c.id, isExtra: true }, 'Operacional Extra'),
      );
    }

    return list.sort((a, b) => {
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      if (a.paymentStatus !== b.paymentStatus) return a.paymentStatus === 'pendente' ? -1 : 1;
      return 0;
    });
  }, [budgets, clients, selected]);

  const totals = useMemo(() => {
    let pago = 0,
      pendente = 0,
      mesAtual = 0;
    const currentMonth = new Date().toISOString().slice(0, 7);
    entries.forEach((e) => {
      if (e.paymentStatus === 'pago') pago += e.realValue;
      else if (e.paymentStatus === 'pendente') pendente += e.realValue;
      if (e.month === currentMonth) mesAtual += e.realValue;
    });
    return { pago, pendente, mesAtual };
  }, [entries]);

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

  // ===== Editing =====
  const applyUpdate = async (
    entry: Entry,
    updates: { realValue?: number; paymentStatus?: PaymentStatus; paymentDate?: Date | null },
  ) => {
    if (entry.source.kind === 'service') {
      await updateExecutionCost(
        entry.budgetId,
        entry.source.serviceId,
        entry.source.costId,
        updates as any,
        entry.source.isExtra,
      );
      return;
    }
    const budget = budgets.find((b) => b.id === entry.budgetId);
    if (!budget?.execution) return;
    const key = entry.source.isExtra ? 'extraOperationalCosts' : 'operationalCosts';
    const list = (budget.execution as any)[key] || [];
    const updated = list.map((c: any) =>
      c.id === (entry.source as any).costId ? { ...c, ...updates } : c,
    );
    await updateExecution(entry.budgetId, { [key]: updated } as any);
  };

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');

  const rowKey = (e: Entry) => `${e.budgetId}-${(e.source as any).costId}-${e.source.kind}`;

  return (
    <>
      <Header
        title="Financeiro do Time"
        subtitle="Consulte e ajuste os valores apontados a cada pessoa"
      />
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Liberar “Meu Financeiro” para o time</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando desligado, apenas a gestão vê os valores por aqui.
              </p>
            </div>
            <Switch
              checked={teamFinanceEnabled}
              disabled={settingsLoading}
              onCheckedChange={async (v) => {
                const ok = await updateTeamFinance(v);
                toast[ok ? 'success' : 'error'](
                  ok
                    ? v
                      ? 'Área liberada para o time'
                      : 'Área restrita à gestão'
                    : 'Não foi possível salvar',
                );
              }}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4 text-primary" /> Pessoa do time
            </div>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="sm:w-80">
                <SelectValue placeholder="Selecione uma pessoa" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {suppliers.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {!selected ? (
          <Card className="p-8 text-center text-muted-foreground">
            Selecione uma pessoa do time para ver o financeiro dela.
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Total Recebido
                </div>
                <div className="text-2xl font-bold mt-1 text-success">
                  {formatCurrency(totals.pago)}
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Clock className="w-4 h-4 text-warning" /> Pendente
                </div>
                <div className="text-2xl font-bold mt-1 text-warning">
                  {formatCurrency(totals.pendente)}
                </div>
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
                Nenhum trabalho apontado a esta pessoa ainda.
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
                          {items.map((e) => {
                            const k = rowKey(e);
                            return (
                              <TableRow key={k}>
                                <TableCell className="font-medium">
                                  #{e.proposalId} {e.projectName ? `- ${e.projectName}` : ''}
                                </TableCell>
                                <TableCell>{e.clientName}</TableCell>
                                <TableCell className="text-sm">{e.description}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {editing === k ? (
                                    <Input
                                      autoFocus
                                      type="number"
                                      step="0.01"
                                      value={draft}
                                      onChange={(ev) => setDraft(ev.target.value)}
                                      onBlur={async () => {
                                        const v = Number(draft);
                                        setEditing(null);
                                        if (!Number.isNaN(v) && v !== e.realValue) {
                                          await applyUpdate(e, { realValue: v });
                                        }
                                      }}
                                      onKeyDown={(ev) => {
                                        if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                                        if (ev.key === 'Escape') setEditing(null);
                                      }}
                                      className="h-8 w-28 text-right ml-auto"
                                    />
                                  ) : (
                                    <button
                                      type="button"
                                      className="hover:underline"
                                      onClick={() => {
                                        setEditing(k);
                                        setDraft(String(e.realValue));
                                      }}
                                    >
                                      {formatCurrency(e.realValue)}
                                    </button>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={e.paymentStatus}
                                    onValueChange={(v) =>
                                      applyUpdate(e, {
                                        paymentStatus: v as PaymentStatus,
                                        paymentDate:
                                          v === 'pago' ? e.paymentDate || new Date() : e.paymentDate,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-36 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[200]">
                                      {Object.entries(PAYMENT_STATUS_LABELS).map(([k2, label]) => (
                                        <SelectItem key={k2} value={k2}>
                                          {label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  <Input
                                    type="date"
                                    className="h-8 w-36 text-xs"
                                    value={
                                      e.paymentDate
                                        ? new Date(e.paymentDate).toISOString().slice(0, 10)
                                        : ''
                                    }
                                    onChange={(ev) =>
                                      applyUpdate(e, {
                                        paymentDate: ev.target.value
                                          ? new Date(ev.target.value + 'T12:00:00')
                                          : null,
                                      })
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                );
              })
            )}

            {entries.length > 0 && (
              <p className="text-xs text-muted-foreground">
                As alterações feitas aqui atualizam automaticamente a execução do projeto.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default TeamFinancePage;
