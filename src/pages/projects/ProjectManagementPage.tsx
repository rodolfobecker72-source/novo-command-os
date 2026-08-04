import { useState, useMemo, ReactNode, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Settings2, Calendar as CalendarIcon, GripVertical, ExternalLink, Search, Trash2, Repeat } from 'lucide-react';
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCenter,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { ProjectStatusManagerDialog } from '@/components/projects/ProjectStatusManagerDialog';
import { ProjectActivitiesDialog } from '@/components/projects/ProjectActivitiesDialog';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

function DroppableStatus({ statusKey, children, isOver: _ignored, className }: { statusKey: string; children: ReactNode; isOver?: boolean; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `status-${statusKey}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && 'bg-accent/10 ring-2 ring-accent/40 rounded-md')}
    >
      {children}
    </div>
  );
}

function DraggableRow({ id, children }: { id: string; children: (handleProps: { listeners: any; attributes: any }) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="list-none">
      {children({ listeners, attributes })}
    </li>
  );
}


// Map status color tokens (bg-*) to subtle background tints for the status block
// and a slightly stronger tint for each month group inside.
const STATUS_TINT: Record<string, { block: string; month: string; border: string }> = {
  'bg-info': { block: 'bg-info/[0.04]', month: 'bg-info/[0.09]', border: 'border-info/20' },
  'bg-warning': { block: 'bg-warning/[0.04]', month: 'bg-warning/[0.09]', border: 'border-warning/20' },
  'bg-success': { block: 'bg-success/[0.04]', month: 'bg-success/[0.09]', border: 'border-success/20' },
  'bg-destructive': { block: 'bg-destructive/[0.04]', month: 'bg-destructive/[0.09]', border: 'border-destructive/20' },
  'bg-accent': { block: 'bg-accent/[0.04]', month: 'bg-accent/[0.09]', border: 'border-accent/30' },
  'bg-muted-foreground': { block: 'bg-muted-foreground/[0.04]', month: 'bg-muted-foreground/[0.09]', border: 'border-muted-foreground/20' },
};
const DEFAULT_TINT = { block: 'bg-muted/30', month: 'bg-muted/50', border: 'border-border/50' };

// Colored SelectTrigger styles per status color token
const STATUS_TRIGGER: Record<string, string> = {
  'bg-info': 'bg-info/10 border-info/30 text-info hover:bg-info/15',
  'bg-warning': 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/15',
  'bg-success': 'bg-success/10 border-success/30 text-success hover:bg-success/15',
  'bg-destructive': 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/15',
  'bg-accent': 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/15',
  'bg-muted-foreground': 'bg-muted-foreground/10 border-muted-foreground/30 text-muted-foreground hover:bg-muted-foreground/15',
};

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatMonthLabel(ym: string | null): string {
  if (!ym) return 'Sem mês definido';
  const [y, m] = ym.split('-');
  const idx = parseInt(m, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return ym;
  return `${MONTH_NAMES[idx]} ${y}`;
}

export function ProjectManagementPage() {
  const { projectColumns, projectCards, updateProjectCard, deleteProjectCard, budgets, updateBudget } = useCRM();
  const { workspace, role } = useAuth();
  const canDelete = role === 'owner' || role === 'admin';
  const [manageOpen, setManageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activitiesFor, setActivitiesFor] = useState<{ id: string; name: string } | null>(null);
  const [activityCounts, setActivityCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightBudgetId = searchParams.get('budget');
  const [highlightCardId, setHighlightCardId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!workspace?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('project_activities')
        .select('project_card_id,status')
        .eq('workspace_id', workspace.id);
      if (cancelled || !data) return;
      const counts: Record<string, { total: number; done: number }> = {};
      for (const a of data as any[]) {
        const id = a.project_card_id as string;
        if (!counts[id]) counts[id] = { total: 0, done: 0 };
        counts[id].total += 1;
        if (a.status === 'concluido') counts[id].done += 1;
      }
      setActivityCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [workspace?.id, projectCards.length, activityRefreshKey]);

  // Live-refresh activity counts when any project activity changes
  useRealtimeSync({
    workspaceId: workspace?.id,
    tables: ['project_activities'],
    onChange: () => setActivityRefreshKey((k) => k + 1),
  });


  useEffect(() => {
    if (!highlightBudgetId || projectCards.length === 0) return;
    const card = projectCards.find((c) => c.budgetId === highlightBudgetId);
    if (!card) return;
    setCollapsed((prev) => ({ ...prev, [card.status]: false }));
    setHighlightCardId(card.id);
    setActivitiesFor({ id: card.id, name: card.projectName });
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      sp.delete('budget');
      return sp;
    }, { replace: true });
    const t = setTimeout(() => setHighlightCardId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightBudgetId, projectCards, setSearchParams]);

  const sortedColumns = useMemo(
    () => [...projectColumns].sort((a, b) => a.order - b.order),
    [projectColumns]
  );
  const columnByKey = useMemo(() => {
    const map: Record<string, typeof projectColumns[number]> = {};
    for (const c of projectColumns) map[c.key] = c;
    return map;
  }, [projectColumns]);

  const budgetById = useMemo(() => {
    const m: Record<string, typeof budgets[number]> = {};
    for (const b of budgets) m[b.id] = b;
    return m;
  }, [budgets]);

  // status -> month(YYYY-MM | '__none__') -> cards
  const cardsByStatusAndMonth = useMemo(() => {
    const numOf = (c: typeof projectCards[number]) => {
      const n = parseInt(String(c.proposalId ?? '').replace(/\D/g, ''), 10);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };
    const result: Record<string, { month: string | null; cards: typeof projectCards }[]> = {};
    for (const col of projectColumns) result[col.key] = [];

    const MONTH_NAMES = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    ];
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    /** Texto pesquisável do mês de execução: "2026-01 01/2026 janeiro janeiro 2026 jan" */
    const monthSearchText = (month: string | null) => {
      if (!month) return '';
      const [year, mm] = month.split('-');
      const idx = parseInt(mm, 10) - 1;
      const name = MONTH_NAMES[idx] ?? '';
      return normalize(
        [month, `${mm}/${year}`, name, `${name} ${year}`, name.slice(0, 3), `${name.slice(0, 3)} ${year}`].join(' ')
      );
    };

    const filteredCards = searchQuery
      ? projectCards.filter(card => {
          const q = normalize(searchQuery);
          const month = budgetById[card.budgetId]?.executionMonth ?? null;
          return (
            normalize(card.projectName || '').includes(q) ||
            normalize(card.clientName || '').includes(q) ||
            normalize(card.proposalId || '').includes(q) ||
            monthSearchText(month).includes(q)
          );
        })
      : projectCards;


    for (const card of filteredCards) {
      const statusKey = result[card.status] ? card.status : null;
      if (!statusKey) {
        if (!result[card.status]) result[card.status] = [];
      }
      const month = budgetById[card.budgetId]?.executionMonth ?? null;
      const bucketKey = month || '__none__';
      let bucket = result[card.status].find(b => (b.month || '__none__') === bucketKey);
      if (!bucket) {
        bucket = { month, cards: [] };
        result[card.status].push(bucket);
      }
      bucket.cards.push(card);
    }
    for (const key of Object.keys(result)) {
      // sort cards inside each month
      for (const b of result[key]) {
        b.cards = [...b.cards].sort((a, b) => numOf(a) - numOf(b));
      }
      // sort months ascending; nulls last
      result[key].sort((a, b) => {
        if (!a.month && !b.month) return 0;
        if (!a.month) return 1;
        if (!b.month) return -1;
        return a.month.localeCompare(b.month);
      });
    }
    return result;
  }, [projectColumns, projectCards, budgetById, searchQuery]);

  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleMonthChange = (budgetId: string | undefined, value: string) => {
    if (!budgetId) return;
    updateBudget(budgetId, { executionMonth: value || null });
  };

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('status-')) return;
    const newStatus = overId.slice('status-'.length);
    const card = projectCards.find(c => c.id === active.id);
    if (!card || card.status === newStatus) return;
    updateProjectCard(card.id, { status: newStatus });
  };


  if (activitiesFor) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          title="Área de Projetos"
          subtitle="Acompanhe todo fluxo de projetos da produtora, demandas, responsáveis, datas e objetivos."
        />
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
          <ProjectActivitiesDialog
            variant="page"
            open
            onOpenChange={(o) => { if (!o) { setActivitiesFor(null); setActivityRefreshKey(k => k + 1); } }}
            onBack={() => { setActivitiesFor(null); setActivityRefreshKey(k => k + 1); }}
            projectCardId={activitiesFor.id}
            projectName={activitiesFor.name}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Área de Projetos"
        subtitle="Acompanhe todo fluxo de projetos da produtora, demandas, responsáveis, datas e objetivos."
      />
      <div className="p-4 md:p-6 max-w-5xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cliente, ID ou mês (ex: julho)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setManageOpen(true)} className="shrink-0">
          <Settings2 className="w-4 h-4 mr-2" />
          Gerenciar status
        </Button>
      </div>

      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="mt-8 space-y-2">

        {sortedColumns.map((col) => {
          const buckets = cardsByStatusAndMonth[col.key] || [];
          const totalCards = buckets.reduce((acc, b) => acc + b.cards.length, 0);
          const isCollapsed = collapsed[col.key];
          const tint = DEFAULT_TINT;
          return (
            <div key={col.id} className={cn('rounded-lg border', tint.border, tint.block)}>
              <button
                onClick={() => toggle(col.key)}
                className="w-full flex items-center gap-2 py-3 hover:bg-foreground/[0.03] transition-colors px-3 rounded-md text-left"
              >
                <ChevronRight
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    !isCollapsed && 'rotate-90'
                  )}
                />
                <span className={cn('inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-sm font-medium bg-background/60')}>
                  <span className={cn('w-2 h-2 rounded-full', col.color)} />
                  {col.label}
                </span>
                <span className="text-xs text-muted-foreground ml-1">{totalCards}</span>
              </button>

              {!isCollapsed && (
                <DroppableStatus statusKey={col.key} className="pl-9 pb-3 pr-3 space-y-3 min-h-[40px]">
                  {totalCards === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Nenhum projeto neste status (solte aqui)</p>
                  ) : (
                    buckets.map((bucket) => (
                      <div key={bucket.month || '__none__'} className="space-y-1">
                        <ul className="space-y-1 md:overflow-x-auto -mx-2 px-2">
                          {bucket.cards.map((card) => {
                            const budget = budgetById[card.budgetId];
                            const counts = activityCounts[card.id] || { total: 0, done: 0 };
                            const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
                            const rawLinks = (card as any).materialLinks;
                            const projectLinks: string[] = Array.isArray(rawLinks) && rawLinks.length > 0
                              ? rawLinks.filter((l: any) => typeof l === 'string' && l.trim())
                              : ((card as any).materialLink?.trim() ? [(card as any).materialLink.trim()] : []);
                            const monthNum = bucket.month ? parseInt(bucket.month.split('-')[1], 10) : null;
                            const isOddMonth = monthNum !== null && monthNum % 2 === 1;
                            return (
                              <DraggableRow key={card.id} id={card.id}>
                                {({ listeners, attributes }) => (
                                  <div
                                    ref={(el) => { cardRefs.current[card.id] = el; }}
                                    className={cn(
                                      'text-sm py-1.5 px-2 rounded flex items-center gap-3 md:min-w-0 transition-all',
                                      isOddMonth ? 'bg-primary/10' : 'bg-background',
                                      highlightCardId === card.id && 'ring-2 ring-primary bg-primary/10'
                                    )}
                                  >
                                    <button
                                      type="button"
                                      {...listeners}
                                      {...attributes}
                                      className="hidden md:inline-flex cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
                                      title="Arraste para mudar de status"
                                      aria-label="Arrastar"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </button>
                                    <Select
                                      value={card.status}
                                      onValueChange={(value) => updateProjectCard(card.id, { status: value })}
                                    >
                                      <SelectTrigger className={cn('hidden md:flex h-7 w-[150px] text-xs shrink-0 font-medium', STATUS_TRIGGER[columnByKey[card.status]?.color || ''])}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="z-[200]">
                                        {sortedColumns.map((c) => (
                                          <SelectItem key={c.key} value={c.key} className="text-xs">
                                            {c.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <button
                                      type="button"
                                      onClick={() => setActivitiesFor({ id: card.id, name: `${card.proposalId ? card.proposalId + ' - ' : ''}${card.projectName}${card.clientName ? ' · ' + card.clientName : ''}` })}
                                      className="min-w-0 flex-1 text-left hover:text-primary"
                                      title="Ver atividades do projeto"
                                    >
                                      <div className="truncate">
                                        {card.proposalId && (
                                          <span className="font-medium">{card.proposalId} - </span>
                                        )}
                                        <span className="font-medium">{card.projectName}</span>
                                        {budget?.isRecurring && (
                                          <span className="ml-2 inline-flex items-center gap-1 align-middle text-[9px] uppercase tracking-wide text-accent border border-accent/30 bg-accent/5 rounded px-1 py-0 leading-none h-4">
                                            <Repeat className="w-2.5 h-2.5" />
                                            Recorrente
                                          </span>
                                        )}
                                      </div>
                                      {card.clientName && (
                                        <div className="text-xs text-muted-foreground truncate">{card.clientName}</div>
                                      )}
                                    </button>
                                    {projectLinks.length === 1 && (
                                      <a
                                        href={projectLinks[0]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center h-7 w-7 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary shrink-0"
                                        title={`Abrir link do projeto\n${projectLinks[0]}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                    {projectLinks.length > 1 && (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className="relative inline-flex items-center justify-center h-7 w-7 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary shrink-0"
                                            title={`${projectLinks.length} links salvos`}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                                              {projectLinks.length}
                                            </span>
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72 p-2 z-[200]" align="end" onClick={(e) => e.stopPropagation()}>
                                          <div className="text-xs font-medium text-muted-foreground mb-1 px-1">Links do projeto</div>
                                          <ul className="space-y-1">
                                            {projectLinks.map((url, i) => (
                                              <li key={i}>
                                                <a
                                                  href={url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-2 text-xs px-2 py-1.5 rounded hover:bg-muted"
                                                  title={url}
                                                >
                                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                                  <span className="truncate">{url}</span>
                                                </a>
                                              </li>
                                            ))}
                                          </ul>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                    <span
                                      className={cn(
                                        'hidden md:inline-flex text-xs font-semibold shrink-0 tabular-nums px-2 py-0.5 rounded-full',
                                        pct === 100 ? 'bg-success/10 text-success' : pct > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                      )}
                                      title={`${counts.done}/${counts.total} atividades concluídas`}
                                    >
                                      {pct}%
                                    </span>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="hidden md:inline-flex h-7 px-2 text-xs shrink-0 gap-1"
                                          title="Alterar mês de execução"
                                        >
                                          <CalendarIcon className="w-3 h-3" />
                                          {budget?.executionMonth ? formatMonthLabel(budget.executionMonth) : 'Definir mês'}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-3 z-[200]" align="end">
                                        <div className="space-y-2">
                                          <label className="text-xs font-medium text-muted-foreground">Mês de execução</label>
                                          <Input
                                            type="month"
                                            value={budget?.executionMonth ?? ''}
                                            onChange={(e) => handleMonthChange(card.budgetId, e.target.value)}
                                            className="h-8 text-xs"
                                          />
                                          {budget?.executionMonth && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 text-xs w-full"
                                              onClick={() => handleMonthChange(card.budgetId, '')}
                                            >
                                              Remover mês
                                            </Button>
                                          )}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                    {canDelete && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (window.confirm(`Excluir o projeto "${card.projectName}" da gestão de projetos? Esta ação não pode ser desfeita.`)) {
                                            deleteProjectCard(card.id);
                                          }
                                        }}
                                        className="inline-flex items-center justify-center h-7 w-7 rounded border border-border text-muted-foreground hover:text-destructive hover:border-destructive shrink-0"
                                        title="Excluir projeto da gestão"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </DraggableRow>
                            );
                          })}
                        </ul>
                      </div>
                    ))
                  )}
                </DroppableStatus>
              )}

            </div>
          );
        })}
      </div>
      </DndContext>


      <ProjectStatusManagerDialog open={manageOpen} onOpenChange={setManageOpen} />

      </div>
    </div>
  );
}

export default ProjectManagementPage;
