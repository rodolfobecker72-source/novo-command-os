import { useState, useMemo } from 'react';

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Header } from '@/components/layout/Header';
import { KanbanColumn } from '@/components/crm/KanbanColumn';
import { KanbanCard } from '@/components/crm/KanbanCard';
import { KanbanColumnManager } from '@/components/crm/KanbanColumnManager';
import { KanbanListRow } from '@/components/crm/KanbanListRow';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useCRM } from '@/contexts/CRMContext';
import { CRMCard, CRMStatus, REJECTION_REASONS } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Eye, EyeOff, LayoutGrid, List, FileText, Calendar as CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { formatCurrency } from '@/types/crm';
import { useNavigate } from 'react-router-dom';
import { columnColorClasses } from '@/utils/kanbanColors';

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatExecutionMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES_PT[idx] || month}/${year}`;
}

function ListColumn({ columnKey, label, color, cards, total, hideValues }: { columnKey: string; label: string; color: string; cards: CRMCard[]; total: number; hideValues: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  const colors = columnColorClasses(color);
  return (
    <div
      ref={setNodeRef}
      className={`border ${colors.border} rounded-xl bg-card overflow-hidden ${isOver ? 'ring-2 ring-accent' : ''}`}
    >
      <div className={`flex items-center justify-between px-4 py-3 border-b ${colors.border} ${colors.header}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
          <h3 className="font-semibold text-sm">{label}</h3>
        </div>
        <div className="flex items-center gap-2">
          {!hideValues && total > 0 && (
            <span className="text-xs font-semibold text-accent">{formatCurrency(total)}</span>
          )}
          <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
            {cards.length}
          </span>
        </div>
      </div>
      {cards.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Nenhum projeto nesta etapa
        </div>
      ) : (
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-border">
            {cards.map((card) => (
              <KanbanListRow key={card.id} card={card} hideValues={hideValues} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

export function CRMKanban() {
  const { getCRMCards, moveCard, kanbanColumns, approveBudget, updateBudget } = useCRM();
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState<CRMCard | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'execution'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hideValues, setHideValues] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Approval via drag states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);
  const [pendingApprovalVersion, setPendingApprovalVersion] = useState<number>(0);
  const [dragApproveMonth, setDragApproveMonth] = useState('');

  // Rejection via drag states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectObservation, setRejectObservation] = useState('');

  const cards = getCRMCards();

  // Get unique months for filter based on mode
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    cards.forEach(c => {
      if (filterMode === 'execution') {
        if (c.executionMonth) months.add(c.executionMonth);
      } else {
        const d = new Date(c.createdAt);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.add(ym);
      }
    });
    return [...months].sort();
  }, [cards, filterMode]);

  // Filter cards by month and search
  const filteredCards = useMemo(() => {
    let result = cards;
    if (monthFilter !== 'all') {
      if (filterMode === 'execution') {
        result = result.filter(c => c.executionMonth === monthFilter);
      } else {
        result = result.filter(c => {
          const d = new Date(c.createdAt);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return ym === monthFilter;
        });
      }
    }
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(c =>
        c.projectName.toLowerCase().includes(term) ||
        c.clientName.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term) ||
        c.budgetId.toLowerCase().includes(term)
      );
    }
    return result;
  }, [cards, monthFilter, filterMode, searchTerm]);

  // Sort columns by order
  const sortedColumns = useMemo(() => {
    return [...kanbanColumns].sort((a, b) => a.order - b.order);
  }, [kanbanColumns]);

  // Get column keys for drag detection
  const columnKeys = useMemo(() => {
    return kanbanColumns.map(c => c.key);
  }, [kanbanColumns]);

  const cardsByStatus = useMemo(() => {
    const grouped: Record<string, CRMCard[]> = {};
    
    // Initialize all columns
    kanbanColumns.forEach(col => {
      grouped[col.key] = [];
    });

    // Group cards
    filteredCards.forEach((card) => {
      if (grouped[card.status]) {
        grouped[card.status].push(card);
      } else {
        const firstKey = sortedColumns[0]?.key;
        if (firstKey && grouped[firstKey]) {
          grouped[firstKey].push(card);
        }
      }
    });

    // Sort cards within each column by proposal number (ascending)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        const numA = parseInt(a.projectName, 10);
        const numB = parseInt(b.projectName, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.projectName.localeCompare(b.projectName);
      });
    });

    return grouped;
  }, [filteredCards, kanbanColumns, sortedColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = cards.find((c) => c.id === active.id);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    let targetStatus: string | null = null;

    // Check if dropped on a column
    if (columnKeys.includes(overId)) {
      targetStatus = overId;
    } else {
      // Dropped on another card - find the column of that card
      const overCard = cards.find((c) => c.id === overId);
      if (overCard) {
        targetStatus = overCard.status;
      }
    }

    if (!targetStatus) return;

    // If dropping on "aprovada", show dialog to collect execution month
    if (targetStatus === 'aprovada') {
      const card = cards.find(c => c.id === activeId);
      if (card && card.status !== 'aprovada' && card.currentVersion > 0) {
        setPendingApprovalId(activeId);
        setPendingApprovalVersion(card.currentVersion);
        setDragApproveMonth('');
        setApproveDialogOpen(true);
        return;
      }
    }

    // If dropping on "nao_aprovada", show rejection dialog
    if (targetStatus === 'nao_aprovada') {
      const card = cards.find(c => c.id === activeId);
      if (card && card.status !== 'nao_aprovada') {
        setPendingRejectId(activeId);
        setRejectReason('');
        setRejectObservation('');
        setRejectDialogOpen(true);
        return;
      }
    }

    moveCard(activeId, targetStatus as CRMStatus);
  };

  const handleConfirmDragApprove = async () => {
    if (pendingApprovalId) {
      await approveBudget(pendingApprovalId, pendingApprovalVersion, dragApproveMonth || undefined);
      navigate(`/crm/orcamento/${pendingApprovalId}`);
    }
    setApproveDialogOpen(false);
    setPendingApprovalId(null);
    setDragApproveMonth('');
  };

  const handleConfirmReject = async () => {
    if (pendingRejectId && rejectReason) {
      await updateBudget(pendingRejectId, {
        status: 'nao_aprovada' as CRMStatus,
        rejectionReason: rejectReason,
        rejectionObservation: rejectObservation,
      });
    }
    setRejectDialogOpen(false);
    setPendingRejectId(null);
    setRejectReason('');
    setRejectObservation('');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="CRM"
        subtitle="Gerencie suas oportunidades e propostas"
      />

      <div className="p-4 md:p-6">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 md:mb-6">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <p className="text-sm text-muted-foreground">
              {filteredCards.length} projeto(s)
            </p>
            <KanbanColumnManager />
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, projeto ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterMode} onValueChange={(v) => { setFilterMode(v as 'all' | 'execution'); setMonthFilter('all'); }}>
              <SelectTrigger className="w-44 md:w-52 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Propostas no mês</SelectItem>
                <SelectItem value="execution">Execução no mês</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-36 md:w-44 h-9">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {availableMonths.map(m => (
                  <SelectItem key={m} value={m}>{formatExecutionMonth(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-2"
              onClick={() => setHideValues(v => !v)}
              title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
              aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setViewMode(v => v === 'kanban' ? 'list' : 'kanban')}
              title={viewMode === 'kanban' ? 'Visualizar em lista' : 'Visualizar em kanban'}
            >
              {viewMode === 'kanban' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
              <span className="hidden md:inline ml-1">{viewMode === 'kanban' ? 'Lista' : 'Kanban'}</span>
            </Button>
          </div>
          <Button
            onClick={() => navigate('/crm/orcamento/novo')}
            className="btn-cta w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Novo Orçamento
          </Button>
        </div>

        {/* Board: Kanban or List */}
        {viewMode === 'kanban' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
              {sortedColumns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  status={column.key}
                  cards={cardsByStatus[column.key] || []}
                  color={column.color}
                  label={column.label}
                  hideValue={hideValues}
                />
              ))}
            </div>

            <DragOverlay>
              {activeCard ? (
                <div className="transform rotate-3 opacity-90">
                  <KanbanCard card={activeCard} hideValue={hideValues} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-4">
              {sortedColumns.map((column) => {
                const columnCards = cardsByStatus[column.key] || [];
                const total = columnCards.reduce((sum, c) => sum + (c.value || 0), 0);
                return (
                  <ListColumn
                    key={column.id}
                    columnKey={column.key}
                    label={column.label}
                    color={column.color}
                    cards={columnCards}
                    total={total}
                    hideValues={hideValues}
                  />
                );
              })}
            </div>

            <DragOverlay>
              {activeCard ? (
                <div className="bg-card border border-border rounded-md shadow-xl opacity-90">
                  <KanbanListRow card={activeCard} hideValues={hideValues} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Approval Dialog for Drag */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar Orçamento</DialogTitle>
              <DialogDescription>
                Confirme a aprovação e informe o mês previsto de execução.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="drag-execution-month">Mês de Execução</Label>
              <Input
                id="drag-execution-month"
                type="month"
                value={dragApproveMonth}
                onChange={(e) => setDragApproveMonth(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Mês previsto para execução do projeto (opcional)
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancelar
              </Button>
              <Button className="bg-success hover:bg-success/90" onClick={handleConfirmDragApprove}>
                Confirmar Aprovação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog for Drag */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Não Aprovar Orçamento</DialogTitle>
              <DialogDescription>
                Selecione o motivo da não aprovação e adicione observações se necessário.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label className="mb-2 block">Motivo *</Label>
                <RadioGroup value={rejectReason} onValueChange={setRejectReason} className="space-y-2">
                  {REJECTION_REASONS.map((reason) => (
                    <div key={reason} className="flex items-center space-x-2">
                      <RadioGroupItem value={reason} id={`reason-${reason}`} />
                      <Label htmlFor={`reason-${reason}`} className="text-sm font-normal cursor-pointer">
                        {reason}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="reject-observation">Observação</Label>
                <Textarea
                  id="reject-observation"
                  value={rejectObservation}
                  onChange={(e) => setRejectObservation(e.target.value)}
                  placeholder="Adicione detalhes ou observações..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmReject}
                disabled={!rejectReason}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
