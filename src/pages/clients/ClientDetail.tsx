import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useCRM } from '@/contexts/CRMContext';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { PotentialBadge } from '@/components/common/PotentialBadge';
import { ClassificationBadge } from '@/components/common/ClassificationBadge';
import { ScoreHistory } from '@/components/client/ScoreHistory';
import {
  formatCNPJ,
  formatPhone,
  formatCurrency,
  leadOriginLabel,
  SERVICE_TYPE_LABELS,
} from '@/types/crm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Building2,
  User,
  Phone,
  MapPin,
  Mail,
  Calendar,
  TrendingUp,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Pencil,
  BarChart3,
  Target,
  AlertTriangle,
  Repeat,
  Archive,
  HardDrive as HardDriveIcon,
  History,
  ChevronDown,
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
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getClient, budgets, getClientScoreBreakdown, legacyProjects, hardDrives, getClientScoreHistory, deleteClient } = useCRM();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const client = getClient(id || '');

  const handleDeleteClient = async () => {
    if (!client) return;
    try {
      await deleteClient(client.id);
      toast({ title: 'Cliente excluído com sucesso' });
      navigate('/clientes');
    } catch {
      toast({ title: 'Erro ao excluir cliente', variant: 'destructive' });
    }
    setShowDeleteDialog(false);
  };

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Cliente não encontrado</h2>
          <Button onClick={() => navigate('/clientes')}>Voltar</Button>
        </div>
      </div>
    );
  }

  // Get all projects for this client
  const clientProjects = budgets.filter(b => b.clientId === client.id);
  const clientLegacyProjects = legacyProjects.filter(lp => lp.clientId === client.id);
  const totalProjectsCount = clientProjects.length + clientLegacyProjects.length;
  
  // Get score breakdown and history
  const scoreBreakdown = getClientScoreBreakdown(client.id);
  const clientScoreHistory = getClientScoreHistory(client.id);

  // Helper: find which HD a project is allocated to
  const getProjectHD = (budgetId?: string, legacyProjectId?: string): string | null => {
    for (const hd of hardDrives) {
      const found = hd.projects.some(p => 
        (budgetId && p.budgetId === budgetId) || 
        (legacyProjectId && p.legacyProjectId === legacyProjectId)
      );
      if (found) return hd.label;
    }
    return null;
  };
  
  // Statistics
  const approvedProjects = clientProjects.filter(p => p.status === 'aprovada');
  const pendingProjects = clientProjects.filter(p => 
    p.status !== 'aprovada' && p.status !== 'nao_aprovada'
  );
  const rejectedProjects = clientProjects.filter(p => p.status === 'nao_aprovada');
  
  const totalRevenue = approvedProjects.reduce((sum, p) => sum + (p.finalValue || 0), 0);
  
  // Calculate average margin from approved projects
  const avgMargin = approvedProjects.length > 0
    ? approvedProjects.reduce((sum, p) => {
        const version = p.versions.find(v => v.version === p.approvedVersion);
        return sum + (version?.margin || 0);
      }, 0) / approvedProjects.length
    : 0;

  // Calculate real margin from executions
  const avgRealMargin = approvedProjects.length > 0
    ? approvedProjects.reduce((sum, p) => {
        return sum + (p.execution?.realMargin || 0);
      }, 0) / approvedProjects.length
    : 0;

  const getMarginColor = (margin: number) => {
    if (margin >= 40) return 'text-success';
    if (margin >= 25) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title={client.companyName} 
        subtitle="Detalhes do cliente e projetos vinculados" 
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/clientes')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/clientes/${client.id}/editar`)}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Editar Cliente
            </Button>
            <Button
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="card-elevated h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-accent/10">
                      <Building2 className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Informações</CardTitle>
                      <CardDescription>Dados do cliente</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{client.companyName}</p>
                    <p className="text-xs text-muted-foreground">
                      {client.cnpj ? formatCNPJ(client.cnpj) : 'CNPJ não informado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{client.responsiblePerson}</p>
                    <p className="text-xs text-muted-foreground">Responsável</p>
                  </div>
                </div>

                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
                  >
                    <Mail className="w-4 h-4 text-accent" />
                    <div>
                      <p className="font-medium text-accent">{client.email}</p>
                      <p className="text-xs text-accent/80">E-mail</p>
                    </div>
                  </a>
                )}

                <a
                  href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg bg-success/10 hover:bg-success/20 transition-colors"
                >
                  <Phone className="w-4 h-4 text-success" />
                  <div>
                    <p className="font-medium text-success">
                      {formatPhone(client.phone)}
                    </p>
                    <p className="text-xs text-success/80">WhatsApp</p>
                  </div>
                </a>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{leadOriginLabel(client.leadOrigin)}</p>
                    <p className="text-xs text-muted-foreground">Origem do lead</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {new Date(client.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground">Cliente desde</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalProjectsCount}</p>
                      <p className="text-xs text-muted-foreground">Total de Projetos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10">
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-success">{approvedProjects.length}</p>
                      <p className="text-xs text-muted-foreground">Aprovados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/10">
                      <Clock className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-warning">{pendingProjects.length}</p>
                      <p className="text-xs text-muted-foreground">Em Andamento</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <XCircle className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-destructive">{rejectedProjects.length}</p>
                      <p className="text-xs text-muted-foreground">Não Aprovados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Financial Summary */}
            <Card className="card-elevated mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumo Financeiro</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Receita Total</span>
                    </div>
                    <p className="text-xl font-bold text-blue-500">{formatCurrency(totalRevenue)}</p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-muted-foreground">Margem Orçada Média</span>
                    </div>
                    <p className={`text-xl font-bold ${getMarginColor(avgMargin)}`}>
                      {avgMargin.toFixed(1)}%
                    </p>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-success" />
                      <span className="text-sm text-muted-foreground">Margem Real Média</span>
                    </div>
                    <p className={`text-xl font-bold ${getMarginColor(avgRealMargin)}`}>
                      {avgRealMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

          </motion.div>
        </div>

        {/* Projects Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle>Projetos do Cliente</CardTitle>
              <CardDescription>
                {totalProjectsCount} projeto(s) vinculado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {totalProjectsCount > 0 ? (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Projeto</TableHead>
                        <TableHead>Serviços</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>HD</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Margem Orçada</TableHead>
                        <TableHead className="text-right">Margem Real</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientProjects.map((project, index) => {
                        const currentVersion = project.versions.find(
                          v => v.version === (project.approvedVersion || project.currentVersion)
                        );
                        const serviceTypes = currentVersion?.services
                          ? [...new Set(currentVersion.services.map(s => s.serviceType))]
                          : [project.serviceType];
                        
                        return (
                          <motion.tr
                            key={project.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {project.proposalId} - {project.projectName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  V{project.approvedVersion || project.currentVersion}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {serviceTypes.map(type => (
                                  <span
                                    key={type}
                                    className="px-2 py-0.5 text-xs font-medium bg-foreground/10 rounded"
                                  >
                                    {SERVICE_TYPE_LABELS[type] || type}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={project.status} size="sm" />
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const hdLabel = getProjectHD(project.id);
                                return hdLabel ? (
                                  <div className="flex items-center gap-1 text-xs">
                                    <HardDriveIcon className="w-3 h-3 text-muted-foreground" />
                                    <span>{hdLabel}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {project.finalValue 
                                ? formatCurrency(project.finalValue) 
                                : currentVersion?.fullPrice 
                                  ? formatCurrency(currentVersion.fullPrice)
                                  : '-'
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              {currentVersion?.margin !== undefined ? (
                                <span className={getMarginColor(currentVersion.margin)}>
                                  {currentVersion.margin.toFixed(1)}%
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {project.execution ? (
                                <span className={getMarginColor(project.execution.realMargin)}>
                                  {project.execution.realMargin.toFixed(1)}%
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/crm/orcamento/${project.id}`)}
                              >
                                Ver Detalhes
                              </Button>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                      {clientLegacyProjects.map((lp, index) => (
                        <motion.tr
                          key={lp.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: (clientProjects.length + index) * 0.05 }}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Archive className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">
                                  Projeto #{lp.projectNumber}
                                </p>
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                                  Anterior
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">—</span>
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                              Legado
                            </span>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const hdLabel = getProjectHD(undefined, lp.id);
                              return hdLabel ? (
                                <div className="flex items-center gap-1 text-xs">
                                  <HardDriveIcon className="w-3 h-3 text-muted-foreground" />
                                  <span>{hdLabel}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right font-medium text-muted-foreground">
                            —
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            —
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            —
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-xs text-muted-foreground">{lp.sizeGB} GB</span>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground border rounded-lg">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum projeto vinculado a este cliente</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate('/crm/orcamento/novo')}
                  >
                    Criar Primeiro Orçamento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{client.companyName}</strong>? Esta ação não pode ser desfeita.
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