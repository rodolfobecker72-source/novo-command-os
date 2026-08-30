import { useMemo, useState } from 'react';
import { ExternalLink, Search, History, ChevronDown, ChevronRight, FolderOpen, Folder, Pencil } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { HISTORICAL_PROJECTS } from '@/data/historicalProjects';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function ProjectHistoryPage() {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();

  const [query, setQuery] = useState('');
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ key: string; name: string; link: string; archivedId?: string } | null>(null);
  const [editLink, setEditLink] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: linkOverrides = {} } = useQuery({
    queryKey: ['historical_project_links', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return {};
      const { data, error } = await supabase
        .from('historical_project_links')
        .select('history_key, link')
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        map[row.history_key] = row.link;
      });
      return map;
    },
    enabled: !!workspaceId,
  });

  const { data: archived = [] } = useQuery({
    queryKey: ['archived_projects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as any[];
      const { data, error } = await supabase
        .from('archived_projects')
        .select('id, group_name, project_number, project_name, client_name, link')
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  const keyOf = (p: { year: string; id: number }) => `${p.year}:${p.id}`;

  type HistoryItem = {
    rowKey: string;
    year: string;
    id: number;
    name: string;
    link: string;
    archivedId?: string;
  };

  const linkOf = (p: HistoryItem) =>
    p.archivedId ? p.link : linkOverrides[keyOf(p)] ?? p.link;

  const allItems = useMemo<HistoryItem[]>(() => {
    const staticItems: HistoryItem[] = HISTORICAL_PROJECTS.map((p) => ({
      rowKey: `s:${p.year}:${p.id}:${p.name}`,
      year: p.year,
      id: p.id,
      name: p.name,
      link: p.link,
    }));
    const archivedItems: HistoryItem[] = archived.map((a: any) => {
      const num = parseInt(String(a.project_number).replace(/\D/g, ''), 10);
      const label = [a.project_number, a.project_name].filter(Boolean).join(' - ');
      return {
        rowKey: `a:${a.id}`,
        year: a.group_name,
        id: isNaN(num) ? 0 : num,
        name: a.client_name ? `${label} (${a.client_name})` : label || 'Projeto',
        link: a.link || '-',
        archivedId: a.id,
      };
    });
    return [...staticItems, ...archivedItems];
  }, [archived]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allItems.filter(
      (p) =>
        p.year !== 'Backlog' &&
        (!q || p.name.toLowerCase().includes(q) || p.year.toLowerCase().includes(q))
    );
    const byYear = new Map<string, HistoryItem[]>();
    for (const p of filtered) {
      if (!byYear.has(p.year)) byYear.set(p.year, []);
      byYear.get(p.year)!.push(p);
    }
    // sort each group ascending by id
    for (const arr of byYear.values()) arr.sort((a, b) => a.id - b.id);

    // requested order: 1º semestre 2026, 2025, Nativos do Futuro, 2024
    const order = ['1º semestre 2026', '2025', 'Nativos do Futuro', '2024'];
    const rank = new Map(order.map((y, i) => [y, i]));
    const entries = Array.from(byYear.entries());
    entries.sort(([a], [b]) => {
      const ra = rank.get(a);
      const rb = rank.get(b);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return a.localeCompare(b, 'pt-BR');
    });
    return entries;
  }, [query, allItems]);

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const expandAll = () => setExpandedYears(new Set(grouped.map(([year]) => year)));
  const collapseAll = () => setExpandedYears(new Set());

  const isValidLink = (l: string) => l && l !== '-' && /^https?:\/\//i.test(l);

  const openEdit = (p: HistoryItem) => {
    const current = linkOf(p);
    setEditing({ key: keyOf(p), name: p.name, link: current, archivedId: p.archivedId });
    setEditLink(isValidLink(current) ? current : '');
  };

  const saveEdit = async () => {
    if (!editing || !workspaceId) return;
    const trimmed = editLink.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error('Informe um link válido começando com http:// ou https://');
      return;
    }
    setSaving(true);
    try {
      if (editing.archivedId) {
        const { error } = await supabase
          .from('archived_projects')
          .update({ link: trimmed })
          .eq('id', editing.archivedId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['archived_projects', workspaceId] });
      } else {
        const { error } = await supabase
          .from('historical_project_links')
          .upsert(
            { workspace_id: workspaceId, history_key: editing.key, link: trimmed },
            { onConflict: 'workspace_id,history_key' }
          );
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['historical_project_links', workspaceId] });
      }
      toast.success('Link atualizado com sucesso');
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar o link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Histórico de Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Arquivo de projetos anteriores importados do Notion
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar projeto ou ano..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={expandAll}>
            <FolderOpen className="w-4 h-4 mr-1.5" />
            Expandir todos
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            <Folder className="w-4 h-4 mr-1.5" />
            Recolher todos
          </Button>
        </div>
      </div>

      {grouped.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum projeto encontrado.</p>
      )}

      {grouped.map(([year, projects]) => {
        const isOpen = expandedYears.has(year);
        return (
          <Collapsible key={year} open={isOpen} onOpenChange={() => toggleYear(year)}>
            <div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  <h2 className="text-lg font-semibold">{year}</h2>
                  <Badge variant="secondary">{projects.length}</Badge>
                </button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="border rounded-lg divide-y overflow-hidden">
                {projects.map((p) => {
                  const link = linkOf(p);
                  return (
                    <div
                      key={`${p.year}-${p.id}-${p.name}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <span className="flex-1 text-sm truncate">{p.name}</span>
                      {isValidLink(link) ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                        >
                          Acessar material <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">Sem link</span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => openEdit(p)}
                        aria-label="Editar link do projeto"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar link do projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{editing?.name}</p>
            <div className="space-y-1.5">
              <Label htmlFor="history-link">Link do material</Label>
              <Input
                id="history-link"
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para remover o link.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectHistoryPage;
