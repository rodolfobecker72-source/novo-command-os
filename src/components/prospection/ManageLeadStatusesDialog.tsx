import { useState } from 'react';
import {
  DndContext, DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useProspection } from '@/contexts/ProspectionContext';
import {
  LeadStatus, LEAD_STATUS_COLORS, getStatusColor,
} from '@/types/prospection';


function ColorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[130px] rounded-xl text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[200]">
        {LEAD_STATUS_COLORS.map(c => (
          <SelectItem key={c.key} value={c.key}>
            <span className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${c.dot}`} />
              {c.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RoleSelect({ value, onChange }: { value: LeadStatusRole | null; onChange: (v: LeadStatusRole | null) => void }) {
  return (
    <Select value={value ?? ROLE_NONE} onValueChange={v => onChange(v === ROLE_NONE ? null : (v as LeadStatusRole))}>
      <SelectTrigger className="h-9 w-[180px] rounded-xl text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[200]">
        <SelectItem value={ROLE_NONE}>Sem comportamento</SelectItem>
        <SelectItem value="meeting">{LEAD_STATUS_ROLE_LABELS.meeting}</SelectItem>
        <SelectItem value="qualified">{LEAD_STATUS_ROLE_LABELS.qualified}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function SortableStatusRow({
  status, count, onLabel, onColor, onRole, onDelete,
}: {
  status: LeadStatus;
  count: number;
  onLabel: (v: string) => void;
  onColor: (v: string) => void;
  onRole: (v: LeadStatusRole | null) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
    resizeObserverConfig: { disabled: true },
  });
  const [label, setLabel] = useState(status.label);
  const color = getStatusColor(status.color);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border/60 bg-card"
    >
      <button
        type="button"
        className="text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className={`w-3 h-3 rounded-full ${color.dot}`} />
      <Input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => {
          const v = label.trim();
          if (!v) { setLabel(status.label); return; }
          if (v !== status.label) onLabel(v);
        }}
        className="h-9 rounded-xl text-sm flex-1 min-w-[140px]"
      />
      <ColorSelect value={status.color} onChange={onColor} />
      <RoleSelect value={status.role} onChange={onRole} />
      <span className="text-xs text-muted-foreground w-16 text-right">{count} lead{count === 1 ? '' : 's'}</span>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export function ManageLeadStatusesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { statuses, leads, addStatus, updateStatus, deleteStatus, reorderStatuses } = useProspection();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('slate');
  const [newRole, setNewRole] = useState<LeadStatusRole | null>(null);
  const [newPosition, setNewPosition] = useState<string>('end');
  const [deleting, setDeleting] = useState<LeadStatus | null>(null);
  const [moveTo, setMoveTo] = useState<string>('');

  const ordered = [...statuses].sort((a, b) => a.order - b.order);
  const countFor = (key: string) => leads.filter(l => l.funnelStatus === key).length;

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex(s => s.id === active.id);
    const newIndex = ordered.findIndex(s => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderStatuses(arrayMove(ordered, oldIndex, newIndex));
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) { toast.error('Informe o nome do status'); return; }
    const order = newPosition === 'end' ? ordered.length : Number(newPosition);
    await addStatus({ label: newLabel, color: newColor, role: newRole, order });
    setNewLabel('');
    setNewColor('slate');
    setNewRole(null);
    setNewPosition('end');
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (!moveTo) { toast.error('Escolha para qual status mover os leads'); return; }
    await deleteStatus(deleting.id, moveTo);
    setDeleting(null);
    setMoveTo('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar status dos leads</DialogTitle>
            <DialogDescription>
              Crie, renomeie, reordene (arrastando) e exclua os status do funil. O comportamento especial
              define onde o sistema pede a confirmação da reunião e onde aparece o botão de migrar para o CRM.
            </DialogDescription>
          </DialogHeader>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ordered.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {ordered.map(s => (
                  <SortableStatusRow
                    key={s.id}
                    status={s}
                    count={countFor(s.key)}
                    onLabel={v => updateStatus(s.id, { label: v })}
                    onColor={v => updateStatus(s.id, { color: v })}
                    onRole={v => updateStatus(s.id, { role: v })}
                    onDelete={() => {
                      if (ordered.length <= 1) { toast.error('É preciso manter ao menos um status'); return; }
                      setDeleting(s);
                      setMoveTo(ordered.find(o => o.id !== s.id)?.key || '');
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-4 p-4 rounded-xl border border-dashed space-y-3">
            <p className="text-sm font-medium">Novo status</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs">Nome</Label>
                <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex: Proposta Enviada" className="h-9 rounded-xl text-sm" />
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <ColorSelect value={newColor} onChange={setNewColor} />
              </div>
              <div>
                <Label className="text-xs">Posição</Label>
                <Select value={newPosition} onValueChange={setNewPosition}>
                  <SelectTrigger className="h-9 w-[200px] rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {ordered.map((s, i) => (
                      <SelectItem key={s.id} value={String(i)}>Antes de "{s.label}"</SelectItem>
                    ))}
                    <SelectItem value="end">No final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Comportamento</Label>
                <RoleSelect value={newRole} onChange={setNewRole} />
              </div>
              <Button onClick={handleCreate} className="gap-2 rounded-xl h-9">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={v => { if (!v) { setDeleting(null); setMoveTo(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir "{deleting?.label}"</DialogTitle>
            <DialogDescription>
              {deleting && countFor(deleting.key) > 0
                ? `${countFor(deleting.key)} lead(s) estão neste status. Escolha para onde movê-los.`
                : 'Nenhum lead está neste status.'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Mover leads para</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="z-[200]">
                {ordered.filter(s => s.id !== deleting?.id).map(s => (
                  <SelectItem key={s.id} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setDeleting(null); setMoveTo(''); }}>Cancelar</Button>
            <Button variant="destructive" className="rounded-xl" onClick={confirmDelete}>Excluir status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
