import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, Pencil, Trash2, Package, Building2, ExternalLink, Loader2, DollarSign, Hash, ShieldCheck, Eye, PowerOff,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Header } from '@/components/layout/Header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

type AssetCategory = 'equipamento' | 'estrutura';

interface Asset {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  value: number;
  serial_number: string;
  hero_asset_number: string;
  photo: string;
  reference_link: string;
  assigned_to: string;
  category: AssetCategory;
  needs_insurance: boolean;
  quantity: number;
  units: AssetUnit[];
  is_active: boolean;
  inactive_reason: string;
  created_at: string;
  updated_at: string;
}

interface AssetUnit {
  serial_number: string;
  hero_asset_number: string;
  [key: string]: string;
}

const emptyForm = {
  name: '',
  description: '',
  value: 0,
  serial_number: '',
  hero_asset_number: '',
  reference_link: '',
  assigned_to: '',
  category: 'equipamento' as AssetCategory,
  needs_insurance: false,
  quantity: 1,
  units: [] as AssetUnit[],
  is_active: true,
  inactive_reason: '',
};

function syncUnits(units: AssetUnit[], quantity: number): AssetUnit[] {
  const qty = Math.max(1, quantity);
  if (qty <= 1) return [];
  const next = units.slice(0, qty);
  while (next.length < qty) next.push({ serial_number: '', hero_asset_number: '' });
  return next;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export function PatrimonioPage() {
  const { workspace } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewAsset, setViewAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (workspace?.id) loadAssets();
  }, [workspace?.id]);

  async function loadAssets() {
    if (!workspace?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('name', { ascending: true });
    if (error) {
      toast.error('Erro ao carregar patrimônio: ' + error.message);
    } else {
      setAssets((data as unknown as Asset[]) || []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditingId(asset.id);
    setForm({
      name: asset.name,
      description: asset.description,
      value: Number(asset.value) || 0,
      serial_number: asset.serial_number,
      hero_asset_number: asset.hero_asset_number,
      reference_link: asset.reference_link,
      assigned_to: asset.assigned_to,
      category: (asset.category as AssetCategory) || 'equipamento',
      needs_insurance: !!asset.needs_insurance,
      quantity: Number(asset.quantity) || 1,
      units: syncUnits(Array.isArray(asset.units) ? (asset.units as AssetUnit[]) : [], Number(asset.quantity) || 1),
      is_active: asset.is_active !== false,
      inactive_reason: asset.inactive_reason || '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!workspace?.id) return;
    if (!form.name.trim()) {
      toast.error('Informe o nome do item.');
      return;
    }
    setSaving(true);
    const qty = Math.max(1, Number(form.quantity) || 1);
    const units = qty > 1 ? syncUnits(form.units, qty) : [];
    const payload = {
      ...form,
      value: Number(form.value) || 0,
      quantity: qty,
      units,
      workspace_id: workspace.id,
    };
    const query = editingId
      ? supabase.from('assets').update(payload).eq('id', editingId)
      : supabase.from('assets').insert(payload);
    const { error } = await query;
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success(editingId ? 'Patrimônio atualizado!' : 'Patrimônio cadastrado!');
      setDialogOpen(false);
      await loadAssets();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from('assets').delete().eq('id', deleteId);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Item excluído.');
      setAssets(prev => prev.filter(a => a.id !== deleteId));
    }
    setDeleteId(null);
  }

  const [categoryFilter, setCategoryFilter] = useState<'todos' | AssetCategory>('todos');

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let list = assets;
    if (categoryFilter !== 'todos') {
      list = list.filter(a => a.category === categoryFilter);
    }
    if (!s) return list;
    return list.filter(a =>
      a.name.toLowerCase().includes(s) ||
      a.description.toLowerCase().includes(s) ||
      a.serial_number.toLowerCase().includes(s) ||
      a.hero_asset_number.toLowerCase().includes(s) ||
      a.assigned_to.toLowerCase().includes(s) ||
      (Array.isArray(a.units) && a.units.some(u =>
        (u.serial_number || '').toLowerCase().includes(s) ||
        (u.hero_asset_number || '').toLowerCase().includes(s),
      )),
    );
  }, [assets, search, categoryFilter]);

  const totals = useMemo(() => ({
    count: assets.length,
    units: assets.reduce((sum, a) => sum + (Number(a.quantity) || 1), 0),
    value: assets.reduce((sum, a) => sum + (Number(a.value) || 0) * (Number(a.quantity) || 1), 0),
    equipamentos: assets.filter(a => a.category === 'equipamento').reduce((s, a) => s + (Number(a.quantity) || 1), 0),
    estruturas: assets.filter(a => a.category === 'estrutura').reduce((s, a) => s + (Number(a.quantity) || 1), 0),
  }), [assets]);

  return (
    <div>
      <Header title="Patrimônio" subtitle="Cadastro dos bens e equipamentos" />
      <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6" />
            Patrimônio
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro dos bens e equipamentos da produtora.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Novo item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar patrimônio' : 'Novo patrimônio'}</DialogTitle>
              <DialogDescription>
                Preencha os dados do item para registrar no patrimônio da produtora.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="name">Nome do item *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Câmera Sony FX3" />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" rows={3} value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalhes, modelo, acessórios..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Valor unitário (R$)</Label>
                  <Input id="value" type="number" step="0.01" min="0" value={form.value} onChange={(e) => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(e) => {
                      const q = Math.max(1, parseInt(e.target.value) || 1);
                      setForm(f => ({ ...f, quantity: q, units: q > 1 ? syncUnits(f.units, q) : [] }));
                    }}
                  />
                </div>
                {form.quantity <= 1 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="hero_asset_number">Nº Patrimônio</Label>
                      <Input id="hero_asset_number" value={form.hero_asset_number} onChange={(e) => setForm(f => ({ ...f, hero_asset_number: e.target.value }))} placeholder="Ex: 0001" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serial_number">Nº de Série</Label>
                      <Input id="serial_number" value={form.serial_number} onChange={(e) => setForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="Serial do fabricante" />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Responsável / Alocado em</Label>
                  <Input id="assigned_to" value={form.assigned_to} onChange={(e) => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Pessoa ou local" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v as AssetCategory }))}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equipamento">Equipamento</SelectItem>
                      <SelectItem value="estrutura">Estrutura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="reference_link">Link de referência</Label>
                  <Input id="reference_link" value={form.reference_link} onChange={(e) => setForm(f => ({ ...f, reference_link: e.target.value }))} placeholder="Ex: link da nota fiscal ou loja" />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2 rounded-md border p-3 bg-muted/30">
                  <Checkbox
                    id="needs_insurance"
                    checked={form.needs_insurance}
                    onCheckedChange={(c) => setForm(f => ({ ...f, needs_insurance: c === true }))}
                  />
                  <Label htmlFor="needs_insurance" className="cursor-pointer flex items-center gap-2 font-normal">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Necessita de seguro
                  </Label>
                </div>
                <div className="sm:col-span-2 space-y-2 rounded-md border p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active" className="cursor-pointer flex items-center gap-2 font-normal">
                      <PowerOff className="w-4 h-4 text-muted-foreground" />
                      Item ativo no patrimônio
                    </Label>
                    <Switch
                      id="is_active"
                      checked={form.is_active}
                      onCheckedChange={(c) => setForm(f => ({ ...f, is_active: c }))}
                    />
                  </div>
                  {!form.is_active && (
                    <div className="space-y-1 pt-1">
                      <Label htmlFor="inactive_reason" className="text-xs text-muted-foreground">Motivo da inativação</Label>
                      <Input
                        id="inactive_reason"
                        value={form.inactive_reason}
                        onChange={(e) => setForm(f => ({ ...f, inactive_reason: e.target.value }))}
                        placeholder="Ex: vendido, perda, troca, doação..."
                      />
                    </div>
                  )}
                </div>
                {form.quantity > 1 && (
                  <div className="sm:col-span-2 space-y-3 rounded-md border p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Unidades ({form.quantity})</Label>
                      <span className="text-xs text-muted-foreground">Nº Patrimônio e Nº de Série de cada unidade</span>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {syncUnits(form.units, form.quantity).map((u, idx) => (
                        <div key={idx} className="grid sm:grid-cols-[auto_1fr_1fr] gap-2 items-center">
                          <div className="text-xs font-mono text-muted-foreground w-8">#{idx + 1}</div>
                          <Input
                            placeholder="Nº Patrimônio"
                            value={u.hero_asset_number}
                            onChange={(e) => setForm(f => {
                              const next = syncUnits(f.units, f.quantity);
                              next[idx] = { ...next[idx], hero_asset_number: e.target.value };
                              return { ...f, units: next };
                            })}
                          />
                          <Input
                            placeholder="Nº de Série"
                            value={u.serial_number}
                            onChange={(e) => setForm(f => {
                              const next = syncUnits(f.units, f.quantity);
                              next[idx] = { ...next[idx], serial_number: e.target.value };
                              return { ...f, units: next };
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? 'Salvar alterações' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Itens cadastrados</p>
              <p className="text-xl font-bold">{totals.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quantidade total</p>
              <p className="text-xl font-bold">{totals.units}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="text-xl font-bold">{formatCurrency(totals.value)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, série, patrimônio ou responsável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-md">
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === 'todos' ? 'default' : 'ghost'}
            onClick={() => setCategoryFilter('todos')}
          >
            Todos ({totals.units})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === 'equipamento' ? 'default' : 'ghost'}
            onClick={() => setCategoryFilter('equipamento')}
            className="gap-1.5"
          >
            <Package className="w-3.5 h-3.5" /> Equipamentos ({totals.equipamentos})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === 'estrutura' ? 'default' : 'ghost'}
            onClick={() => setCategoryFilter('estrutura')}
            className="gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5" /> Estruturas ({totals.estruturas})
          </Button>
        </div>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {assets.length === 0 ? 'Nenhum patrimônio cadastrado ainda.' : 'Nenhum item encontrado para a busca.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Nº Patrimônio</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const isEstrutura = a.category === 'estrutura';
                    const Icon = isEstrutura ? Building2 : Package;
                    const inactive = a.is_active === false;
                    return (
                    <TableRow key={a.id} className={inactive ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEstrutura ? 'bg-orange-500/15 text-orange-600' : 'bg-primary/10 text-primary'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          {a.name}
                          <Badge
                            variant="outline"
                            className={`gap-1 ${isEstrutura ? 'border-orange-500/40 text-orange-600 bg-orange-500/10' : 'border-primary/40 text-primary bg-primary/5'}`}
                          >
                            <Icon className="w-3 h-3" />
                            {isEstrutura ? 'Estrutura' : 'Equipamento'}
                          </Badge>
                          {inactive && (
                            <Badge variant="destructive" className="gap-1">
                              <PowerOff className="w-3 h-3" /> Inativo
                            </Badge>
                          )}
                          {a.needs_insurance && (
                            <Badge variant="outline" className="gap-1 border-green-600/40 text-green-700 bg-green-500/10">
                              <ShieldCheck className="w-3 h-3" /> Seguro
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {Array.isArray(a.units) && a.units.length > 0
                          ? (
                            <div className="space-y-0.5">
                              {a.units.map((u, i) => (
                                <div key={i} className="text-xs">{u.hero_asset_number || '—'}</div>
                              ))}
                            </div>
                          )
                          : (a.hero_asset_number || '—')}
                      </TableCell>
                      <TableCell className="text-sm">{a.assigned_to || '—'}</TableCell>
                      <TableCell className="text-right font-medium">{Number(a.quantity) || 1}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setViewAsset(a)} title="Ver detalhes">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(a)} title="Editar">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteId(a.id)} title="Excluir">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>


      <Dialog open={!!viewAsset} onOpenChange={(o) => !o && setViewAsset(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewAsset && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {viewAsset.name}
                  {viewAsset.is_active === false && (
                    <Badge variant="destructive" className="gap-1">
                      <PowerOff className="w-3 h-3" /> Inativo
                    </Badge>
                  )}
                  {viewAsset.needs_insurance && (
                    <Badge variant="outline" className="gap-1 border-green-600/40 text-green-700 bg-green-500/10">
                      <ShieldCheck className="w-3 h-3" /> Seguro
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>Detalhes completos do item</DialogDescription>
              </DialogHeader>
              <div className="grid sm:grid-cols-2 gap-4 py-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Categoria</div>
                  <div className="font-medium">{viewAsset.category === 'estrutura' ? 'Estrutura' : 'Equipamento'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Responsável / Alocação</div>
                  <div className="font-medium">{viewAsset.assigned_to || '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Quantidade</div>
                  <div className="font-medium">{Number(viewAsset.quantity) || 1}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Valor unitário</div>
                  <div className="font-medium">{formatCurrency(Number(viewAsset.value))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Valor total</div>
                  <div className="font-medium">{formatCurrency(Number(viewAsset.value) * (Number(viewAsset.quantity) || 1))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="font-medium">{viewAsset.is_active === false ? 'Inativo' : 'Ativo'}</div>
                </div>
                {viewAsset.is_active === false && viewAsset.inactive_reason && (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Motivo da inativação</div>
                    <div className="font-medium">{viewAsset.inactive_reason}</div>
                  </div>
                )}
                {viewAsset.description && (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Descrição</div>
                    <div className="whitespace-pre-wrap">{viewAsset.description}</div>
                  </div>
                )}
                {Array.isArray(viewAsset.units) && viewAsset.units.length > 0 ? (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Unidades</div>
                    <div className="rounded-md border divide-y">
                      {viewAsset.units.map((u, i) => (
                        <div key={i} className="grid grid-cols-[auto_1fr_1fr] gap-2 p-2 text-xs">
                          <span className="font-mono text-muted-foreground">#{i + 1}</span>
                          <span><span className="text-muted-foreground">Patrimônio:</span> {u.hero_asset_number || '—'}</span>
                          <span><span className="text-muted-foreground">Série:</span> {u.serial_number || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs text-muted-foreground">Nº Patrimônio</div>
                      <div className="font-mono">{viewAsset.hero_asset_number || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Nº de Série</div>
                      <div className="font-mono">{viewAsset.serial_number || '—'}</div>
                    </div>
                  </>
                )}
                {viewAsset.reference_link && (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground mb-1">Link de referência</div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(viewAsset.reference_link, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> Acessar link
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewAsset(null)}>Fechar</Button>
                <Button onClick={() => { const a = viewAsset; setViewAsset(null); openEdit(a); }}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir patrimônio?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
