import { useEffect, useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { HISTORICAL_PROJECTS } from '@/data/historicalProjects';
import { toast } from 'sonner';

const NEW_GROUP = '__new__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveToHistoryDialog({ open, onOpenChange }: Props) {
  const { projectCards, archiveProjectCards } = useCRM();
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupChoice, setGroupChoice] = useState<string>(NEW_GROUP);
  const [newGroup, setNewGroup] = useState('');
  const [saving, setSaving] = useState(false);

  const finished = useMemo(
    () => projectCards.filter((c) => c.status === 'concluido'),
    [projectCards],
  );

  const { data: archivedGroups = [] } = useQuery({
    queryKey: ['archived_project_groups', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as string[];
      const { data, error } = await supabase
        .from('archived_projects')
        .select('group_name')
        .eq('workspace_id', workspaceId);
      if (error) throw error;
      return Array.from(new Set((data || []).map((r: any) => r.group_name)));
    },
    enabled: !!workspaceId && open,
  });

  const existingGroups = useMemo(() => {
    const staticGroups = Array.from(new Set(HISTORICAL_PROJECTS.map((p) => p.year))).filter(
      (y) => y !== 'Backlog',
    );
    return Array.from(new Set([...staticGroups, ...archivedGroups])).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }, [archivedGroups]);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setGroupChoice(NEW_GROUP);
      setNewGroup('');
    }
  }, [open]);

  const allSelected = finished.length > 0 && selected.size === finished.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(finished.map((c) => c.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    const group = groupChoice === NEW_GROUP ? newGroup.trim() : groupChoice;
    if (selected.size === 0) {
      toast.error('Selecione ao menos um projeto');
      return;
    }
    if (!group) {
      toast.error('Informe o nome do grupo/sessão');
      return;
    }
    setSaving(true);
    try {
      await archiveProjectCards(Array.from(selected), group);
      onOpenChange(false);
    } catch {
      /* erro já notificado */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-4 h-4" /> Enviar projetos para o Histórico
          </DialogTitle>
          <DialogDescription>
            Selecione os projetos finalizados e escolha (ou crie) o grupo em que serão agrupados.
            Eles sairão da listagem de Projetos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Grupo / Sessão</Label>
            <Select value={groupChoice} onValueChange={setGroupChoice}>
              <SelectTrigger className="z-[200]">
                <SelectValue placeholder="Escolha o grupo" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value={NEW_GROUP}>+ Criar novo grupo</SelectItem>
                {existingGroups.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {groupChoice === NEW_GROUP && (
              <Input
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="Ex.: 2º semestre 2026"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Projetos finalizados ({finished.length})</Label>
              {finished.length > 0 && (
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {allSelected ? 'Limpar seleção' : 'Selecionar todos'}
                </Button>
              )}
            </div>
            {finished.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum projeto com status Finalizado no momento.
              </p>
            ) : (
              <ScrollArea className="h-64 border rounded-md">
                <div className="divide-y">
                  {finished.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                      />
                      <span className="text-sm flex-1 truncate">
                        {c.proposalId ? `${c.proposalId} - ` : ''}
                        {c.projectName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[35%]">
                        {c.clientName}
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || selected.size === 0}>
            {saving ? 'Enviando...' : `Enviar ${selected.size || ''} para o Histórico`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
