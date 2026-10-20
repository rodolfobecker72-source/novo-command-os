import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { CRMCard, formatCurrency, waHref } from '@/types/crm';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Film, Camera, Smartphone, FileText, Calendar, AlertCircle, Copy, Repeat, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { DuplicateBudgetDialog } from './DuplicateBudgetDialog';

interface KanbanCardProps {
  card: CRMCard;
  hideValue?: boolean;
}

const serviceIcons: Record<string, typeof Film> = {
  CINE: Film,
  FOTO: Camera,
  MOBILE: Smartphone,
};

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatExecutionMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES_PT[idx] || month}/${year}`;
}

export function KanbanCard({ card, hideValue = false }: KanbanCardProps) {
  const navigate = useNavigate();
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const { getCategoryLabel } = useCRM();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, resizeObserverConfig: { disabled: true } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const ServiceIcon = serviceIcons[card.serviceType];

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`kanban-card group cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50 shadow-xl z-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle (visual indicator) */}
        <div className="mt-1 text-muted-foreground">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Card Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{card.projectName}</h4>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs text-muted-foreground truncate">
                    {card.clientName}{card.contactName ? ` · ${card.contactName}` : ''}
                  </p>
                {card.isRecurring && (
                  <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide text-accent border border-accent/30 bg-accent/5 rounded px-1 py-0 leading-none h-4">
                    <Repeat className="w-2.5 h-2.5" />
                    Recorrente
                  </span>
                )}
              </div>
            </div>
            <ScoreBadge score={card.clientScore} size="sm" />
          </div>

          {/* Service Types - All Tags */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {card.serviceTypes.map((type) => {
              const Icon = serviceIcons[type] || Film;
              return (
                <span 
                  key={type} 
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs font-medium"
                >
                  <Icon className="w-3 h-3" />
                  {getCategoryLabel(type)}
                </span>
              );
            })}
            {card.currentVersion > 0 && (
              <span className="text-xs text-muted-foreground">
                V{card.currentVersion}
              </span>
            )}
          </div>

          {/* Rejection Info */}
          {card.status === 'nao_aprovada' && card.rejectionReason && (
            <div className="mb-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-destructive">{card.rejectionReason}</p>
                  {card.rejectionObservation && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{card.rejectionObservation}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Value, Execution Month & WhatsApp */}
          <div className="flex items-center justify-end flex-wrap gap-1">
            {card.value && !hideValue && (
              <span className="text-sm font-semibold text-accent mr-auto">
                {formatCurrency(card.value)}
              </span>
            )}
            {card.executionMonth ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                <Calendar className="w-2.5 h-2.5" />
                {formatExecutionMonth(card.executionMonth)}
              </Badge>
            ) : card.status === 'aprovada' ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-destructive/40 text-destructive bg-destructive/5" title="Mês de execução não definido">
                <AlertCircle className="w-2.5 h-2.5" />
                Sem mês de execução
              </Badge>
            ) : null}
            {card.contactPhone ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(waHref(card.contactPhone!), '_blank', 'noopener');
                }}
                className="text-success hover:text-success/80 transition-colors shrink-0"
                title={`WhatsApp de ${card.contactName || 'responsável'}`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span title="Responsável sem WhatsApp cadastrado" className="text-muted-foreground/40 shrink-0">
                <MessageCircle className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          {/* Actions (visible on hover) */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/crm/orcamento/${card.budgetId}`);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
            >
              <FileText className="w-3 h-3" />
              Ver orçamento
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setDuplicateOpen(true);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-colors"
              title="Duplicar para outros meses"
            >
              <Copy className="w-3 h-3" />
              Duplicar
            </button>
          </div>
        </div>
      </div>

      <DuplicateBudgetDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        budgetId={card.budgetId}
        projectName={card.projectName}
        baseExecutionMonth={card.executionMonth}
      />
    </motion.div>
  );
}
