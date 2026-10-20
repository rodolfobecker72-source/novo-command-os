import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CRMCard, formatCurrency, waHref } from '@/types/crm';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar as CalendarIcon, GripVertical, Copy, AlertCircle, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DuplicateBudgetDialog } from './DuplicateBudgetDialog';

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function formatExecutionMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES_PT[idx] || month}/${year}`;
}

interface Props {
  card: CRMCard;
  hideValues?: boolean;
}

export function KanbanListRow({ card, hideValues }: Props) {
  const navigate = useNavigate();

  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    resizeObserverConfig: { disabled: true },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasValue = card.value !== undefined && card.value !== null && !hideValues;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
      <ScoreBadge score={card.clientScore} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{card.projectName}</span>
          {card.currentVersion > 0 && (
            <span className="text-[10px] text-muted-foreground">V{card.currentVersion}</span>
          )}
          {card.isRecurring && (
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide text-accent border border-accent/30 bg-accent/5 rounded px-1 py-0 leading-none h-4">
              <Copy className="w-2.5 h-2.5" />
              Recorrente
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{card.clientName}{card.contactName ? ` · ${card.contactName}` : ''}</p>
      </div>
      <div className="hidden md:flex items-center gap-1.5 flex-wrap">
        {card.serviceTypes.map((type) => (
          <Badge key={type} variant="outline" className="text-[10px]">
            {type}
          </Badge>
        ))}
      </div>
      {card.executionMonth ? (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 hidden sm:inline-flex">
          <CalendarIcon className="w-2.5 h-2.5" />
          {formatExecutionMonth(card.executionMonth)}
        </Badge>
      ) : card.status === 'aprovada' ? (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 hidden sm:inline-flex border-destructive/40 text-destructive bg-destructive/5" title="Mês de execução não definido">
          <AlertCircle className="w-2.5 h-2.5" />
          Sem mês
        </Badge>
      ) : null}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/crm/orcamento/${card.budgetId}`);
        }}
        className="text-muted-foreground hover:text-accent transition-colors shrink-0"
        title="Ver orçamento"
      >
        <FileText className="w-4 h-4" />
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setDuplicateOpen(true);
        }}
        className="text-muted-foreground hover:text-accent transition-colors shrink-0"
        title="Duplicar para outros meses"
      >
        <Copy className="w-4 h-4" />
      </button>
      {card.value !== undefined && card.value !== null && !hideValues && (
        <span className="text-sm font-semibold text-accent whitespace-nowrap ml-auto min-w-[110px] text-right">
          {formatCurrency(card.value)}
        </span>
      )}
      <span className={`shrink-0 ${hasValue ? '' : 'ml-auto'}`}>
        {card.contactPhone ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              window.open(waHref(card.contactPhone!), '_blank', 'noopener');
            }}
            className="text-success hover:text-success/80 transition-colors"
            title={`WhatsApp de ${card.contactName || 'responsável'}`}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        ) : (
          <span title="Responsável sem WhatsApp cadastrado" className="text-muted-foreground/40 inline-flex">
            <MessageCircle className="w-4 h-4" />
          </span>
        )}
      </span>
      <DuplicateBudgetDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        budgetId={card.budgetId}
        projectName={card.projectName}
        baseExecutionMonth={card.executionMonth}
      />
    </div>
  );
}
