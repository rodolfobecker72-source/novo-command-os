import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/types/crm';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Target, DollarSign, TrendingUp, FolderOpen, FileCheck2, FileX2 } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface ForecastEntry {
  month: string;
  label: string;
  count: number;
  value: number;
  projects: { id?: string; proposalId?: string; name: string; client: string; value: number; hasNf?: boolean }[];
}

interface ExecutionForecastProps {
  executionForecast: ForecastEntry[];
  executionTotalValue: number;
  getGoalForMonth: (month: string) => number | null;
}

function KPICard({ icon: Icon, iconBg, iconColor, label, value }: {
  icon: typeof Target; iconBg: string; iconColor: string; label: string; value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="font-bold text-foreground truncate text-base sm:text-lg">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ExecutionForecast({ executionForecast, executionTotalValue, getGoalForMonth }: ExecutionForecastProps) {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterMonth, setFilterMonth] = useState('all');
  const [projectsDialog, setProjectsDialog] = useState<{ label: string; projects: { id?: string; proposalId?: string; name: string; client: string; value: number; hasNf?: boolean }[] } | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    executionForecast.forEach(f => {
      const [y] = f.month.split('-');
      years.add(Number(y));
    });
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [executionForecast, currentYear]);

  const filtered = useMemo(() => {
    return executionForecast.filter(f => {
      const [y, m] = f.month.split('-');
      if (filterYear !== 'all' && y !== filterYear) return false;
      if (filterMonth !== 'all' && m !== String(Number(filterMonth)).padStart(2, '0')) return false;
      return true;
    });
  }, [executionForecast, filterYear, filterMonth]);

  const filteredTotalValue = useMemo(() => filtered.reduce((s, f) => s + f.value, 0), [filtered]);
  const filteredTotalProjects = useMemo(() => filtered.reduce((s, f) => s + f.count, 0), [filtered]);

  const totalGoal = useMemo(() => filtered.reduce((s, f) => {
    const g = getGoalForMonth(f.month);
    return s + (g || 0);
  }, 0), [filtered, getGoalForMonth]);

  const overallProgress = totalGoal > 0 ? (filteredTotalValue / totalGoal) * 100 : 0;
  const goalStatus = overallProgress >= 100 ? 'Meta atingida' : overallProgress >= 80 ? 'Quase atingida' : 'Abaixo da meta';
  const goalStatusVariant = overallProgress >= 100 ? 'default' : overallProgress >= 80 ? 'secondary' : 'destructive';

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-end">
        <div className="flex gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Ano</label>
            <Select value={filterYear} onValueChange={v => { setFilterYear(v); }}>
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
        </div>
        {filteredTotalProjects > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <Badge variant="outline" className="text-xs">
              {filteredTotalProjects} projeto{filteredTotalProjects !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="outline" className="text-xs font-semibold">
              Total: {formatCurrency(filteredTotalValue)}
            </Badge>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {totalGoal > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard icon={Target} iconBg="bg-primary/10" iconColor="text-primary" label="Meta Total" value={formatCurrency(totalGoal)} />
          <KPICard icon={DollarSign} iconBg="bg-success/10" iconColor="text-success" label="Valor Previsto" value={formatCurrency(filteredTotalValue)} />
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent/10 shrink-0">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Progresso Geral</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground text-base sm:text-lg">{overallProgress.toFixed(1)}%</p>
                  <Badge variant={goalStatusVariant as any} className="text-[10px]">{goalStatus}</Badge>
                </div>
                <Progress value={Math.min(overallProgress, 100)} className="h-1.5 mt-1" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-sm text-muted-foreground text-center">Nenhum projeto com mês de execução para o período selecionado</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Chart — separated */}
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Previsão por Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-56 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filtered} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} width={40} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="value" name="Valor" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table — separated */}
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                Detalhamento Mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Mês</TableHead>
                      <TableHead className="text-xs text-center">Projetos</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs text-right">Meta</TableHead>
                      <TableHead className="text-xs text-center">Progresso</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(f => {
                      const goal = getGoalForMonth(f.month);
                      const progress = goal ? (f.value / goal) * 100 : null;
                      const status = progress === null ? null : progress >= 100 ? 'atingida' : progress >= 80 ? 'quase' : 'abaixo';
                      return (
                        <TableRow key={f.month}>
                          <TableCell className="text-xs font-medium py-2.5">{f.label}</TableCell>
                          <TableCell className="text-center py-2.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-2 py-0.5 cursor-pointer hover:bg-primary/10 transition-colors"
                              onClick={() => setProjectsDialog({ label: f.label, projects: f.projects })}
                            >
                              <FolderOpen className="w-3 h-3 mr-1" />
                              {f.count} projeto{f.count !== 1 ? 's' : ''}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium py-2.5">{formatCurrency(f.value)}</TableCell>
                          <TableCell className="text-right text-xs py-2.5">
                            {goal !== null ? formatCurrency(goal) : <span className="text-muted-foreground italic">Não definida</span>}
                          </TableCell>
                          <TableCell className="text-center text-xs py-2.5">
                            {progress !== null ? (
                              <div className="flex items-center gap-1.5 justify-center">
                                <Progress value={Math.min(progress, 100)} className="h-1.5 w-16" />
                                <span className="text-[10px] font-medium">{progress.toFixed(1)}%</span>
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            {status === 'atingida' && <Badge className="text-[10px] px-1.5 bg-success/15 text-success border-success/30" variant="outline">Meta atingida</Badge>}
                            {status === 'quase' && <Badge className="text-[10px] px-1.5" variant="secondary">Quase</Badge>}
                            {status === 'abaixo' && <Badge className="text-[10px] px-1.5" variant="destructive">Abaixo</Badge>}
                            {status === null && <span className="text-[10px] text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Projects Dialog — larger */}
      <Dialog open={!!projectsDialog} onOpenChange={() => setProjectsDialog(null)}>
        <DialogContent className="max-w-5xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-primary" />
              Projetos — {projectsDialog?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm">ID</TableHead>
                  <TableHead className="text-sm">Projeto</TableHead>
                  <TableHead className="text-sm">Cliente</TableHead>
                  <TableHead className="text-sm text-center">NF</TableHead>
                  <TableHead className="text-sm text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...(projectsDialog?.projects ?? [])].sort((a, b) => {
                  const na = parseInt((a.proposalId || '').replace(/\D/g, ''), 10);
                  const nb = parseInt((b.proposalId || '').replace(/\D/g, ''), 10);
                  if (isNaN(na) && isNaN(nb)) return (a.proposalId || '').localeCompare(b.proposalId || '');
                  if (isNaN(na)) return 1;
                  if (isNaN(nb)) return -1;
                  return na - nb;
                }).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-base font-mono text-muted-foreground py-3.5">{p.proposalId || '—'}</TableCell>
                    <TableCell className="text-base font-medium py-3.5">
                      {p.id ? (
                        <button
                          type="button"
                          onClick={() => { setProjectsDialog(null); navigate(`/crm/orcamento/${p.id}?from=dashboard`); }}
                          className="text-primary hover:underline text-left"
                        >
                          {p.name}
                        </button>
                      ) : (
                        p.name
                      )}
                    </TableCell>
                    <TableCell className="text-base py-3.5">{p.client}</TableCell>
                    <TableCell className="text-center py-3.5">
                      {p.hasNf ? (
                        <Badge variant="outline" className="text-[10px] gap-1 border-success/30 bg-success/10 text-success">
                          <FileCheck2 className="w-3 h-3" /> Emitida
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                          <FileX2 className="w-3 h-3" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-base font-semibold py-3.5">{formatCurrency(p.value)}</TableCell>
                  </TableRow>
                ))}
                {projectsDialog?.projects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground text-center py-8">Nenhum projeto</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {projectsDialog && projectsDialog.projects.length > 0 && (
            <div className="flex justify-between items-center text-base font-semibold pt-3 border-t">
              <span className="text-muted-foreground">{projectsDialog.projects.length} projeto{projectsDialog.projects.length !== 1 ? 's' : ''}</span>
              <span>Total: {formatCurrency(projectsDialog.projects.reduce((s, p) => s + p.value, 0))}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
