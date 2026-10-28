import { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/contexts/CRMContext';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  formatCNPJ,
  formatPhone,
  formatCurrency,
  LEAD_ORIGIN_LABELS,
} from '@/types/crm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Search,
  Plus,
  Users,
  TrendingUp,
  DollarSign,
  Building2,
  Eye,
  Pencil,
  Phone,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';

export function ClientDashboard() {
  const { clients, budgets, getClient, legacyProjects, deleteClient } = useCRM();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('todos');
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      await deleteClient(clientToDelete.id);
      toast({ title: 'Cliente excluído com sucesso' });
    } catch {
      toast({ title: 'Erro ao excluir cliente', variant: 'destructive' });
    }
    setClientToDelete(null);
  };

  // Determine active/inactive clients
  const activeClientIds = new Set(
    budgets
      .filter((b) => b.status === 'aprovada')
      .map((b) => b.clientId)
  );
  // Also count legacy projects as executed
  legacyProjects.forEach((lp) => {
    if (lp.clientId) activeClientIds.add(lp.clientId);
  });

  // Filter clients
  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.responsiblePerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cnpj.includes(searchTerm);

    let matchesScore = true;
    if (scoreFilter === 'high') matchesScore = client.score >= 70;
    else if (scoreFilter === 'medium')
      matchesScore = client.score >= 40 && client.score < 70;
    else if (scoreFilter === 'low') matchesScore = client.score < 40;

    const isActive = activeClientIds.has(client.id);
    const matchesTab = activeTab === 'todos' ? true : activeTab === 'ativos' ? isActive : !isActive;

    return matchesSearch && matchesScore && matchesTab;
  }).sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR'));

  const activeCount = clients.filter((c) => activeClientIds.has(c.id)).length;
  const inactiveCount = clients.length - activeCount;

  // Calculate stats
  const totalClients = clients.length;
  const highScoreClients = clients.filter((c) => c.score >= 70).length;
  const approvedBudgets = budgets.filter((b) => b.status === 'aprovada');
  const totalRevenue = approvedBudgets.reduce(
    (sum, b) => sum + (b.finalValue || 0),
    0
  );

  const stats = [
    {
      title: 'Total de Clientes',
      value: totalClients,
      icon: Users,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
  ];

  // Get client's projects count (including legacy)
  const getClientProjects = (clientId: string) => {
    return budgets.filter((b) => b.clientId === clientId);
  };

  const getClientLegacyProjects = (clientId: string) => {
    return legacyProjects.filter((lp) => lp.clientId === clientId);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Cadastro" subtitle="Gerencie sua base de cadastros" />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Filters and Actions */}
        <Card className="card-elevated">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Lista de empresas cadastradas</CardTitle>
                <CardDescription>
                  {filteredClients.length} cadastro(s) encontrado(s)
                </CardDescription>
              </div>
              <Button className="btn-cta" onClick={() => navigate('/clientes/novo')}>
                + Nova Empresa
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-3 max-w-xl">
                <TabsTrigger value="todos">
                  Todos ({clients.length})
                </TabsTrigger>
                <TabsTrigger value="ativos">
                  Cliente ({activeCount})
                </TabsTrigger>
                <TabsTrigger value="inativos">
                  Cadastros Inativos ({inactiveCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, responsável ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-lg border overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Empresa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Projetos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client, index) => {
                    const projects = getClientProjects(client.id);
                    return (
                      <motion.tr
                        key={client.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{client.companyName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCNPJ(client.cnpj)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{client.responsiblePerson}</TableCell>
                        <TableCell>
                          <a
                            href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-success hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            {formatPhone(client.phone)}
                          </a>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {LEAD_ORIGIN_LABELS[client.leadOrigin]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {projects.length + getClientLegacyProjects(client.id).length} projeto(s)
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/clientes/${client.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                navigate(`/clientes/${client.id}/editar`)
                              }
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setClientToDelete({ id: client.id, name: client.companyName })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </TableBody>
              </Table>

              {filteredClients.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum cliente encontrado com os filtros aplicados.
                </div>
              )}
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {filteredClients.map((client) => {
                const projectCount = getClientProjects(client.id).length + getClientLegacyProjects(client.id).length;
                return (
                  <div key={client.id} className="border border-border/60 rounded-lg p-3 space-y-2.5 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{client.companyName}</p>
                        <p className="text-xs text-muted-foreground truncate">{formatCNPJ(client.cnpj)}</p>
                      </div>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="truncate"><span className="text-muted-foreground">Resp.:</span> {client.responsiblePerson}</p>
                      <a
                        href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-success hover:underline text-xs"
                      >
                        <Phone className="w-3 h-3" />
                        {formatPhone(client.phone)}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {LEAD_ORIGIN_LABELS[client.leadOrigin]} · {projectCount} projeto(s)
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/clientes/${client.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/clientes/${client.id}/editar`)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setClientToDelete({ id: client.id, name: client.companyName })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredClients.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum cliente encontrado com os filtros aplicados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{clientToDelete?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
