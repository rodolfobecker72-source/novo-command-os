import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export function SortablePaymentTermRow({ id, name, disabled, children }: {
  id: string; name: string; disabled: boolean; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id, disabled, resizeObserverConfig: { disabled: true },
  });
  return (
    <TableRow ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'relative z-10 bg-muted opacity-70' : undefined}>
      <TableCell className="w-10 px-2">
        <Button ref={setActivatorNodeRef} variant="ghost" size="icon" className="h-8 w-8 touch-none cursor-grab active:cursor-grabbing text-muted-foreground" disabled={disabled} {...attributes} {...listeners} aria-label={`Arrastar ${name}`} title="Arrastar para reordenar">
          <GripVertical className="h-4 w-4" />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
}