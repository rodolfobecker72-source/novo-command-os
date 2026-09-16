import { useState, useMemo, useCallback, useEffect } from 'react';
import { addMonths, subMonths, addWeeks, subWeeks, format, addDays, addBusinessDays, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarActivityEvent, CalendarDeliveryEvent } from '@/components/operation/CalendarEventCard';
import { ChevronLeft, ChevronRight, CalendarDays, Package, Users, Check } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { Budget } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarMonthView } from '@/components/operation/CalendarMonthView';
import { CalendarWeekView } from '@/components/operation/CalendarWeekView';
import { CalendarDayView } from '@/components/operation/CalendarDayView';
import { ProjectActivitiesDialog } from '@/components/projects/ProjectActivitiesDialog';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { toast } from 'sonner';
import { DragEndEvent } from '@dnd-kit/core';
import { getMemberColor, MemberColor } from '@/utils/memberColors';
import { cn } from '@/lib/utils';

interface Member { id: string; name: string }

function computeDeliveryEvents(budgets: Budget[]): CalendarDeliveryEvent[] {
  const events: CalendarDeliveryEvent[] = [];
  for (const b of budgets) {
    if (b.status !== 'aprovada') continue;
    const execStart = b.executionStartDate ? new Date(b.executionStartDate) : null;
    const approvedVersion = b.approvedVersion != null
      ? b.versions?.find(v => v.version === b.approvedVersion)
      : null;
    const latestVersion = approvedVersion
      || (b.versions?.length ? [...b.versions].sort((a, c) => c.version - a.version)[0] : null);
    if (!latestVersion?.services?.length) continue;
    for (const svc of latestVersion.services) {
      if (!svc.deliveryType) continue;
      let d: Date;
      if (svc.deliveryType === 'data_especifica' && (svc as any).deliveryDate) {
        d = new Date((svc as any).deliveryDate + 'T12:00:00');
      } else if (!execStart) continue;
      else if (svc.deliveryType === 'realtime') d = new Date(execStart);
      else if (svc.deliveryType === 'dias_uteis' && svc.deliveryDays) d = addDays(addBusinessDays(execStart, svc.deliveryDays), -1);
      else if (svc.deliveryType === 'dias_corridos' && svc.deliveryDays) d = addDays(execStart, svc.deliveryDays - 1);
      else continue;
      events.push({
        id: `${b.id}-delivery-${svc.id}`,
        date: d,
        label: `📦 ${b.proposalId} - ${b.projectName} — ${svc.serviceType}`,
        budget: b,
        type: 'delivery',
        serviceId: svc.id,
      });
    }
  }
  return events;
}

function toIsoDateOnly(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TeamCalendarPage() {
  const { budgets, updateBudget, updateBudgetVersion } = useCRM();
  const { workspace } = useAuth();

  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [activityDialog, setActivityDialog] = useState<{ projectCardId: string; projectName: string } | null>(null);
  const [showDeliveries, setShowDeliveries] = useState(true);

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [memberBudgetIds, setMemberBudgetIds] = useState<Set<string>>(new Set());
  const [memberActivityEvents, setMemberActivityEvents] = useState<CalendarActivityEvent[]>([]);
  const [loadingMember, setLoadingMember] = useState(false);
  const [membersPopoverOpen, setMembersPopoverOpen] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useRealtimeSync({
    workspaceId: workspace?.id,
    tables: ['project_activities', 'project_cards'],
    onChange: () => setReloadNonce(n => n + 1),
  });

  const storageKey = workspace?.id ? `team-calendar:selected-members:${workspace.id}` : null;

  // Load workspace members
  useEffect(() => {
    if (!workspace?.id) return;
    (async () => {
      const { data: wm, error: wmError } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspace.id);
      if (wmError) {
        console.error('[TeamCalendar] Falha ao carregar membros:', wmError.message);
        toast.error('Não foi possível carregar as pessoas do time.');
        return;
      }
      const ids = (wm || []).map((m: any) => m.user_id);
      if (!ids.length) { setMembers([]); return; }
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids);
      if (profilesError) {
        console.error('[TeamCalendar] Falha ao carregar perfis:', profilesError.message);
        toast.error('Não foi possível carregar os nomes do time.');
        return;
      }
      const list: Member[] = (profiles || [])
        .map((p: any) => ({ id: p.id, name: p.name || '' }))
        .filter(p => p.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setMembers(list);

      // Restore persisted selection
      if (storageKey) {
        try {
          const raw = sessionStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            const arr: string[] = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
            const valid = arr.filter(id => list.some(m => m.id === id));
            if (valid.length) setSelectedMemberIds(new Set(valid));
          }
        } catch (err) {
          console.warn('[TeamCalendar] Seleção salva inválida, ignorando:', err);
          sessionStorage.removeItem(storageKey);
        }
      }
    })();
  }, [workspace?.id, storageKey]);

  // Persist selection
  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(Array.from(selectedMemberIds)));
    } catch { /* ignore */ }
  }, [selectedMemberIds, storageKey]);

  const memberColorMap = useMemo(() => {
    const m = new Map<string, MemberColor>();
    for (const mem of members) m.set(mem.id, getMemberColor(mem.id));
    return m;
  }, [members]);

  // Load budgets/activities for all selected members
  useEffect(() => {
    if (!workspace?.id || selectedMemberIds.size === 0) {
      setMemberBudgetIds(new Set());
      setMemberActivityEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMember(true);
      try {
        const selectedIds = Array.from(selectedMemberIds);
        const memberNames = new Map<string, string>();
        for (const id of selectedIds) {
          const n = members.find(m => m.id === id)?.name?.trim().toLowerCase();
          if (n) memberNames.set(id, n);
        }

        // Fetch activities per member (kept per-member so we can attribute color)
        const perMember = await Promise.all(
          selectedIds.map(async (uid) => {
            const [arrRes, legacyRes] = await Promise.all([
              supabase
                .from('project_activities')
                .select('id, title, status, due_date, end_date, is_delivery, is_captacao, project_card_id')
                .eq('workspace_id', workspace.id)
                .contains('assigned_to_user_ids', [uid]),
              supabase
                .from('project_activities')
                .select('id, title, status, due_date, end_date, is_delivery, is_captacao, project_card_id')
                .eq('workspace_id', workspace.id)
                .eq('assigned_to_user_id', uid),
            ]);
            const map = new Map<string, any>();
            for (const a of [...((arrRes.data || []) as any[]), ...((legacyRes.data || []) as any[])]) {
              if (a?.id) map.set(a.id, a);
            }
            return { uid, activities: Array.from(map.values()) };
          }),
        );

        // Collect card ids to resolve budgets
        const allCardIds = Array.from(new Set(
          perMember.flatMap(p => p.activities.map((a: any) => a.project_card_id)).filter(Boolean),
        ));

        const bids = new Set<string>();
        const cardBudgetMap = new Map<string, string>();
        if (allCardIds.length) {
          const { data: cards } = await supabase
            .from('project_cards')
            .select('id, budget_id')
            .in('id', allCardIds);
          for (const c of (cards || []) as any[]) {
            if (c.id && c.budget_id) cardBudgetMap.set(c.id, c.budget_id);
            if (c.budget_id) bids.add(c.budget_id);
          }
        }

        // Build events, one per (activity, member) so colors are attributed correctly
        const seenEventIds = new Set<string>();
        const activityEvents: CalendarActivityEvent[] = [];
        for (const { uid, activities } of perMember) {
          for (const a of activities) {
            if (!a.due_date || !a.project_card_id) continue;
            const budgetId = cardBudgetMap.get(a.project_card_id);
            const budget = budgetId ? budgets.find(b => b.id === budgetId) : undefined;
            if (!budget) continue;
            const start = new Date(`${a.due_date}T12:00:00`);
            const end = a.end_date ? new Date(`${a.end_date}T12:00:00`) : start;
            const cur = new Date(start);
            while (cur.getTime() <= end.getTime()) {
              const iso = cur.toISOString().slice(0, 10);
              const evId = `${a.id}-${uid}-${iso}`;
              if (!seenEventIds.has(evId)) {
                seenEventIds.add(evId);
                activityEvents.push({
                  id: evId,
                  activityId: a.id,
                  date: new Date(cur),
                  title: a.title || 'Atividade',
                  status: a.status || 'nao_iniciado',
                  budget,
                  projectCardId: a.project_card_id,
                  isDelivery: !!a.is_delivery,
                  isCaptacao: !!a.is_captacao,
                  assignedUserId: uid,
                });
              }
              cur.setDate(cur.getDate() + 1);
            }
          }
        }

        // Also include budgets where any selected member is executor/cost supplier
        const matches = (raw: string | null | undefined, name: string) => {
          if (!raw) return false;
          const n = raw.trim().toLowerCase().replace(/^freela:\s*/i, '');
          return n === name;
        };
        for (const b of budgets) {
          if (bids.has(b.id)) continue;
          const exec = (b as any).execution;
          if (!exec) continue;
          const costsAll = [
            ...((exec.services || []) as any[]).flatMap(s => [...(s.costs || []), ...(s.extraCosts || [])]),
            ...((exec.operationalCosts || []) as any[]),
            ...((exec.extraOperationalCosts || []) as any[]),
          ];
          let matched = false;
          for (const name of memberNames.values()) {
            if (matches(exec.executor, name) || costsAll.some((c: any) => matches(c?.supplier, name))) {
              matched = true; break;
            }
          }
          if (matched) bids.add(b.id);
        }

        if (!cancelled) {
          setMemberBudgetIds(bids);
          setMemberActivityEvents(activityEvents);
        }
      } finally {
        if (!cancelled) setLoadingMember(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspace?.id, selectedMemberIds, budgets, members, reloadNonce]);


  const memberBudgets = useMemo(
    () => budgets.filter(b => memberBudgetIds.has(b.id)),
    [budgets, memberBudgetIds]
  );

  const approvedBudgets = useMemo(() => memberBudgets.filter(b => b.status === 'aprovada'), [memberBudgets]);
  const pendingBudgets = useMemo(
    () => memberBudgets.filter(b => b.status !== 'aprovada' && b.status !== 'nao_aprovada' && b.executionStartDate),
    [memberBudgets],
  );
  const calendarEvents = useMemo(() => approvedBudgets.filter(b => b.executionStartDate), [approvedBudgets]);
  const deliveryEvents = useMemo(() => computeDeliveryEvents(approvedBudgets), [approvedBudgets]);

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => setCurrentDate(d => view === 'month' ? subMonths(d, 1) : view === 'week' ? subWeeks(d, 1) : addDays(d, -1));
  const goNext = () => setCurrentDate(d => view === 'month' ? addMonths(d, 1) : view === 'week' ? addWeeks(d, 1) : addDays(d, 1));

  const headerLabel = view === 'month'
    ? format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })
    : view === 'week'
      ? `Semana de ${format(currentDate, "dd 'de' MMMM", { locale: ptBR })}`
      : format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const dropDate: Date | undefined = (over.data?.current as any)?.date;
    if (!dropDate) return;
    const data = active.data?.current as any;
    if (!data) return;

    if (data.type === 'budget') {
      const b = budgets.find(x => x.id === data.budgetId);
      if (!b || !b.executionStartDate) return;
      const oldStart = new Date(b.executionStartDate);
      const oldDay = new Date(oldStart); oldDay.setHours(0,0,0,0);
      const newDay = new Date(dropDate); newDay.setHours(0,0,0,0);
      const delta = differenceInCalendarDays(newDay, oldDay);
      if (delta === 0) return;
      const newStart = addDays(oldStart, delta);
      const newEnd = b.executionEndDate ? addDays(new Date(b.executionEndDate), delta) : null;
      await updateBudget(b.id, {
        executionStartDate: newStart,
        executionEndDate: newEnd,
        executionMonth: format(newStart, 'yyyy-MM'),
      });
      toast.success(`Movido para ${format(newStart, 'dd/MM/yyyy')}`);
    } else if (data.type === 'delivery') {
      const b = budgets.find(x => x.id === data.budgetId);
      if (!b) return;
      const approvedVer = b.approvedVersion != null
        ? b.versions?.find(v => v.version === b.approvedVersion)
        : null;
      const ver = approvedVer || (b.versions?.length ? [...b.versions].sort((a, c) => c.version - a.version)[0] : null);
      if (!ver) return;
      const newServices = ver.services.map(s => s.id === data.serviceId
        ? { ...s, deliveryType: 'data_especifica' as const, deliveryDate: toIsoDateOnly(dropDate) }
        : s);
      await updateBudgetVersion(b.id, ver.id, { services: newServices });
      toast.success(`Entrega ajustada para ${format(dropDate, 'dd/MM/yyyy')}`);
    } else if (data.type === 'activity') {
      const dropIso = toIsoDateOnly(dropDate);
      // Fetch current activity to preserve duration if it has end_date
      const { data: current } = await supabase
        .from('project_activities')
        .select('due_date, end_date')
        .eq('id', data.activityId)
        .maybeSingle();
      let updates: any = { due_date: dropIso };
      if (current?.due_date && current?.end_date) {
        const oldStart = new Date(`${current.due_date}T12:00:00`);
        const oldEnd = new Date(`${current.end_date}T12:00:00`);
        const durationDays = differenceInCalendarDays(oldEnd, oldStart);
        const newEnd = addDays(new Date(`${dropIso}T12:00:00`), durationDays);
        updates.end_date = toIsoDateOnly(newEnd);
      }
      const { error } = await supabase
        .from('project_activities')
        .update(updates)
        .eq('id', data.activityId);
      if (error) {
        toast.error('Erro ao ajustar data da atividade');
        return;
      }
      // Rebuild events with new dates
      setMemberActivityEvents(prev => {
        const others = prev.filter(a => a.activityId !== data.activityId);
        const sample = prev.find(a => a.activityId === data.activityId);
        if (!sample) return prev;
        const start = new Date(`${dropIso}T12:00:00`);
        const end = updates.end_date ? new Date(`${updates.end_date}T12:00:00`) : start;
        const rebuilt: CalendarActivityEvent[] = [];
        const cur = new Date(start);
        while (cur.getTime() <= end.getTime()) {
          rebuilt.push({
            ...sample,
            id: `${sample.activityId}-${cur.toISOString().slice(0, 10)}`,
            date: new Date(cur),
          });
          cur.setDate(cur.getDate() + 1);
        }
        return [...others, ...rebuilt];
      });
      toast.success(`Atividade ajustada para ${format(dropDate, 'dd/MM/yyyy')}`);
    }
  }, [budgets, updateBudget, updateBudgetVersion]);

  const selectedMembers = useMemo(
    () => members.filter(m => selectedMemberIds.has(m.id)),
    [members, selectedMemberIds],
  );
  const allSelected = members.length > 0 && selectedMembers.length === members.length;

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedMemberIds(allSelected ? new Set() : new Set(members.map(m => m.id)));
  };

  const memberButtonLabel =
    selectedMemberIds.size === 0 ? 'Selecione membros'
    : allSelected ? 'Todos os membros'
    : selectedMembers.length === 1 ? selectedMembers[0].name
    : `${selectedMembers.length} membros selecionados`;

  return (
    <div className="flex flex-col h-full">
      <Header title="Calendário do Time" subtitle="Visualize e ajuste as datas dos projetos de cada membro do time." />

      {/* Toolbar */}
      <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-[240px]">
          <Users className="w-4 h-4 text-muted-foreground" />
          <Popover open={membersPopoverOpen} onOpenChange={setMembersPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-[260px] justify-between text-xs font-normal">
                <span className="truncate flex items-center gap-1.5">
                  {selectedMembers.length > 0 && selectedMembers.length <= 4 && (
                    <span className="flex -space-x-1">
                      {selectedMembers.map(m => (
                        <span key={m.id} className={cn('w-2.5 h-2.5 rounded-full ring-1 ring-background', memberColorMap.get(m.id)?.dot || 'bg-muted-foreground')} />
                      ))}
                    </span>
                  )}
                  {memberButtonLabel}
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0 z-[200]" align="start">
              <div className="p-2 border-b border-border">
                <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  <span className="text-xs font-medium">Selecionar todos</span>
                </label>
              </div>
              <ScrollArea className="max-h-[300px]">
                <div className="p-1">
                  {members.length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum membro</div>
                  )}
                  {members.map(m => {
                    const color = memberColorMap.get(m.id);
                    const checked = selectedMemberIds.has(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={() => toggleMember(m.id)} />
                        <span className={cn('w-2.5 h-2.5 rounded-full', color?.dot || 'bg-muted-foreground')} />
                        <span className="text-xs truncate flex-1">{m.name}</span>
                        {checked && <Check className="w-3 h-3 text-primary" />}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <Tabs value={view} onValueChange={v => setView(v as 'month' | 'week' | 'day')}>
          <TabsList className="h-8">
            <TabsTrigger value="month" className="text-xs px-3 h-7">Mês</TabsTrigger>
            <TabsTrigger value="week" className="text-xs px-3 h-7">Semana</TabsTrigger>
            <TabsTrigger value="day" className="text-xs px-3 h-7">Dia</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
        </div>

        <h2 className="text-sm md:text-base font-semibold capitalize flex-1 min-w-[140px]">{headerLabel}</h2>

        <div className="flex items-center gap-2">
          <Switch checked={showDeliveries} onCheckedChange={setShowDeliveries} className="scale-90" />
          <label className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer" onClick={() => setShowDeliveries(v => !v)}>
            <Package className="w-3.5 h-3.5 text-blue-500" /> Entregas
          </label>
        </div>

        <Button variant="outline" size="sm" className="text-xs h-8" onClick={goToday}>Hoje</Button>
      </div>

      <div className="px-4 md:px-6 py-1.5 text-[11px] text-muted-foreground bg-muted/40 border-b border-border">
        {selectedMemberIds.size > 0
          ? <>Mostrando projetos com atividades atribuídas a <strong>{selectedMembers.map(m => m.name).join(', ')}</strong>. Arraste cards para reagendar — as datas são atualizadas no card do projeto.</>
          : 'Selecione um ou mais membros acima para ver seus projetos.'}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden bg-card flex flex-col">
        {selectedMemberIds.size === 0 ? (
          <div className="h-full flex items-center justify-center p-12 text-center text-muted-foreground text-sm">
            <div>
              <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
              Selecione um ou mais membros do time para visualizar o calendário de projetos.
            </div>
          </div>
        ) : loadingMember ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando…</div>
        ) : memberBudgets.length === 0 && memberActivityEvents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm space-y-2">
            <div>Nenhum projeto encontrado para os membros selecionados.</div>
            <div className="text-xs opacity-80">
              Um projeto aparece aqui quando o membro é responsável por alguma atividade do projeto ou executor/fornecedor de algum custo na execução do orçamento.
            </div>
          </div>

        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-hidden">
              {view === 'month' ? (
                <CalendarMonthView
                  currentDate={currentDate}
                  events={[]}
                  pendingEvents={[]}
                  deliveryEvents={[]}
                  activityEvents={memberActivityEvents}
                  memberColorMap={memberColorMap}
                  onEventClick={setSelectedBudget}
                  onDeliveryClick={(b) => setSelectedBudget(b)}
                  onActivityClick={(a) => setActivityDialog({ projectCardId: a.projectCardId, projectName: a.budget.projectName })}
                  onDragEndDay={handleDragEnd}
                  onDayClick={(d) => { setCurrentDate(d); setView('day'); }}
                />
              ) : view === 'week' ? (
                <CalendarWeekView
                  currentDate={currentDate}
                  events={[]}
                  pendingEvents={[]}
                  deliveryEvents={[]}
                  activityEvents={memberActivityEvents}
                  memberColorMap={memberColorMap}
                  onEventClick={setSelectedBudget}
                  onDeliveryClick={(b) => setSelectedBudget(b)}
                  onActivityClick={(a) => setActivityDialog({ projectCardId: a.projectCardId, projectName: a.budget.projectName })}
                  onDragEndDay={handleDragEnd}
                  onDayClick={(d) => { setCurrentDate(d); setView('day'); }}
                />
              ) : (
                <CalendarDayView
                  currentDate={currentDate}
                  events={[]}
                  pendingEvents={[]}
                  deliveryEvents={[]}
                  activityEvents={memberActivityEvents}
                  memberColorMap={memberColorMap}
                  onEventClick={setSelectedBudget}
                  onDeliveryClick={(b) => setSelectedBudget(b)}
                  onActivityClick={(a) => setActivityDialog({ projectCardId: a.projectCardId, projectName: a.budget.projectName })}
                  onDragEndDay={handleDragEnd}
                />
              )}
            </div>
            {/* Legend footer */}
            <div className="border-t border-border bg-muted/30 px-4 md:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Legenda:</span>
              {selectedMembers.map(m => {
                const c = memberColorMap.get(m.id);
                return (
                  <span key={m.id} className="flex items-center gap-1.5 text-xs">
                    <span className={cn('w-3 h-3 rounded-sm', c?.dot || 'bg-muted-foreground')} />
                    <span className="text-foreground/80">{m.name}</span>
                  </span>
                );
              })}
              <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <Package className="w-3.5 h-3.5 text-blue-500" /> Entrega
              </span>
            </div>
          </>
        )}
      </div>


      <ProjectActivitiesDialog
        open={!!activityDialog}
        onOpenChange={(o) => { if (!o) setActivityDialog(null); }}
        projectCardId={activityDialog?.projectCardId || ''}
        projectName={activityDialog?.projectName || ''}
      />


      {/* Simple detail dialog */}
      <Dialog open={!!selectedBudget} onOpenChange={open => { if (!open) setSelectedBudget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedBudget?.proposalId} - {selectedBudget?.projectName}</DialogTitle>
          </DialogHeader>
          {selectedBudget && (
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Período</p>
                <p className="font-medium">
                  {selectedBudget.executionStartDate ? format(new Date(selectedBudget.executionStartDate), 'dd/MM/yyyy') : '—'}
                  {selectedBudget.executionEndDate ? ` → ${format(new Date(selectedBudget.executionEndDate), 'dd/MM/yyyy')}` : ''}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Arraste o card no calendário para alterar as datas. As mudanças aparecem automaticamente no card do projeto.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
