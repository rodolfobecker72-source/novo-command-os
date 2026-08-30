import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  HardDrive,
  Database,
  Film,
  Package,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  ArrowUpDown,
  FolderOpen,
} from 'lucide-react';

interface HdProject {
  projectNumber: string;
  clientName: string;
  sizeGb: number;
}

interface HardDriveRow {
  id: string;
  label: string;
  capacity_gb: number;
  projects: HdProject[];
  workspace_id: string;
}

function formatStorage(gb: number): string {
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  return `${gb.toFixed(0)} GB`;
}

function getCapacityColor(pct: number): string {
  if (pct >= 90) return 'bg-destructive';
  if (pct >= 70) return 'bg-warning';
  return 'bg-success';
}

export function MediaCenterPage() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [hdFilter, setHdFilter] = useState('all');
  const [expandedHds, setExpandedHds] = useState<Record<string, boolean>>({});
  const [sortByAvailable, setSortByAvailable] = useState(false);

  // Dialogs
  const [newHdOpen, setNewHdOpen] = useState(false);
  const [newHdLabel, setNewHdLabel] = useState('');
  const [newHdCapacity, setNewHdCapacity] = useState('');

  const [editHd, setEditHd] = useState<HardDriveRow | null>(null);
  const [editHdLabel, setEditHdLabel] = useState('');
  const [editHdCapacity, setEditHdCapacity] = useState('');

  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateHdId, setAllocateHdId] = useState('');
  const [allocateProjectNumber, setAllocateProjectNumber] = useState('');
  const [allocateClientName, setAllocateClientName] = useState('');
  const [allocateSizeGb, setAllocateSizeGb] = useState('');

  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Edição de projeto dentro do HD
  const [editProject, setEditProject] = useState<{ hdId: string; index: number } | null>(null);
  const [epNumber, setEpNumber] = useState('');
  const [epClient, setEpClient] = useState('');
  const [epSize, setEpSize] = useState('');
  const [epHdId, setEpHdId] = useState('');


  const { data: hardDrives = [], isLoading } = useQuery({
    queryKey: ['hard_drives', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from('hard_drives')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('label');
      if (error) throw error;
      return (data || []).map((hd) => ({
        ...hd,
        projects: (Array.isArray(hd.projects) ? hd.projects : []) as unknown as HdProject[],
      })) as HardDriveRow[];
    },
    enabled: !!workspaceId,
  });

  // Active clients: clients with approved budgets OR legacy projects
  const { data: activeClients = [] } = useQuery({
    queryKey: ['active_clients', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const [clientsRes, budgetsRes, legacyRes] = await Promise.all([
        supabase.from('clients').select('id, company_name').eq('workspace_id', workspaceId),
        supabase.from('budgets').select('client_id').eq('workspace_id', workspaceId).eq('status', 'aprovada'),
        supabase.from('legacy_projects').select('client_id').eq('workspace_id', workspaceId),
      ]);
      const activeIds = new Set<string>();
      (budgetsRes.data || []).forEach((b: any) => b.client_id && activeIds.add(b.client_id));
      (legacyRes.data || []).forEach((l: any) => l.client_id && activeIds.add(l.client_id));
      return (clientsRes.data || [])
        .filter((c: any) => activeIds.has(c.id))
        .map((c: any) => ({ id: c.id, name: c.company_name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
    enabled: !!workspaceId,
  });

  // Mutations
  const createHd = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('hard_drives').insert({
        workspace_id: workspaceId!,
        label: newHdLabel.trim(),
        capacity_gb: Number(newHdCapacity),
        projects: [] as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_drives'] });
      setNewHdOpen(false);
      setNewHdLabel('');
      setNewHdCapacity('');
      toast({ title: 'HD cadastrado com sucesso!' });
    },
    onError: () => toast({ title: 'Erro ao cadastrar HD', variant: 'destructive' }),
  });

  const updateHd = useMutation({
    mutationFn: async () => {
      if (!editHd) return;
      const { error } = await supabase
        .from('hard_drives')
        .update({ label: editHdLabel.trim(), capacity_gb: Number(editHdCapacity) })
        .eq('id', editHd.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_drives'] });
      setEditHd(null);
      toast({ title: 'HD atualizado!' });
    },
    onError: () => toast({ title: 'Erro ao atualizar HD', variant: 'destructive' }),
  });

  const deleteHd = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('hard_drives').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_drives'] });
      toast({ title: 'HD excluído!' });
    },
    onError: () => toast({ title: 'Erro ao excluir HD', variant: 'destructive' }),
  });

  const allocateProject = useMutation({
    mutationFn: async () => {
      const hd = hardDrives.find((h) => h.id === allocateHdId);
      if (!hd) throw new Error('HD não encontrado');
      const newProjects = [
        ...hd.projects,
        { projectNumber: allocateProjectNumber.trim(), clientName: allocateClientName.trim(), sizeGb: Number(allocateSizeGb) },
      ];
      const { error } = await supabase
        .from('hard_drives')
        .update({ projects: newProjects as any })
        .eq('id', allocateHdId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_drives'] });
      setAllocateOpen(false);
      setAllocateHdId('');
      setAllocateProjectNumber('');
      setAllocateClientName('');
      setAllocateSizeGb('');
      toast({ title: 'Projeto alocado com sucesso!' });
    },
    onError: () => toast({ title: 'Erro ao alocar projeto', variant: 'destructive' }),
  });

  const removeProject = useMutation({
    mutationFn: async ({ hdId, projectIndex }: { hdId: string; projectIndex: number }) => {
      const hd = hardDrives.find((h) => h.id === hdId);
      if (!hd) throw new Error('HD não encontrado');
      const newProjects = hd.projects.filter((_, i) => i !== projectIndex);
      const { error } = await supabase
        .from('hard_drives')
        .update({ projects: newProjects as any })
        .eq('id', hdId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_drives'] });
      toast({ title: 'Projeto removido!' });
    },
    onError: () => toast({ title: 'Erro ao remover projeto', variant: 'destructive' }),
  });

  const saveProjectEdit = useMutation({
    mutationFn: async () => {
      if (!editProject) return;
      const sourceHd = hardDrives.find((h) => h.id === editProject.hdId);
      if (!sourceHd) throw new Error('HD não encontrado');
      const updated: HdProject = {
        projectNumber: epNumber.trim(),
        clientName: epClient.trim(),
        sizeGb: Number(epSize) || 0,
      };
      const targetHdId = epHdId || editProject.hdId;

      if (targetHdId === editProject.hdId) {
        const newProjects = sourceHd.projects.map((p, i) => (i === editProject.index ? updated : p));
        const { error } = await supabase
          .from('hard_drives')
          .update({ projects: newProjects as any })
          .eq('id', sourceHd.id);
        if (error) throw error;
      } else {
        const targetHd = hardDrives.find((h) => h.id === targetHdId);
        if (!targetHd) throw new Error('HD de destino não encontrado');
        const sourceProjects = sourceHd.projects.filter((_, i) => i !== editProject.index);
        const targetProjects = [...targetHd.projects, updated];
        const [r1, r2] = await Promise.all([
          supabase.from('hard_drives').update({ projects: sourceProjects as any }).eq('id', sourceHd.id),
          supabase.from('hard_drives').update({ projects: targetProjects as any }).eq('id', targetHd.id),
        ]);
        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hard_drives'] });
      setEditProject(null);
      toast({ title: 'Projeto atualizado!' });
    },
    onError: () => toast({ title: 'Erro ao atualizar projeto', variant: 'destructive' }),
  });

  const openEditProject = (hdId: string, index: number, p: HdProject) => {
    setEditProject({ hdId, index });
    setEpNumber(p.projectNumber || '');
    setEpClient(p.clientName || '');
    setEpSize(String(p.sizeGb ?? ''));
    setEpHdId(hdId);
  };


  // Computed
  const totalHds = hardDrives.length;
  const totalCapacity = hardDrives.reduce((acc, hd) => acc + Number(hd.capacity_gb), 0);
  const totalUsed = hardDrives.reduce(
    (acc, hd) => acc + hd.projects.reduce((s, p) => s + (Number(p.sizeGb) || 0), 0),
    0
  );
  const totalProjects = hardDrives.reduce((acc, hd) => acc + hd.projects.length, 0);

  const lowerSearch = search.toLowerCase();

  const filteredHds = useMemo(() => {
    let list = hardDrives;
    if (hdFilter !== 'all') {
      list = list.filter((hd) => hd.id === hdFilter);
    }
    if (search) {
      list = list.filter(
        (hd) =>
          hd.label.toLowerCase().includes(lowerSearch) ||
          hd.projects.some(
            (p) =>
              p.projectNumber.toLowerCase().includes(lowerSearch) ||
              (p.clientName || "").toLowerCase().includes(lowerSearch)
          )
      );
    }
    return list;
  }, [hardDrives, hdFilter, lowerSearch]);

  const allProjects = useMemo(() => {
    const items: { hdLabel: string; hdId: string; project: HdProject; index: number }[] = [];
    filteredHds.forEach((hd) => {
      hd.projects.forEach((p, i) => {
        if (
          !search ||
          p.projectNumber.toLowerCase().includes(lowerSearch) ||
          (p.clientName || "").toLowerCase().includes(lowerSearch) ||
          hd.label.toLowerCase().includes(lowerSearch)
        ) {
          items.push({ hdLabel: hd.label, hdId: hd.id, project: p, index: i });
        }
      });
    });
    return items;
  }, [filteredHds, lowerSearch]);

  const capacityHds = useMemo(() => {
    const list = [...filteredHds];
    if (sortByAvailable) {
      list.sort((a, b) => {
        const freeA = Number(a.capacity_gb) - a.projects.reduce((s, p) => s + (Number(p.sizeGb) || 0), 0);
        const freeB = Number(b.capacity_gb) - b.projects.reduce((s, p) => s + (Number(p.sizeGb) || 0), 0);
        return freeB - freeA;
      });
    }
    return list;
  }, [filteredHds, sortByAvailable]);

  const toggleExpand = (id: string) =>
    setExpandedHds((prev) => ({ ...prev, [id]: !prev[id] }));

  const openEditHd = (hd: HardDriveRow) => {
    setEditHd(hd);
    setEditHdLabel(hd.label);
    setEditHdCapacity(String(hd.capacity_gb));
  };

  const openAllocate = (hdId?: string) => {
    setAllocateOpen(true);
    setAllocateHdId(hdId || (hardDrives[0]?.id ?? ''));
    setAllocateProjectNumber('');
    setAllocateClientName('');
    setAllocateSizeGb('');
  };

  const getUsedGb = (hd: HardDriveRow) =>
    hd.projects.reduce((s, p) => s + (Number(p.sizeGb) || 0), 0);

  const getUsagePercent = (hd: HardDriveRow) => {
    const cap = Number(hd.capacity_gb);
    if (!cap) return 0;
    return Math.min(100, (getUsedGb(hd) / cap) * 100);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header title="Central de Mídias" subtitle="Gerencie seus HDs e projetos armazenados" />
      <div className="p-4 md:p-6 space-y-6">

      {/* Tabs */}
      <Tabs defaultValue="por-hd" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <TabsList>
            <TabsTrigger value="por-hd" className="gap-1.5">
              <HardDrive className="w-4 h-4" />
              Projetos por HD
            </TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5">
              <Film className="w-4 h-4" />
              Lista de Projetos
            </TabsTrigger>
            <TabsTrigger value="capacidades" className="gap-1.5">
              <Database className="w-4 h-4" />
              Capacidades
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Search + Filter + New HD */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por HD, projeto ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={hdFilter} onValueChange={setHdFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Todos os HDs" />
            </SelectTrigger>
            <SelectContent className="z-[200]">
              <SelectItem value="all">Todos os HDs</SelectItem>
              {hardDrives.map((hd) => (
                <SelectItem key={hd.id} value={hd.id}>
                  {hd.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setNewHdOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo HD
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted">
              <HardDrive className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{totalHds}</p>
              <p className="text-xs text-muted-foreground">HDs Cadastrados</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted">
              <Database className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{formatStorage(totalCapacity)}</p>
              <p className="text-xs text-muted-foreground">Capacidade Total</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100">
              <Film className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{formatStorage(totalUsed)}</p>
              <p className="text-xs text-muted-foreground">Espaço Utilizado</p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-100">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xl md:text-2xl font-bold">{totalProjects}</p>
              <p className="text-xs text-muted-foreground">Projetos Cadastrados</p>
            </div>
          </Card>
        </div>

        {/* Tab: Projetos por HD */}
        <TabsContent value="por-hd" className="space-y-4 mt-0">
          {filteredHds.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhum HD encontrado</p>
            </Card>
          ) : (
            filteredHds.map((hd) => {
              const used = getUsedGb(hd);
              const free = Number(hd.capacity_gb) - used;
              const pct = getUsagePercent(hd);
              const isOpen = expandedHds[hd.id];

              return (
                <Card key={hd.id} className="p-4 md:p-5 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm md:text-base">{hd.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatStorage(used)} de {formatStorage(Number(hd.capacity_gb))} utilizado •{' '}
                          {formatStorage(Math.max(0, free))} livre
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAllocate(hd.id)}>
                        <FolderOpen className="w-3.5 h-3.5" />
                        Alocar Projeto
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEditHd(hd)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteHd.mutate(hd.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pct.toFixed(0)}% utilizado</span>
                      <span>{formatStorage(Math.max(0, free))} livre</span>
                    </div>
                    <Progress value={pct} className="h-2.5" indicatorClassName={getCapacityColor(pct)} />
                  </div>

                  {/* Expand projects */}
                  <button
                    onClick={() => toggleExpand(hd.id)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {hd.projects.length} projetos
                  </button>

                  {isOpen && hd.projects.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Projeto</TableHead>
                            <TableHead className="text-xs">Cliente</TableHead>
                            <TableHead className="text-xs text-right">Tamanho</TableHead>
                            <TableHead className="text-xs w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hd.projects.map((p, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm font-medium">{p.projectNumber}</TableCell>
                              <TableCell className="text-sm">{p.clientName || "—"}</TableCell>
                              <TableCell className="text-sm text-right">{formatStorage(Number(p.sizeGb) || 0)}</TableCell>
                              <TableCell>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => removeProject.mutate({ hdId: hd.id, projectIndex: i })}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Tab: Lista de Projetos */}
        <TabsContent value="lista" className="mt-0">
          {allProjects.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhum projeto encontrado</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>HD</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allProjects.map((item, i) => (
                    <TableRow key={`${item.hdId}-${item.index}-${i}`}>
                      <TableCell className="font-medium">{item.project.projectNumber}</TableCell>
                      <TableCell>{item.project.clientName || "—"}</TableCell>
                      <TableCell>{item.hdLabel}</TableCell>
                      <TableCell className="text-right">{formatStorage(Number(item.project.sizeGb) || 0)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEditProject(item.hdId, item.index, item.project)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeProject.mutate({ hdId: item.hdId, projectIndex: item.index })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>

                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Capacidades */}
        <TabsContent value="capacidades" className="mt-0 space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setSortByAvailable((p) => !p)}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ordenar por espaço disponível
            </Button>
          </div>

          {capacityHds.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhum HD encontrado</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {capacityHds.map((hd) => {
                const used = getUsedGb(hd);
                const cap = Number(hd.capacity_gb);
                const free = cap - used;
                const pct = getUsagePercent(hd);

                return (
                  <Card key={hd.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-muted">
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <p className="font-semibold">{hd.label}</p>
                      </div>
                      {free > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          ✓ Disponível
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{pct.toFixed(0)}% utilizado</span>
                        <span>{formatStorage(Math.max(0, free))} livre</span>
                      </div>
                      <Progress value={pct} className="h-2.5" indicatorClassName={getCapacityColor(pct)} />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatStorage(used)} usado</span>
                      <span>{formatStorage(cap)} total</span>
                    </div>

                    <p className="text-xs text-muted-foreground">{hd.projects.length} projetos alocados</p>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Novo HD */}
      <Dialog open={newHdOpen} onOpenChange={setNewHdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo HD</DialogTitle>
            <DialogDescription>Informe os dados do HD para começar a alocar projetos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Identificador do HD</Label>
              <Input placeholder="Ex: HD-001" value={newHdLabel} onChange={(e) => setNewHdLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Capacidade (GB)</Label>
              <Input
                placeholder="Ex: 2000 (para 2TB)"
                type="number"
                value={newHdCapacity}
                onChange={(e) => setNewHdCapacity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewHdOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createHd.mutate()}
              disabled={!newHdLabel.trim() || !newHdCapacity || createHd.isPending}
            >
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar HD */}
      <Dialog open={!!editHd} onOpenChange={(open) => !open && setEditHd(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar HD</DialogTitle>
            <DialogDescription>Altere os dados do HD.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Identificador do HD</Label>
              <Input value={editHdLabel} onChange={(e) => setEditHdLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Capacidade (GB)</Label>
              <Input type="number" value={editHdCapacity} onChange={(e) => setEditHdCapacity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditHd(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateHd.mutate()}
              disabled={!editHdLabel.trim() || !editHdCapacity || updateHd.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Alocar Projeto */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alocar Projeto</DialogTitle>
            <DialogDescription>Vincule um projeto a um HD.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>HD</Label>
              <Select value={allocateHdId} onValueChange={setAllocateHdId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o HD" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {hardDrives.map((hd) => (
                    <SelectItem key={hd.id} value={hd.id}>
                      {hd.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Número do Projeto</Label>
              <Input
                placeholder="Ex: PRJ-001"
                value={allocateProjectNumber}
                onChange={(e) => setAllocateProjectNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className={cn(
                      'w-full justify-between font-normal',
                      !allocateClientName && 'text-muted-foreground'
                    )}
                  >
                    {allocateClientName || 'Sem cliente / selecione...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[200]" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar ou digitar cliente..."
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente ativo encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__sem_cliente__"
                          onSelect={() => {
                            setAllocateClientName('');
                            setClientSearch('');
                            setClientPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn('mr-2 h-4 w-4', !allocateClientName ? 'opacity-100' : 'opacity-0')}
                          />
                          Sem cliente
                        </CommandItem>
                        {clientSearch.trim() &&
                          !activeClients.some(
                            (c) => c.name.toLowerCase() === clientSearch.trim().toLowerCase()
                          ) && (
                            <CommandItem
                              value={`__custom__${clientSearch}`}
                              onSelect={() => {
                                setAllocateClientName(clientSearch.trim());
                                setClientSearch('');
                                setClientPickerOpen(false);
                              }}
                            >
                              <Check className="mr-2 h-4 w-4 opacity-0" />
                              Usar "{clientSearch.trim()}"
                            </CommandItem>
                          )}
                        {activeClients.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => {
                              setAllocateClientName(c.name);
                              setClientSearch('');
                              setClientPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                allocateClientName === c.name ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Opcional. Você pode digitar um nome livre ou deixar sem cliente.
              </p>

            </div>
            <div className="space-y-2">
              <Label>Tamanho (GB)</Label>
              <Input
                type="number"
                placeholder="Ex: 150"
                value={allocateSizeGb}
                onChange={(e) => setAllocateSizeGb(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => allocateProject.mutate()}
              disabled={
                !allocateHdId ||
                !allocateProjectNumber.trim() ||
                
                !allocateSizeGb ||
                allocateProject.isPending
              }
            >
              Alocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

