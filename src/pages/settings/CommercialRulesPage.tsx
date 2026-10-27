import { useState, useEffect, useRef } from 'react';
import { movePaymentTerm, sortPaymentTerms, type OrderedPaymentTerm } from '@/utils/paymentTermOrder';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Save, Percent, ShieldAlert, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

type PaymentTerm = OrderedPaymentTerm;

interface CostSettings {
  default_fixed_cost_percentage: number;
  default_nf_percentage: number;
  default_target_margin_percentage: number;
}

export function CommercialRulesPage() {
  const { role, workspace } = useAuth();
  const isOwner = role === 'owner';
  const workspaceId = workspace?.id;

  // Cost settings
  const [costSettings, setCostSettings] = useState<CostSettings>({
    default_fixed_cost_percentage: 20,
    default_nf_percentage: 13,
    default_target_margin_percentage: 25,
  });
  const [costLoading, setCostLoading] = useState(false);

  // Payment terms
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);
  const [reordering, setReordering] = useState(false);
  const reorderLock = useRef(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null);
  const [termForm, setTermForm] = useState({ name: '', description: '', active: true });

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (!workspaceId) return;
    loadCostSettings();
    loadPaymentTerms();
  }, [workspaceId]);

  async function loadCostSettings() {
    if (!workspaceId) return;
    const { data, error } = await supabase
      .from('workspace_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (data) {
      setCostSettings({
        default_fixed_cost_percentage: Number(data.default_fixed_cost_percentage),
        default_nf_percentage: Number(data.default_nf_percentage),
        default_target_margin_percentage: Number(data.default_target_margin_percentage),
      });
    }
  }

  async function loadPaymentTerms() {
    if (!workspaceId) return;
    setTermsLoading(true);
    const { data, error } = await supabase
      .from('payment_terms')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order').order('created_at').order('id');

    if (data) {
      setPaymentTerms(sortPaymentTerms(data.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        active: d.active,
        sortOrder: d.sort_order,
        createdAt: d.created_at,
      }))));
    }
    setTermsLoading(false);
  }

  async function reorderTerm(id: string, direction: -1 | 1) {
    if (!workspaceId || !isOwner || reorderLock.current) return;
    const previous = paymentTerms;
    const next = movePaymentTerm(previous, id, direction);
    reorderLock.current = true;
    setReordering(true);
    setPaymentTerms(next);
    try {
      const { error } = await supabase.rpc('reorder_payment_terms', {
        p_workspace_id: workspaceId,
        p_ids: next.map(term => term.id),
      });
      if (error) throw error;
      toast.success('Ordem das condições salva');
    } catch {
      setPaymentTerms(previous);
      toast.error('Não foi possível salvar a ordem das condições');
    } finally {
      reorderLock.current = false;
      setReordering(false);
    }
  }

  async function saveCostSettings() {
    if (!workspaceId || !isOwner) return;
    setCostLoading(true);

    const { data: existing } = await supabase
      .from('workspace_settings')
      .select('id')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('workspace_settings')
        .update({
          ...costSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', workspaceId));
    } else {
      ({ error } = await supabase
        .from('workspace_settings')
        .insert({
          workspace_id: workspaceId,
          ...costSettings,
        }));
    }

    setCostLoading(false);
    if (error) {
      toast.error('Erro ao salvar configurações');
    } else {
      toast.success('Configurações de custo salvas com sucesso!');
    }
  }

  function openNewTerm() {
    setEditingTerm(null);
    setTermForm({ name: '', description: '', active: true });
    setDialogOpen(true);
  }

  function openEditTerm(term: PaymentTerm) {
    setEditingTerm(term);
    setTermForm({ name: term.name, description: term.description, active: term.active });
    setDialogOpen(true);
  }

  async function saveTerm() {
    if (!workspaceId || !isOwner) return;
    if (!termForm.name.trim()) {
      toast.error('Informe o nome da condição');
      return;
    }

    let error;
    if (editingTerm) {
      ({ error } = await supabase
        .from('payment_terms')
        .update({
          name: termForm.name.trim(),
          description: termForm.description.trim(),
          active: termForm.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTerm.id));
    } else {
      ({ error } = await supabase
        .from('payment_terms')
        .insert({
          workspace_id: workspaceId,
          name: termForm.name.trim(),
          description: termForm.description.trim(),
          active: termForm.active,
          sort_order: Math.max(-1, ...paymentTerms.map(term => term.sortOrder)) + 1,
        }));
    }

    if (error) {
      toast.error('Erro ao salvar condição');
    } else {
      toast.success(editingTerm ? 'Condição atualizada!' : 'Condição criada!');
      setDialogOpen(false);
      loadPaymentTerms();
    }
  }

  async function toggleTermActive(term: PaymentTerm) {
    if (!isOwner) return;
    await supabase
      .from('payment_terms')
      .update({ active: !term.active, updated_at: new Date().toISOString() })
      .eq('id', term.id);
    loadPaymentTerms();
  }

  async function deleteTerm() {
    if (!deleteId || !isOwner) return;
    const { error } = await supabase
      .from('payment_terms')
      .delete()
      .eq('id', deleteId);

    if (error) {
      toast.error('Erro ao excluir condição');
    } else {
      toast.success('Condição excluída');
      loadPaymentTerms();
    }
    setDeleteId(null);
  }

  if (!isOwner) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <ShieldAlert className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Apenas o proprietário do workspace pode acessar e editar as regras comerciais.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header
        title="Regras Comerciais"
        subtitle="Configure as condições gerais aplicadas nas propostas comerciais"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl">

        {/* Cost Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5" />
              Configurações de Custo
            </CardTitle>
            <CardDescription>
              Defina os percentuais padrão aplicados automaticamente em novas propostas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nfCost">Custo NF (%)</Label>
                <div className="relative">
                  <Input
                    id="nfCost"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={costSettings.default_nf_percentage}
                    onChange={(e) =>
                      setCostSettings(prev => ({
                        ...prev,
                        default_nf_percentage: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                      }))
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="margin">Margem Desejada (%)</Label>
                <div className="relative">
                  <Input
                    id="margin"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={costSettings.default_target_margin_percentage}
                    onChange={(e) =>
                      setCostSettings(prev => ({
                        ...prev,
                        default_target_margin_percentage: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                      }))
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={saveCostSettings} disabled={costLoading}>
                <Save className="w-4 h-4 mr-2" />
                {costLoading ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Terms */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Condições de Pagamento</CardTitle>
              <CardDescription>
                Gerencie as opções de pagamento disponíveis nas propostas
              </CardDescription>
            </div>
            <Button onClick={openNewTerm} size="sm" disabled={reordering || termsLoading}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Condição
            </Button>
          </CardHeader>
          <CardContent>
            {paymentTerms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma condição de pagamento cadastrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Ordem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentTerms.map((term, index) => (
                      <TableRow key={term.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Mover para cima" aria-label={`Mover ${term.name} para cima`} disabled={reordering || index === 0} onClick={() => reorderTerm(term.id, -1)}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Mover para baixo" aria-label={`Mover ${term.name} para baixo`} disabled={reordering || index === paymentTerms.length - 1} onClick={() => reorderTerm(term.id, 1)}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{term.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground max-w-[300px] truncate">
                          {term.description || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={term.active ? 'default' : 'secondary'}>
                            {term.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" disabled={reordering} onClick={() => toggleTermActive(term)} title={term.active ? 'Desativar' : 'Ativar'}>
                              <Switch checked={term.active} className="pointer-events-none" />
                            </Button>
                            <Button variant="ghost" size="icon" disabled={reordering} onClick={() => openEditTerm(term)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" disabled={reordering} onClick={() => setDeleteId(term.id)} className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTerm ? 'Editar Condição' : 'Nova Condição de Pagamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="termName">Nome *</Label>
              <Input
                id="termName"
                placeholder="Ex: 50% na aprovação + 50% na entrega"
                value={termForm.name}
                onChange={(e) => setTermForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="termDesc">Descrição</Label>
              <Textarea
                id="termDesc"
                placeholder="Detalhes adicionais sobre a condição..."
                value={termForm.description}
                onChange={(e) => setTermForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={termForm.active}
                onCheckedChange={(checked) => setTermForm(prev => ({ ...prev, active: checked }))}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveTerm}>
              <Save className="w-4 h-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir esta condição de pagamento? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteTerm}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
