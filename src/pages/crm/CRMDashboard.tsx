import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useMonthlyGoals } from '@/hooks/useMonthlyGoals';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

import { formatCurrency } from '@/types/crm';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrendingUp, FileText, CheckCircle2, DollarSign, Calendar, Search } from 'lucide-react';
import { ExecutionForecast } from '@/components/crm/ExecutionForecast';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[Number(m) - 1]}/${y}`;
}

export function CRMDashboard() {
  const { budgets, clients, kanbanColumns } = useCRM();
  const { getGoalForMonth } = useMonthlyGoals();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [filterMonth, setFilterMonth] = useState(String(currentMonth));
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [clientSearch, setClientSearch] = useState('');

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    budgets.forEach(b => years.add(new Date(b.createdAt).getFullYear()));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [budgets, currentYear]);

  const clientMap = useMemo(() => {
    const map: Record<string, typeof clients[0]> = {};
    clients.forEach(c => { map[c.id] = c; });
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    return budgets.filter(b => {
      const d = new Date(b.createdAt);
      if (filterMonth !== 'all' && (d.getMonth() + 1) !== Number(filterMonth)) return false;
      if (filterYear !== 'all' && d.getFullYear() !== Number(filterYear)) return false;
      if (clientSearch) {
        const q = clientSearch.toLowerCase();
        const client = clientMap[b.clientId];
        const name = client?.companyName?.toLowerCase() || '';
        const projName = b.projectName?.toLowerCase() || '';
        if (!name.includes(q) && !projName.includes(q)) return false;
      }
      return true;
    });
  }, [budgets, filterMonth, filterYear, clientSearch, clientMap]);

  // KPIs
  const totalProposals = filtered.length;
  const approved = filtered.filter(b => b.status === 'aprovada');
  const approvedCount = approved.length;
  const conversionRate = totalProposals > 0 ? ((approvedCount / totalProposals) * 100).toFixed(1) : '0';
  const totalValueSold = approved.reduce((sum, b) => sum + (b.finalValue || 0), 0);

  // Helper to get the best available value for a budget
  const getBudgetValue = (b: typeof budgets[0]) => {
    if (b.finalValue) return b.finalValue;
    const latestVersion = b.versions?.length ? b.versions[b.versions.length - 1] : null;
    return latestVersion?.fullPrice || 0;
  };

  // Pipeline
  const sortedColumns = useMemo(() => [...kanbanColumns].sort((a, b) => a.order - b.order), [kanbanColumns]);
  const pipelineData = useMemo(() => {
    return sortedColumns.map(col => {
      const colBudgets = filtered.filter(b => b.status === col.key);
      return {
        name: col.label,
        count: colBudgets.length,
        value: colBudgets.reduce((sum, b) => sum + getBudgetValue(b), 0),
        color: col.key === 'aprovada' ? 'hsl(var(--success))' : col.key === 'nao_aprovada' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
      };
    });
  }, [filtered, sortedColumns]);


  // Execution forecast
  const executionForecast = useMemo(() => {
    const allApproved = budgets.filter(b => b.status === 'aprovada');
    const map: Record<string, { count: number; value: number; projects: { id: string; proposalId: string; name: string; client: string; value: number; hasNf: boolean }[] }> = {};
    allApproved.forEach(b => {
      const month = b.executionMonth;
      if (!month) return;
      if (!map[month]) map[month] = { count: 0, value: 0, projects: [] };
      map[month].count++;
      map[month].value += b.finalValue || 0;
      map[month].projects.push({
        id: b.id,
        proposalId: b.proposalId,
        name: b.projectName || b.proposalId,
        client: clientMap[b.clientId]?.companyName || '—',
        value: b.finalValue || 0,
        hasNf: !!(b as any).nfUrl,
      });
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, label: formatMonthLabel(month), ...data }));
  }, [budgets, clientMap]);

  const executionTotalValue = useMemo(() => executionForecast.reduce((s, f) => s + f.value, 0), [executionForecast]);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Dashboard Comercial" subtitle="Visão geral do desempenho comercial" />
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

      <Tabs defaultValue="previsao-execucao" className="space-y-5">
        <TabsList>
          <TabsTrigger value="previsao-execucao" className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Previsão de Execução
          </TabsTrigger>
          <TabsTrigger value="visao-geral">Visão de Vendas</TabsTrigger>
        </TabsList>

        {/* Tab: Previsão de Execução */}
        <TabsContent value="previsao-execucao" className="space-y-5 mt-0">
          <ExecutionForecast
            executionForecast={executionForecast}
            executionTotalValue={executionTotalValue}
            getGoalForMonth={getGoalForMonth}
          />
        </TabsContent>

        {/* Tab: Visão de Vendas */}
        <TabsContent value="visao-geral" className="space-y-5 mt-0">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-end">
            <div className="flex gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Mês</label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="h-9 text-sm w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ano</label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="h-9 text-sm w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1 flex-1 sm:max-w-xs">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Cliente ou projeto..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="h-9 text-sm pl-8" />
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard icon={FileText} iconBg="bg-primary/10" iconColor="text-primary" label="Total Propostas" value={String(totalProposals)} />
            <KPICard icon={CheckCircle2} iconBg="bg-success/10" iconColor="text-success" label="Aprovadas" value={String(approvedCount)} />
            <KPICard icon={TrendingUp} iconBg="bg-accent/10" iconColor="text-accent" label="Conversão" value={`${conversionRate}%`} />
            <KPICard icon={DollarSign} iconBg="bg-warning/10" iconColor="text-warning" label="Valor Vendido" value={formatCurrency(totalValueSold)} small />
          </div>

          {/* Pipeline */}
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      formatter={(_val: number, _name: string, props: any) => {
                        const entry = props.payload;
                        return [`${entry.count} propostas — ${formatCurrency(entry.value)}`, ''];
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: 2 }}
                    />
                    <Bar dataKey="count" name="Propostas" radius={[0, 4, 4, 0]} barSize={20}>
                      {pipelineData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, iconBg, iconColor, label, value, small }: {
  icon: typeof FileText; iconBg: string; iconColor: string; label: string; value: string; small?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className={`font-bold text-foreground truncate ${small ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl'}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
