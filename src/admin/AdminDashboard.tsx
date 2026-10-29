import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Users,
  MessageSquareWarning,
  Loader2,
  Sparkles,
  FileText,
  LayoutGrid,
  Target,
  Mail,
  RefreshCw,
  Activity,
  Search,
} from 'lucide-react';
import { invokeFunction } from '@/lib/edgeFunctions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS } from '@/config/roles';
import type { AppRole } from '@/contexts/AuthContext';

interface WorkspaceUser {
  user_id: string;
  role: AppRole;
  joined_at: string;
  name: string;
  email: string;
  last_seen_at: string | null;
}

interface WorkspaceStat {
  id: string;
  name: string;
  created_at: string;
  users: WorkspaceUser[];
  user_count: number;
  active_users: number;
  last_seen_at: string | null;
  active: boolean;
  clients: number;
  budgets: number;
  leads: number;
  projects: number;
}

type ActivityFilter = 'todas' | 'ativas' | 'inativas';

interface LandingLead {
  id: string;
  name: string;
  company: string;
  email: string;
  whatsapp: string;
  instagram: string;
  created_at: string;
}

interface FeedbackItem {
  id: string;
  user_name: string;
  workspace_name: string;
  page_path: string;
  type: string;
  rating: number | null;
  message: string;
  status: string;
  created_at: string;
  imageUrls: string[];
}

interface Overview {
  totals: Record<string, number>;
  workspaces: WorkspaceStat[];
  landingLeads: LandingLead[];
  feedback: FeedbackItem[];
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca';

const TYPE_LABEL: Record<string, string> = {
  bug: 'Erro',
  sugestao: 'Sugestão',
  avaliacao: 'Avaliação',
};

const STATUS_OPTIONS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'descartado', label: 'Descartado' },
];

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value ?? 0}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Shown only after AdminApp confirmed a system admin signed in with 2-step verification
export function AdminDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('todas');

  const visibleWorkspaces = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.workspaces ?? []).filter((w) => {
      if (activityFilter === 'ativas' && !w.active) return false;
      if (activityFilter === 'inativas' && w.active) return false;
      if (!term) return true;
      return w.name.toLowerCase().includes(term)
        || w.users.some((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
    });
  }, [data, search, activityFilter]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await invokeFunction('admin-overview', { body: {} });
    if (err) {
      setError(err.status === 401 ? err.message : `Não foi possível carregar os dados administrativos. ${err.message}`);
      console.error('[admin-overview]', err);
    } else {
      setData(res as Overview);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error: err } = await invokeFunction('admin-overview', {
      body: { action: 'update_feedback_status', id, status },
    });
    if (err) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
      return;
    }
    setData((prev) =>
      prev ? { ...prev, feedback: prev.feedback.map((f) => (f.id === id ? { ...f, status } : f)) } : prev,
    );
    toast({ title: 'Status atualizado' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={load}>Tentar de novo</Button>
        </CardContent>
      </Card>
    );
  }

  const t = data?.totals ?? {};

  return (
    <div className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Building2} label="Empresas clientes" value={t.workspaces} />
          <StatCard icon={Activity} label="Empresas ativas (30 dias)" value={t.activeWorkspaces} />
          <StatCard icon={Users} label="Usuários" value={t.users} />
          <StatCard icon={Activity} label="Usuários ativos (30 dias)" value={t.activeUsers} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Clientes das empresas" value={t.clients} />
          <StatCard icon={FileText} label="Orçamentos" value={t.budgets} />
          <StatCard icon={Target} label="Leads de prospecção" value={t.leads} />
          <StatCard icon={LayoutGrid} label="Projetos" value={t.projects} />
          <StatCard icon={MessageSquareWarning} label="Reports abertos" value={t.openFeedback} />
        </div>

        <Tabs defaultValue="empresas">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="empresas">Empresas ({data?.workspaces.length ?? 0})</TabsTrigger>
            <TabsTrigger value="leads">Leads do site ({data?.landingLeads.length ?? 0})</TabsTrigger>
            <TabsTrigger value="reports">Reports ({data?.feedback.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* Empresas */}
          <TabsContent value="empresas" className="mt-4">
            <Card>
              <CardHeader className="pb-2 space-y-3">
                <CardTitle className="text-base">Empresas que usam o Command OS</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresa, usuário ou e-mail"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={activityFilter} onValueChange={(v) => setActivityFilter(v as ActivityFilter)}>
                    <SelectTrigger className="sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="ativas">Ativas (30 dias)</SelectItem>
                      <SelectItem value="inativas">Sem acesso há 30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {visibleWorkspaces.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma empresa encontrada.</p>
                ) : (
                  <Accordion type="multiple" className="w-full">
                    {visibleWorkspaces.map((w) => {
                      const owner = w.users.find((u) => u.role === 'owner');
                      return (
                        <AccordionItem key={w.id} value={w.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex flex-1 flex-col sm:flex-row sm:items-center justify-between gap-2 pr-3 text-left">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${w.active ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                                  <p className="font-semibold truncate">{w.name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {owner ? `${owner.name || owner.email} · ${owner.email}` : 'Sem proprietário'}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <Badge variant={w.active ? 'default' : 'outline'}>{w.active ? 'Ativa' : 'Inativa'}</Badge>
                                <Badge variant="secondary">
                                  {w.active_users} de {w.user_count} {w.user_count === 1 ? 'usuário ativo' : 'usuários ativos'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">Último acesso: {fmtDate(w.last_seen_at)}</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline">Cliente desde {fmtDate(w.created_at)}</Badge>
                              <Badge variant="outline">{w.clients} clientes</Badge>
                              <Badge variant="outline">{w.budgets} orçamentos</Badge>
                              <Badge variant="outline">{w.leads} leads</Badge>
                              <Badge variant="outline">{w.projects} projetos</Badge>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>E-mail</TableHead>
                                    <TableHead>Papel</TableHead>
                                    <TableHead>Entrou em</TableHead>
                                    <TableHead>Último acesso</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {w.users.map((u) => (
                                    <TableRow key={u.user_id}>
                                      <TableCell className="font-medium">{u.name || '—'}</TableCell>
                                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                                      </TableCell>
                                      <TableCell>{fmtDate(u.joined_at)}</TableCell>
                                      <TableCell>{fmtDateTime(u.last_seen_at)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Landing leads */}
          <TabsContent value="leads" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Cadastros feitos na página de captura
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Instagram</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.landingLeads ?? []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>{l.company || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{l.email}</TableCell>
                        <TableCell>{l.whatsapp || '—'}</TableCell>
                        <TableCell>{l.instagram || '—'}</TableCell>
                        <TableCell>{fmtDate(l.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {(data?.landingLeads.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum cadastro ainda.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports */}
          <TabsContent value="reports" className="mt-4 space-y-3">
            {(data?.feedback ?? []).map((f) => (
              <Card key={f.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={f.type === 'bug' ? 'destructive' : 'secondary'}>
                        {TYPE_LABEL[f.type] ?? f.type}
                      </Badge>
                      {f.rating ? <Badge variant="outline">Nota {f.rating}/5</Badge> : null}
                      <span className="text-sm font-medium">{f.user_name || '—'}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.workspace_name || 'Sem empresa'} · {f.page_path || '—'} · {fmtDate(f.created_at)}
                      </span>
                    </div>
                    <Select value={f.status} onValueChange={(v) => updateStatus(f.id, v)}>
                      <SelectTrigger className="w-[150px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{f.message}</p>
                  {f.imageUrls?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {f.imageUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img
                            src={url}
                            alt={`Anexo ${i + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border border-border"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {(data?.feedback.length ?? 0) === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Mail className="w-8 h-8" />
                  Nenhum report enviado ainda.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
