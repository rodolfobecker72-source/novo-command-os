import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CRMCard, CRMStatus, formatCurrency } from '@/types/crm';
import { KanbanCard } from './KanbanCard';
import { motion } from 'framer-motion';
import { columnColorClasses } from '@/utils/kanbanColors';

interface KanbanColumnProps {
  status: CRMStatus;
  cards: CRMCard[];
  color: string;
  label?: string;
  hideValue?: boolean;
}

export function KanbanColumn({ status, cards, color, label, hideValue }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const colors = columnColorClasses(color);
  const total = cards.reduce((sum, c) => sum + (c.value || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[300px] w-[300px] rounded-xl ${colors.bg} border ${colors.border} ${
        isOver ? 'ring-2 ring-accent ring-offset-2' : ''
      } transition-all duration-200`}
    >
      {/* Column Header */}
      <div className={`p-4 border-b ${colors.border} ${colors.header} rounded-t-xl`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <h3 className="font-semibold text-sm">{label || status}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!hideValue && total > 0 && (
              <span className="text-[11px] font-semibold text-accent">{formatCurrency(total)}</span>
            )}
            <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full">
              {cards.length}
            </span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto scrollbar-thin max-h-[calc(100vh-250px)]">
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <KanbanCard card={card} hideValue={hideValue} />
            </motion.div>
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum projeto nesta etapa
          </div>
        )}
      </div>
    </div>
  );
}
