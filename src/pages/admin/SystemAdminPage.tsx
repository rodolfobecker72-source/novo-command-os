import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  MessageSquareWarning,
  Loader2,
  ShieldAlert,
  Sparkles,
  FileText,
  LayoutGrid,
  Target,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemAdmin } from '@/hooks/useSystemAdmin';
import { Header } from '@/components/layout/Header';
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
import { useToast } from '@/hooks/use-toast';

interface WorkspaceUser {
  user_id: string;
  role: string;
  joined_at: string;
  name: string;
  email: string;
  last_sign_in_at: string | null;
}

interface WorkspaceStat {
  id: string;
  name: string;
  created_at: string;
  users: WorkspaceUser[];
  userCount: number;
  clients: number;
  budgets: number;
  leads: number;
  projects: number;
}

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

export function SystemAdminPage() {
  const { isSystemAdmin, loading: checking } = useSystemAdmin();
  const { toast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await supabase.functions.invoke('admin-overview', { body: {} });
    if (err) {
      setError('Não foi possível carregar os dados administrativos.');
      console.error('[admin-overview]', err);
    } else if ((res as any)?.error) {
      setError((res as any).error);
    } else {
      setData(res as Overview);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSystemAdmin) load();
    else if (!checking) setLoading(false);
  }, [isSystemAdmin, checking]);

  const updateStatus = async (id: string, status: string) => {
    const { error: err } = await supabase.functions.invoke('admin-overview', {
      body: { action: 'update_feedback_status', id, status },
    });
    if (err) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      return;
    }
    setData((prev) =>
      prev ? { ...prev, feedback: prev.feedback.map((f) => (f.id === id ? { ...f, status } : f)) } : prev,
    );
    toast({ title: 'Status atualizado' });
  };

  if (checking || loading) {
    return (
      <>
        <Header title="Administração do Sistema" subtitle="Visão global de todas as empresas" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!isSystemAdmin || error) {
    return (
      <>
        <Header title="Administração do Sistema" subtitle="Visão global de todas as empresas" />
        <div className="p-4 md:p-6">
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                {error || 'Esta área é restrita ao administrador do sistema.'}
              </p>
              <Button variant="outline" asChild>
                <Link to="/boas-vindas">Voltar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const t = data?.totals ?? {};

  return (
    <>
      <Header title="Administração do Sistema" subtitle="Visão global de todas as empresas" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <StatCard icon={Building2} label="Empresas" value={t.workspaces} />
          <StatCard icon={Users} label="Usuários" value={t.users} />
          <StatCard icon={Users} label="Clientes cadastrados" value={t.clients} />
          <StatCard icon={FileText} label="Orçamentos" value={t.budgets} />
          <StatCard icon={Target} label="Leads (CRM)" value={t.leads} />
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
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Empresas cadastradas no sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {(data?.workspaces ?? []).map((w) => (
                    <AccordionItem key={w.id} value={w.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-1 items-center justify-between gap-3 pr-3 text-left">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{w.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Desde {fmtDate(w.created_at)}
                            </p>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 shrink-0">
                            <Badge variant="secondary">{w.userCount} usuários</Badge>
                            <Badge variant="outline">{w.clients} clientes</Badge>
                            <Badge variant="outline">{w.budgets} orçamentos</Badge>
                            <Badge variant="outline">{w.projects} projetos</Badge>
                          </div>
                          <Badge variant="secondary" className="sm:hidden shrink-0">
                            {w.userCount}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
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
                                    <Badge variant="outline">{u.role}</Badge>
                                  </TableCell>
                                  <TableCell>{fmtDate(u.joined_at)}</TableCell>
                                  <TableCell>{fmtDate(u.last_sign_in_at)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Landing leads */}
          <TabsContent value="leads" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Cadastros feitos na página inicial (/home)
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
    </>
  );
}

export default SystemAdminPage;
