import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Trash2, Loader2, ExternalLink, Copy, User, Calendar, FileText, ChevronDown, ChevronRight, MessageSquare, Send, GripVertical, X, Eye, Share2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { syncActivityToGoogle } from '@/utils/googleCalendarSync';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ActivityStatus = 'nao_iniciado' | 'em_andamento' | 'concluido';

interface Activity {
  id: string;
  title: string;
  status: ActivityStatus;
  order: number;
  assignedToUserIds: string[];
  dueDate: string | null;
  endDate: string | null;
  isDelivery: boolean;
  isCaptacao: boolean;
  freelaName: string | null;
}

const MAX_ASSIGNEES = Infinity;

interface MemberOption {
  id: string;
  name: string;
  photoUrl: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCardId: string;
  projectName: string;
  /** 'page' renders full-screen content (no modal) with a back button. */
  variant?: 'dialog' | 'page';
  onBack?: () => void;
}

const COLUMNS: { key: ActivityStatus; label: string; dotClass: string; chipClass: string; colBg: string; cardBg: string; cardBorder: string; addText: string }[] = [
  { key: 'nao_iniciado', label: 'Não iniciado', dotClass: 'bg-muted-foreground', chipClass: 'bg-muted text-muted-foreground', colBg: 'bg-muted/40', cardBg: 'bg-background/60', cardBorder: 'border-border/60', addText: 'text-muted-foreground' },
  { key: 'em_andamento', label: 'Em andamento', dotClass: 'bg-info', chipClass: 'bg-info/15 text-info', colBg: 'bg-info/[0.06]', cardBg: 'bg-info/[0.08]', cardBorder: 'border-info/25', addText: 'text-info' },
  { key: 'concluido', label: 'Concluído', dotClass: 'bg-success', chipClass: 'bg-success/15 text-success', colBg: 'bg-success/[0.06]', cardBg: 'bg-success/[0.08]', cardBorder: 'border-success/25', addText: 'text-success' },
];

const UNASSIGNED = '__unassigned__';

function formatDateBR(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

export function ProjectActivitiesDialog({ open, onOpenChange, projectCardId, projectName, variant = 'dialog', onBack }: Props) {
  const { workspace, profile } = useAuth();
  const workspaceId = workspace?.id;
  const [comments, setComments] = useState<Array<{ id: string; userId: string; userName: string; photoUrl: string | null; text: string; createdAt: string; editedAt?: string | null; mentions?: string[]; readBy?: string[] }>>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pendingMentions, setPendingMentions] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitleByCol, setNewTitleByCol] = useState<Record<string, string>>({});
  const [newAssigneeByCol, setNewAssigneeByCol] = useState<Record<string, string>>({});
  const [newDueByCol, setNewDueByCol] = useState<Record<string, string>>({});
  const [newEndByCol, setNewEndByCol] = useState<Record<string, string>>({});
  const [newDeliveryByCol, setNewDeliveryByCol] = useState<Record<string, boolean>>({});
  const [newCaptacaoByCol, setNewCaptacaoByCol] = useState<Record<string, boolean>>({});
  const [newFreelaByCol, setNewFreelaByCol] = useState<Record<string, string>>({});
  const [expandedNewByCol, setExpandedNewByCol] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editingFreelaId, setEditingFreelaId] = useState<string | null>(null);
  const [editFreelaName, setEditFreelaName] = useState('');
  const [driveLinks, setDriveLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState('');
  const [savingDrive, setSavingDrive] = useState(false);
  const [briefing, setBriefing] = useState<{
    objective: string;
    projectDescription: string;
    description: string;
    services: Array<{ serviceType: string; objective: string; description: string; items: Array<{ description: string; quantity: number }> }>;
  } | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);

  const [reloadNonce, setReloadNonce] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useRealtimeSync({
    workspaceId: open ? workspaceId : null,
    tables: ['project_activities', 'project_cards'],
    onChange: () => setReloadNonce(n => n + 1),
  });

  useEffect(() => {
    if (!open || !projectCardId) return;
    let cancelled = false;
    setLoading(true);

    // Load drive link + briefing from commercial budget
    (async () => {
      const { data: card } = await supabase
        .from('project_cards')
        .select('material_link, material_links, budget_id, comments')
        .eq('id', projectCardId)
        .maybeSingle();
      const rawLinks = (card as any)?.material_links;
      const legacyLink = (card as any)?.material_link || '';
      const links: string[] = Array.isArray(rawLinks) && rawLinks.length > 0
        ? rawLinks.filter((l: any) => typeof l === 'string' && l.trim())
        : (legacyLink ? [legacyLink] : []);
      const cardComments = Array.isArray((card as any)?.comments) ? (card as any).comments : [];
      if (!cancelled) {
        setDriveLinks(links);
        setNewLink('');
        setComments(cardComments);
      }
      const budgetId = (card as any)?.budget_id;
      if (!budgetId) {
        if (!cancelled) setBriefing(null);
        return;
      }
      const { data: budget } = await supabase
        .from('budgets')
        .select('objective, project_description, description, approved_version, current_version')
        .eq('id', budgetId)
        .maybeSingle();
      if (!budget) {
        if (!cancelled) setBriefing(null);
        return;
      }
      const versionNumber = (budget as any).approved_version ?? (budget as any).current_version;
      let services: any[] = [];
      if (versionNumber != null) {
        const { data: ver } = await supabase
          .from('budget_versions')
          .select('services')
          .eq('budget_id', budgetId)
          .eq('version', versionNumber)
          .maybeSingle();
        services = ((ver as any)?.services || []) as any[];
      }
      const mappedServices = services.map((s: any) => ({
        serviceType: s.serviceType || '',
        objective: s.objective || '',
        description: s.description || '',
        items: (s.costs || []).map((c: any) => ({
          description: c.description || '',
          quantity: Number(c.quantity) || 0,
        })).filter((c: any) => c.description),
      }));
      if (!cancelled) {
        setBriefing({
          objective: (budget as any).objective || '',
          projectDescription: (budget as any).project_description || '',
          description: (budget as any).description || '',
          services: mappedServices,
        });
      }
    })();

    // Load workspace members (excluding vendedor)
    if (workspaceId) {
      (async () => {
        const { data: memberData } = await supabase
          .from('workspace_members')
          .select('user_id, role')
          .eq('workspace_id', workspaceId)
          .neq('role', 'vendedor');
        if (!memberData || memberData.length === 0) {
          setMembers([]);
          return;
        }
        const ids = memberData.map((m: any) => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, photo_url')
          .in('id', ids);
        const list: MemberOption[] = (profiles || [])
          .map((p: any) => ({ id: p.id, name: p.name || '', photoUrl: p.photo_url || null }))
          .filter((p) => p.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        if (!cancelled) setMembers(list);
      })();
    }

    // Load activities
    supabase
      .from('project_activities')
      .select('*')
      .eq('project_card_id', projectCardId)
      .order('order', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error('Erro ao carregar atividades');
        } else {
          setActivities((data || []).map((d: any) => ({
            id: d.id,
            title: d.title,
            status: d.status as ActivityStatus,
            order: d.order,
            assignedToUserIds: Array.isArray(d.assigned_to_user_ids) && d.assigned_to_user_ids.length > 0
              ? d.assigned_to_user_ids
              : (d.assigned_to_user_id ? [d.assigned_to_user_id] : []),
            dueDate: d.due_date ?? null,
            endDate: d.end_date ?? null,
            isDelivery: !!d.is_delivery,
            isCaptacao: !!d.is_captacao,
            freelaName: d.freela_name ?? null,
          })));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, projectCardId, workspaceId, reloadNonce]);

  const handlePostComment = async () => {
    const text = newComment.trim();
    if (!text || !profile?.id) return;
    setPostingComment(true);
    // Keep only mentions that actually still appear in the text by name token
    const validMentions = pendingMentions.filter(id => {
      const m = members.find(x => x.id === id);
      if (!m) return false;
      const first = (m.name.split(' ')[0] || '').toLowerCase();
      return first && text.toLowerCase().includes('@' + first);
    });
    const newEntry = {
      id: crypto.randomUUID(),
      userId: profile.id,
      userName: profile.name || 'Usuário',
      photoUrl: profile.photo_url || null,
      text,
      createdAt: new Date().toISOString(),
      mentions: validMentions,
      readBy: [] as string[],
    };
    const next = [...comments, newEntry];
    const { error } = await supabase
      .from('project_cards')
      .update({ comments: next as any })
      .eq('id', projectCardId);
    setPostingComment(false);
    if (error) {
      toast.error('Erro ao publicar comentário');
      return;
    }
    setComments(next);
    setNewComment('');
    setPendingMentions([]);
    setMentionQuery(null);
    if (validMentions.length > 0) {
      toast.success(`${validMentions.length} pessoa(s) marcada(s)`);
    }
  };

  const handleDeleteComment = async (id: string) => {
    const next = comments.filter(c => c.id !== id);
    const prev = comments;
    setComments(next);
    const { error } = await supabase
      .from('project_cards')
      .update({ comments: next as any })
      .eq('id', projectCardId);
    if (error) {
      setComments(prev);
      toast.error('Erro ao remover comentário');
    }
  };

  const handleStartEditComment = (id: string, text: string) => {
    setEditingCommentId(id);
    setEditingCommentText(text);
  };

  const handleSaveEditComment = async () => {
    if (!editingCommentId) return;
    const text = editingCommentText.trim();
    if (!text) {
      toast.error('Comentário não pode ficar vazio');
      return;
    }
    const prev = comments;
    const next = comments.map(c => c.id === editingCommentId ? { ...c, text, editedAt: new Date().toISOString() } : c);
    setComments(next);
    const { error } = await supabase
      .from('project_cards')
      .update({ comments: next as any })
      .eq('id', projectCardId);
    if (error) {
      setComments(prev);
      toast.error('Erro ao salvar comentário');
      return;
    }
    setEditingCommentId(null);
    setEditingCommentText('');
  };


  const persistLinks = async (links: string[]) => {
    setSavingDrive(true);
    const { error } = await supabase
      .from('project_cards')
      .update({ material_links: links as any, material_link: links[0] || '' })
      .eq('id', projectCardId);
    setSavingDrive(false);
    if (error) {
      toast.error('Erro ao salvar link');
      return false;
    }
    return true;
  };

  const handleAddLink = async () => {
    const url = newLink.trim();
    if (!url) return;
    if (driveLinks.includes(url)) {
      toast.error('Link já adicionado');
      return;
    }
    const next = [...driveLinks, url];
    const ok = await persistLinks(next);
    if (ok) {
      setDriveLinks(next);
      setNewLink('');
      toast.success('Link adicionado');
    }
  };

  const handleRemoveLink = async (index: number) => {
    const next = driveLinks.filter((_, i) => i !== index);
    const ok = await persistLinks(next);
    if (ok) setDriveLinks(next);
  };

  const grouped = useMemo(() => {
    const map: Record<ActivityStatus, Activity[]> = { nao_iniciado: [], em_andamento: [], concluido: [] };
    for (const a of [...activities].sort((a, b) => a.order - b.order)) {
      map[a.status].push(a);
    }
    return map;
  }, [activities]);

  const activeActivity = activities.find(a => a.id === activeId);

  const handleAdd = async (status: ActivityStatus) => {
    const title = (newTitleByCol[status] || '').trim();
    if (!title || !workspaceId) return;
    const order = (grouped[status].at(-1)?.order ?? -1) + 1;
    const assignee = newAssigneeByCol[status] && newAssigneeByCol[status] !== UNASSIGNED && newAssigneeByCol[status] !== '__freela__'
      ? newAssigneeByCol[status]
      : null;
    const ids = assignee ? [assignee] : [];
    const due = newDueByCol[status] || null;
    const endRaw = newEndByCol[status] || null;
    const end = endRaw && due && endRaw >= due ? endRaw : null;
    const isDelivery = !!newDeliveryByCol[status];
    const isCaptacao = !!newCaptacaoByCol[status];
    const freelaName = newAssigneeByCol[status] === '__freela__' ? (newFreelaByCol[status] || '').trim() : null;
    const { data, error } = await supabase
      .from('project_activities')
      .insert({
        workspace_id: workspaceId,
        project_card_id: projectCardId,
        title,
        status,
        order,
        assigned_to_user_id: assignee,
        assigned_to_user_ids: ids,
        due_date: due,
        end_date: end,
        is_delivery: isDelivery,
        is_captacao: isCaptacao,
        freela_name: freelaName || null,
      } as any)
      .select()
      .single();
    if (error || !data) {
      toast.error('Erro ao criar atividade');
      return;
    }
    setActivities(prev => [...prev, {
      id: data.id,
      title: data.title,
      status: data.status as ActivityStatus,
      order: data.order,
      assignedToUserIds: Array.isArray((data as any).assigned_to_user_ids) && (data as any).assigned_to_user_ids.length > 0
        ? (data as any).assigned_to_user_ids
        : ((data as any).assigned_to_user_id ? [(data as any).assigned_to_user_id] : []),
      dueDate: (data as any).due_date ?? null,
      endDate: (data as any).end_date ?? null,
      isDelivery: !!(data as any).is_delivery,
      isCaptacao: !!(data as any).is_captacao,
      freelaName: (data as any).freela_name ?? null,
    }]);
    setNewTitleByCol(prev => ({ ...prev, [status]: '' }));
    setNewAssigneeByCol(prev => ({ ...prev, [status]: '' }));
    setNewDueByCol(prev => ({ ...prev, [status]: '' }));
    setNewEndByCol(prev => ({ ...prev, [status]: '' }));
    setNewDeliveryByCol(prev => ({ ...prev, [status]: false }));
    setNewCaptacaoByCol(prev => ({ ...prev, [status]: false }));
    setNewFreelaByCol(prev => ({ ...prev, [status]: '' }));
    setExpandedNewByCol(prev => ({ ...prev, [status]: false }));
    syncActivityToGoogle(data.id, 'upsert');
  };

  const handleDelete = async (id: string) => {
    const prev = activities;
    setActivities(p => p.filter(a => a.id !== id));
    const { error } = await supabase.from('project_activities').delete().eq('id', id);
    if (error) {
      setActivities(prev);
      toast.error('Erro ao remover atividade');
      return;
    }
    syncActivityToGoogle(id, 'delete');
  };

  const handleSaveEdit = async (id: string) => {
    const title = editTitle.trim();
    setEditingId(null);
    if (!title) return;
    const original = activities.find(a => a.id === id);
    if (!original || original.title === title) return;
    setActivities(prev => prev.map(a => a.id === id ? { ...a, title } : a));
    const { error } = await supabase.from('project_activities').update({ title }).eq('id', id);
    if (error) toast.error('Erro ao atualizar atividade');
  };

  const handleToggleAssignee = async (id: string, userId: string | null) => {
    const current = activities.find(a => a.id === id);
    if (!current) return;
    let nextIds: string[];
    if (userId === null) {
      nextIds = [];
    } else if (current.assignedToUserIds.includes(userId)) {
      nextIds = current.assignedToUserIds.filter(u => u !== userId);
    } else {
      if (current.assignedToUserIds.length >= MAX_ASSIGNEES) {
        toast.error(`Máximo de ${MAX_ASSIGNEES} responsáveis por tarefa`);
        return;
      }
      nextIds = [...current.assignedToUserIds, userId];
    }
    setActivities(prev => prev.map(a => a.id === id ? { ...a, assignedToUserIds: nextIds } : a));
    const { error } = await supabase
      .from('project_activities')
      .update({
        assigned_to_user_ids: nextIds,
        assigned_to_user_id: nextIds[0] ?? null,
      } as any)
      .eq('id', id);
    if (error) toast.error('Erro ao atualizar responsáveis');
    else syncActivityToGoogle(id, 'upsert');
  };

  const handleUpdateDue = async (id: string, due: string | null) => {
    setActivities(prev => prev.map(a => {
      if (a.id !== id) return a;
      const nextEnd = a.endDate && due && a.endDate >= due ? a.endDate : null;
      return { ...a, dueDate: due, endDate: nextEnd };
    }));
    const target = activities.find(a => a.id === id);
    const nextEnd = target?.endDate && due && target.endDate >= due ? target.endDate : null;
    const { error } = await supabase
      .from('project_activities')
      .update({ due_date: due, end_date: nextEnd } as any)
      .eq('id', id);
    if (error) toast.error('Erro ao atualizar prazo');
    else syncActivityToGoogle(id, 'upsert');
  };

  const handleUpdateEnd = async (id: string, end: string | null) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, endDate: end } : a));
    const { error } = await supabase
      .from('project_activities')
      .update({ end_date: end } as any)
      .eq('id', id);
    if (error) toast.error('Erro ao atualizar data final');
    else syncActivityToGoogle(id, 'upsert');
  };

  const handleUpdateDelivery = async (id: string, value: boolean) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, isDelivery: value } : a));
    const { error } = await supabase
      .from('project_activities')
      .update({ is_delivery: value } as any)
      .eq('id', id);
    if (error) toast.error('Erro ao atualizar entrega');
    else syncActivityToGoogle(id, 'upsert');
  };

  const handleUpdateCaptacao = async (id: string, value: boolean) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, isCaptacao: value } : a));
    const { error } = await supabase
      .from('project_activities')
      .update({ is_captacao: value } as any)
      .eq('id', id);
    if (error) toast.error('Erro ao atualizar captação');
    else syncActivityToGoogle(id, 'upsert');
  };



  const handleUpdateFreela = async (id: string, name: string | null) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, freelaName: name } : a));
    const { error } = await supabase
      .from('project_activities')
      .update({ freela_name: name } as any)
      .eq('id', id);
    if (error) toast.error('Erro ao atualizar freela');
  };

  const persistOrder = async (next: Activity[]) => {
    const updates = next.map((a, idx) => ({ id: a.id, status: a.status, order: idx }));
    setActivities(next.map((a, idx) => ({ ...a, order: idx })));
    await Promise.all(
      updates.map(u =>
        supabase.from('project_activities').update({ status: u.status, order: u.order }).eq('id', u.id)
      )
    );
  };

  const findColumnOf = (id: string): ActivityStatus | null => {
    const a = activities.find(x => x.id === id);
    if (a) return a.status;
    if (id === 'nao_iniciado' || id === 'em_andamento' || id === 'concluido') return id;
    return null;
  };

  const collisionDetection = (args: any) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    const intersecting = rectIntersection(args);
    if (intersecting.length > 0) return intersecting;
    return closestCorners(args);
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const fromCol = findColumnOf(activeIdStr);
    const toCol = findColumnOf(overIdStr);
    if (!fromCol || !toCol) return;

    const rebuild = (mutator: (g: Record<ActivityStatus, Activity[]>) => void) => {
      const g: Record<ActivityStatus, Activity[]> = {
        nao_iniciado: [...grouped.nao_iniciado],
        em_andamento: [...grouped.em_andamento],
        concluido: [...grouped.concluido],
      };
      mutator(g);
      const flat: Activity[] = [];
      for (const col of COLUMNS) flat.push(...g[col.key].map(a => ({ ...a, status: col.key })));
      return flat;
    };

    if (fromCol === toCol) {
      const list = grouped[fromCol];
      const oldIdx = list.findIndex(a => a.id === activeIdStr);
      const newIdx = overIdStr === fromCol
        ? list.length - 1
        : list.findIndex(a => a.id === overIdStr);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const next = rebuild(g => { g[fromCol] = arrayMove(list, oldIdx, newIdx); });
      persistOrder(next);
    } else {
      const next = rebuild(g => {
        g[fromCol] = g[fromCol].filter(a => a.id !== activeIdStr);
        const moved = activities.find(a => a.id === activeIdStr);
        if (!moved) return;
        const insertAt = overIdStr === toCol
          ? g[toCol].length
          : g[toCol].findIndex(a => a.id === overIdStr);
        const movedUpdated = { ...moved, status: toCol };
        if (insertAt < 0) g[toCol].push(movedUpdated);
        else g[toCol].splice(insertAt, 0, movedUpdated);
      });
      persistOrder(next);
    }
  };

  const totalCount = activities.length;
  const doneCount = activities.filter(a => a.status === 'concluido').length;
  const inProgressCount = activities.filter(a => a.status === 'em_andamento').length;
  const notStartedCount = totalCount - doneCount - inProgressCount;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const progressPanel = (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CheckCircle2 className={cn('w-4 h-4', pct === 100 ? 'text-success' : 'text-muted-foreground')} />
          <span className="text-sm font-semibold">Andamento do projeto</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-2xl font-bold tabular-nums', pct === 100 ? 'text-success' : 'text-primary')}>{pct}%</span>
          <span className="text-xs text-muted-foreground">{doneCount} de {totalCount} atividades concluídas</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all', pct === 100 ? 'bg-success' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-lg font-semibold tabular-nums">{notStartedCount}</p>
          <p className="text-[11px] text-muted-foreground">Não iniciado</p>
        </div>
        <div className="rounded-lg bg-info/[0.08] px-3 py-2">
          <p className="text-lg font-semibold tabular-nums text-info">{inProgressCount}</p>
          <p className="text-[11px] text-muted-foreground">Em andamento</p>
        </div>
        <div className="rounded-lg bg-success/[0.08] px-3 py-2">
          <p className="text-lg font-semibold tabular-nums text-success">{doneCount}</p>
          <p className="text-[11px] text-muted-foreground">Concluído</p>
        </div>
      </div>
    </div>
  );

  const inner = (
      <>
        {progressPanel}



        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={newLink}
              onChange={e => setNewLink(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
              placeholder="Cole um link (Drive, Dropbox, Frame.io, etc.) e clique em Adicionar"
              className="h-9 flex-1"
            />
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0"
              onClick={handleAddLink}
              disabled={savingDrive || !newLink.trim()}
            >
              {savingDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
            </Button>
          </div>
          {driveLinks.length > 0 && (
            <ul className="space-y-1">
              {driveLinks.map((url, i) => (
                <li key={i} className="flex items-center gap-2 text-sm border border-border rounded px-2 py-1">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate hover:text-primary hover:underline"
                    title={url}
                  >
                    {url}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Copiar link"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success('Link copiado');
                      } catch {
                        toast.error('Não foi possível copiar');
                      }
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    title="Remover link"
                    onClick={() => handleRemoveLink(i)}
                    disabled={savingDrive}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>



        {briefing && (briefing.objective || briefing.projectDescription || briefing.description || briefing.services.length > 0) && (
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setBriefingOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              {briefingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Briefing e entregas do projeto</span>
            </button>
            {briefingOpen && (
              <div className="p-4 space-y-4 text-sm">
                {briefing.objective && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Objetivo</p>
                    <p className="whitespace-pre-wrap">{briefing.objective}</p>
                  </div>
                )}
                {briefing.projectDescription && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Descrição do projeto</p>
                    <p className="whitespace-pre-wrap">{briefing.projectDescription}</p>
                  </div>
                )}
                {briefing.services.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Entregas</p>
                    {briefing.services.map((s, i) => (
                      <div key={i} className="border border-border/60 rounded-md p-3 space-y-2 bg-card">
                        {(s.serviceType || s.objective) && (
                          <div className="flex flex-wrap gap-2 items-baseline">
                            {s.serviceType && (
                              <span className="text-sm font-semibold capitalize">{s.serviceType}</span>
                            )}
                            {s.objective && (
                              <span className="text-xs text-muted-foreground">· {s.objective}</span>
                            )}
                          </div>
                        )}
                        {s.description && (
                          <p className="text-xs whitespace-pre-wrap text-muted-foreground">{s.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {COLUMNS.map(col => (
                <Column
                  key={col.key}
                  col={col}
                  activities={grouped[col.key]}
                  members={members}
                  newTitle={newTitleByCol[col.key] || ''}
                  newAssignee={newAssigneeByCol[col.key] || ''}
                  newDue={newDueByCol[col.key] || ''}
                  newEnd={newEndByCol[col.key] || ''}
                  newDelivery={!!newDeliveryByCol[col.key]}
                  newCaptacao={!!newCaptacaoByCol[col.key]}
                  newFreela={newFreelaByCol[col.key] || ''}
                  expanded={!!expandedNewByCol[col.key]}
                  onExpand={() => setExpandedNewByCol(prev => ({ ...prev, [col.key]: true }))}
                  onCancelExpand={() => {
                    setExpandedNewByCol(prev => ({ ...prev, [col.key]: false }));
                    setNewTitleByCol(prev => ({ ...prev, [col.key]: '' }));
                    setNewAssigneeByCol(prev => ({ ...prev, [col.key]: '' }));
                    setNewDueByCol(prev => ({ ...prev, [col.key]: '' }));
                    setNewEndByCol(prev => ({ ...prev, [col.key]: '' }));
                    setNewDeliveryByCol(prev => ({ ...prev, [col.key]: false }));
                    setNewCaptacaoByCol(prev => ({ ...prev, [col.key]: false }));
                    setNewFreelaByCol(prev => ({ ...prev, [col.key]: '' }));
                  }}
                  onNewTitle={(v) => setNewTitleByCol(prev => ({ ...prev, [col.key]: v }))}
                  onNewAssignee={(v) => setNewAssigneeByCol(prev => ({ ...prev, [col.key]: v }))}
                  onNewDue={(v) => setNewDueByCol(prev => ({ ...prev, [col.key]: v }))}
                  onNewEnd={(v) => setNewEndByCol(prev => ({ ...prev, [col.key]: v }))}
                  onNewDelivery={(v) => setNewDeliveryByCol(prev => ({ ...prev, [col.key]: v }))}
                  onNewCaptacao={(v) => setNewCaptacaoByCol(prev => ({ ...prev, [col.key]: v }))}
                  onNewFreela={(v) => setNewFreelaByCol(prev => ({ ...prev, [col.key]: v }))}
                  onAdd={() => handleAdd(col.key)}
                  onDelete={handleDelete}
                  editingId={editingId}
                  editTitle={editTitle}
                  onStartEdit={(id, title) => { setEditingId(id); setEditTitle(title); }}
                  onChangeEdit={setEditTitle}
                  onSaveEdit={handleSaveEdit}
                  onToggleAssignee={handleToggleAssignee}
                  onUpdateDue={handleUpdateDue}
                  onUpdateEnd={handleUpdateEnd}
                  onUpdateDelivery={handleUpdateDelivery}
                  onUpdateCaptacao={handleUpdateCaptacao}
                  onUpdateFreela={handleUpdateFreela}
                />
              ))}
            </div>
            <DragOverlay>
              {activeActivity && <ActivityCard activity={activeActivity} members={members} dragging />}
            </DragOverlay>
          </DndContext>
        )}

        {/* Comentários do projeto */}
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Comentários do projeto</span>
            <span className="text-xs text-muted-foreground">({comments.length})</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum comentário ainda. Seja o primeiro!</p>
            ) : (
              [...comments]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map(c => {
                  const initials = (c.userName || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                  const isMine = c.userId === profile?.id;
                  return (
                    <div key={c.id} className="flex gap-2 group">
                      <Avatar className="w-7 h-7 shrink-0">
                        {c.photoUrl && <AvatarImage src={c.photoUrl} alt={c.userName} />}
                        <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 bg-muted/40 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-semibold truncate">{c.userName}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(c.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              {c.editedAt && <span className="ml-1 italic">(editado)</span>}
                            </span>
                            {isMine && editingCommentId !== c.id && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditComment(c.id, c.text)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition"
                                  title="Editar"
                                >
                                  <FileText className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                                  title="Remover"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {editingCommentId === c.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') { e.preventDefault(); setEditingCommentId(null); setEditingCommentText(''); }
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSaveEditComment(); }
                              }}
                              className="min-h-[60px] text-sm"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => { setEditingCommentId(null); setEditingCommentText(''); }}>Cancelar</Button>
                              <Button size="sm" onClick={handleSaveEditComment}>Salvar</Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {c.text.split(/(@[\p{L}\d_]+)/u).map((part, i) =>
                              part.startsWith('@')
                                ? <span key={i} className="text-primary font-medium bg-primary/10 rounded px-1">{part}</span>
                                : <span key={i}>{part}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <div className="pt-2 border-t border-border/50 space-y-2">
            <p className="text-[10px] text-muted-foreground">Use <span className="font-mono bg-muted px-1 rounded">@</span> para marcar alguém do time.</p>
            <div className="flex gap-2 items-end relative">
              <div className="flex-1 relative">
                <Textarea
                  value={newComment}
                  onChange={e => {
                    const val = e.target.value;
                    setNewComment(val);
                    const caret = e.target.selectionStart ?? val.length;
                    const before = val.slice(0, caret);
                    const m = before.match(/@([\p{L}\d_]*)$/u);
                    setMentionQuery(m ? m[1] : null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && mentionQuery !== null) {
                      e.preventDefault();
                      setMentionQuery(null);
                      return;
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handlePostComment();
                    }
                  }}
                  placeholder="Escreva um comentário... (Ctrl+Enter para enviar)"
                  className="min-h-[60px] max-h-[400px] text-sm w-full resize-y"
                />
                {mentionQuery !== null && (() => {
                  const q = mentionQuery.toLowerCase();
                  const filtered = members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6);
                  if (filtered.length === 0) return null;
                  return (
                    <div className="absolute bottom-full left-0 mb-1 z-50 w-64 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/50">Marcar pessoa</div>
                      <ul className="max-h-56 overflow-y-auto">
                        {filtered.map(m => {
                          const initials = (m.name || '?').split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();
                          return (
                            <li key={m.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  const first = (m.name.split(' ')[0] || '').replace(/\s+/g, '');
                                  setNewComment(prev => prev.replace(/@([\p{L}\d_]*)$/u, `@${first} `));
                                  setPendingMentions(prev => prev.includes(m.id) ? prev : [...prev, m.id]);
                                  setMentionQuery(null);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent text-left"
                              >
                                <Avatar className="w-6 h-6">
                                  {m.photoUrl && <AvatarImage src={m.photoUrl} alt={m.name} />}
                                  <AvatarFallback className="text-[9px] bg-muted">{initials}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs truncate">{m.name}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}
              </div>
              <Button
                type="button"
                size="icon"
                onClick={handlePostComment}
                disabled={!newComment.trim() || postingComment}
                className="h-9 w-9 shrink-0"
              >
                {postingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </>
  );

  if (variant === 'page') {
    if (!open) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={() => (onBack ? onBack() : onOpenChange(false))}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Voltar para projetos
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{projectName}</h1>
            <p className="text-xs text-muted-foreground">Atividades do projeto</p>
          </div>
        </div>
        {inner}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atividades do projeto</DialogTitle>
          <DialogDescription className="truncate">{projectName}</DialogDescription>
        </DialogHeader>
        {inner}
      </DialogContent>
    </Dialog>
  );

}

function Column({
  col,
  activities,
  members,
  newTitle,
  newAssignee,
  newDue,
  newEnd,
  newDelivery,
  newCaptacao,
  newFreela,
  expanded,
  onExpand,
  onCancelExpand,
  onNewTitle,
  onNewAssignee,
  onNewDue,
  onNewEnd,
  onNewDelivery,
  onNewCaptacao,
  onNewFreela,
  onAdd,
  onDelete,
  editingId,
  editTitle,
  onStartEdit,
  onChangeEdit,
  onSaveEdit,
  onToggleAssignee,
  onUpdateDue,
  onUpdateEnd,
  onUpdateDelivery,
  onUpdateCaptacao,
  onUpdateFreela,
}: {
  col: { key: ActivityStatus; label: string; dotClass: string; chipClass: string; colBg: string; cardBg: string; cardBorder: string; addText: string };
  activities: Activity[];
  members: MemberOption[];
  newTitle: string;
  newAssignee: string;
  newDue: string;
  newEnd: string;
  newDelivery: boolean;
  newCaptacao: boolean;
  newFreela: string;
  expanded: boolean;
  onExpand: () => void;
  onCancelExpand: () => void;
  onNewTitle: (v: string) => void;
  onNewAssignee: (v: string) => void;
  onNewDue: (v: string) => void;
  onNewEnd: (v: string) => void;
  onNewDelivery: (v: boolean) => void;
  onNewCaptacao: (v: boolean) => void;
  onNewFreela: (v: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  editTitle: string;
  onStartEdit: (id: string, title: string) => void;
  onChangeEdit: (v: string) => void;
  onSaveEdit: (id: string) => void;
  onToggleAssignee: (id: string, userId: string | null) => void;
  onUpdateDue: (id: string, due: string | null) => void;
  onUpdateEnd: (id: string, end: string | null) => void;
  onUpdateDelivery: (id: string, value: boolean) => void;
  onUpdateCaptacao: (id: string, value: boolean) => void;
  onUpdateFreela: (id: string, name: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-xl p-3 flex flex-col gap-3 min-h-[260px] transition-colors',
        col.colBg,
        isOver && 'ring-2 ring-primary/40'
      )}
    >
      <div className={cn('inline-flex items-center gap-2 self-start px-2.5 py-0.5 rounded-full text-xs font-medium', col.chipClass)}>
        <span className={cn('w-2 h-2 rounded-full', col.dotClass)} />
        {col.label}
        <span className="opacity-60">({activities.length})</span>
      </div>

      <SortableContext items={activities.map(a => a.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {activities.map(a => (
            <SortableCard
              key={a.id}
              activity={a}
              members={members}
              col={col}
              isEditing={editingId === a.id}
              editTitle={editTitle}
              onChangeEdit={onChangeEdit}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onDelete={onDelete}
              onToggleAssignee={onToggleAssignee}
              onUpdateDue={onUpdateDue}
              onUpdateEnd={onUpdateEnd}
              onUpdateDelivery={onUpdateDelivery}
              onUpdateCaptacao={onUpdateCaptacao}
              onUpdateFreela={onUpdateFreela}
            />
          ))}
        </div>
      </SortableContext>

      {/* Inline new-task card matching task style */}
      {!expanded ? (
        <button
          type="button"
          onClick={onExpand}
          className={cn(
            'rounded-lg border border-dashed p-3 flex items-center gap-2 text-sm font-semibold transition-colors hover:bg-foreground/[0.03]',
            col.cardBorder,
            col.cardBg,
            col.addText
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          Nova tarefa
        </button>
      ) : (
        <div className={cn('rounded-lg border border-dashed p-3 flex flex-col gap-2', col.cardBorder, col.cardBg)}>
          <div className="flex items-center gap-2">
            <Plus className={cn('w-4 h-4 shrink-0', col.addText)} />
            <Input
              autoFocus
              value={newTitle}
              onChange={e => onNewTitle(e.target.value)}
              placeholder="Nova tarefa"
              className={cn('h-7 border-0 bg-transparent px-0 text-sm font-semibold placeholder:font-normal focus-visible:ring-0 focus-visible:ring-offset-0', col.addText, 'placeholder:' + col.addText)}
              onKeyDown={e => { if (e.key === 'Enter') onAdd(); if (e.key === 'Escape') onCancelExpand(); }}
            />
            <button
              type="button"
              onClick={onCancelExpand}
              className="text-muted-foreground hover:text-foreground"
              title="Cancelar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3.5 h-3.5 shrink-0" />
            <Select value={newAssignee || UNASSIGNED} onValueChange={onNewAssignee}>
              <SelectTrigger className="h-6 border-0 bg-transparent px-0 text-xs text-muted-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                <SelectValue placeholder="Add Responsável" />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value={UNASSIGNED}>Sem responsável</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
                <SelectItem value="__freela__">Freela</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {newAssignee === '__freela__' && (
            <Input
              value={newFreela}
              onChange={e => onNewFreela(e.target.value)}
              placeholder="Nome do freela"
              className="h-7 text-xs bg-background/70 w-full"
            />
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newCaptacao}
              onChange={e => onNewCaptacao(e.target.checked)}
              className="h-3.5 w-3.5 accent-red-500"
            />
            <span className={cn(newCaptacao && 'text-red-600 font-medium')}>Marcar como captação</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newDelivery}
              onChange={e => {
                const checked = e.target.checked;
                onNewDelivery(checked);
                if (checked) onNewEnd('');
              }}
              className="h-3.5 w-3.5 accent-blue-500"
            />
            Marcar como entrega
          </label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className={cn('w-3.5 h-3.5 shrink-0', newDelivery && 'text-blue-500')} />
            <input
              type="date"
              value={newDue}
              onChange={e => onNewDue(e.target.value)}
              className={cn(
                'bg-transparent outline-none cursor-pointer hover:text-foreground transition-colors text-muted-foreground',
                newDelivery && 'text-blue-600 font-medium'
              )}
              placeholder={newDelivery ? 'Data de entrega' : 'Início'}
            />
            {!newDelivery && (
              <>
                <span className="opacity-60">→</span>
                <input
                  type="date"
                  value={newEnd}
                  min={newDue || undefined}
                  onChange={e => onNewEnd(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer hover:text-foreground transition-colors text-muted-foreground"
                  placeholder="Fim"
                />
              </>
            )}
          </div>
          {newTitle.trim() && (
            <Button size="sm" className="h-7 text-xs mt-1" onClick={onAdd}>
              Adicionar tarefa
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SortableCard({
  activity,
  members,
  col,
  isEditing,
  editTitle,
  onChangeEdit,
  onStartEdit,
  onSaveEdit,
  onDelete,
  onToggleAssignee,
  onUpdateDue,
  onUpdateEnd,
  onUpdateDelivery,
  onUpdateCaptacao,
  onUpdateFreela,
}: {
  activity: Activity;
  members: MemberOption[];
  col: { key: ActivityStatus; label: string; dotClass: string; chipClass: string; colBg: string; cardBg: string; cardBorder: string; addText: string };
  isEditing: boolean;
  editTitle: string;
  onChangeEdit: (v: string) => void;
  onStartEdit: (id: string, title: string) => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleAssignee: (id: string, userId: string | null) => void;
  onUpdateDue: (id: string, due: string | null) => void;
  onUpdateEnd: (id: string, end: string | null) => void;
  onUpdateDelivery: (id: string, value: boolean) => void;
  onUpdateCaptacao: (id: string, value: boolean) => void;
  onUpdateFreela: (id: string, name: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
    resizeObserverConfig: { disabled: true },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOverdue = activity.dueDate && activity.status !== 'concluido' && activity.dueDate < new Date().toISOString().slice(0, 10);

  const assignees = activity.assignedToUserIds
    .map(uid => members.find(m => m.id === uid))
    .filter((m): m is MemberOption => !!m);
  const atMax = activity.assignedToUserIds.length >= MAX_ASSIGNEES;
  const hasFreela = !!activity.freelaName;

  const [freelaInput, setFreelaInput] = useState(activity.freelaName || '');
  useEffect(() => { setFreelaInput(activity.freelaName || ''); }, [activity.freelaName]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border text-sm flex transition-colors overflow-hidden',
        col.cardBg,
        col.cardBorder,
        'hover:border-primary/40',
        activity.isCaptacao && 'border-l-4 border-l-red-500',
        isDragging && 'ring-2 ring-primary/40 shadow-lg',
      )}
    >
      {/* Full-height drag handle strip */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          'shrink-0 w-7 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none',
          'bg-foreground/[0.04] hover:bg-foreground/10 text-muted-foreground hover:text-foreground',
          'border-r border-border/50 transition-colors',
        )}
        title="Arrastar para mover"
        aria-label="Arrastar atividade"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDelete(activity.id)}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            title="Remover"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Title */}
        <div className="flex items-start gap-2 pr-6">
          <FileText className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />

        {isEditing ? (
          <Input
            autoFocus
            value={editTitle}
            onChange={e => onChangeEdit(e.target.value)}
            onBlur={() => onSaveEdit(activity.id)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSaveEdit(activity.id);
              if (e.key === 'Escape') onSaveEdit(activity.id);
            }}
            className="h-7 flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => onStartEdit(activity.id, activity.title)}
            className={cn(
              'text-left flex-1 font-semibold leading-tight cursor-text break-words',
              activity.status === 'concluido' && 'line-through text-muted-foreground'
            )}
            title={activity.title}
          >
            {activity.title}
          </button>
        )}
      </div>

      {/* Responsáveis */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-0.5 py-0.5 rounded hover:bg-foreground/5"
          >
            {assignees.length > 0 || hasFreela ? (
              <>
                <div className="flex -space-x-1.5">
                  {assignees.map(a => {
                    const aInit = a.name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
                    return (
                      <Avatar key={a.id} className="w-5 h-5 ring-1 ring-card">
                        {a.photoUrl && <AvatarImage src={a.photoUrl} alt={a.name} />}
                        <AvatarFallback className="text-[9px] bg-muted">{aInit}</AvatarFallback>
                      </Avatar>
                    );
                  })}
                  {hasFreela && (
                    <Avatar className="w-5 h-5 ring-1 ring-card bg-amber-100">
                      <AvatarFallback className="text-[9px] text-amber-700 font-bold">F</AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <span className="truncate">
                  {hasFreela && assignees.length === 0 ? activity.freelaName : assignees.length === 1 ? assignees[0].name : assignees.length > 1 ? `${assignees.length} responsáveis` : ''}
                  {hasFreela && assignees.length > 0 ? ` · ${activity.freelaName}` : ''}
                </span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Add Responsável</span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-1 z-[200]" align="start">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Até {MAX_ASSIGNEES} responsáveis
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => onToggleAssignee(activity.id, null)}
              className={cn(
                'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted',
                activity.assignedToUserIds.length === 0 && 'bg-muted'
              )}
            >
              Sem responsável
            </button>
            {members.map(m => {
              const mInitials = m.name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
              const selected = activity.assignedToUserIds.includes(m.id);
              const disabled = !selected && atMax;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggleAssignee(activity.id, m.id)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2',
                    selected && 'bg-muted',
                    disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <Avatar className="w-5 h-5">
                    {m.photoUrl && <AvatarImage src={m.photoUrl} alt={m.name} />}
                    <AvatarFallback className="text-[9px] bg-muted-foreground/20">{mInitials}</AvatarFallback>
                  </Avatar>
                  <span className="truncate flex-1">{m.name}</span>
                  {selected && <span className="text-[10px] text-primary">✓</span>}
                </button>
              );
            })}
            <div className="border-t border-border my-1" />
            <div className="px-2 py-1 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Freela</div>
              <div className="flex gap-1">
                <Input
                  value={freelaInput}
                  onChange={e => setFreelaInput(e.target.value)}
                  placeholder="Nome do freela"
                  className="h-7 text-xs flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    onUpdateFreela(activity.id, freelaInput.trim() || null);
                  }}
                >
                  OK
                </Button>
              </div>
              {activity.freelaName && (
                <button
                  type="button"
                  onClick={() => onUpdateFreela(activity.id, null)}
                  className="text-[10px] text-muted-foreground hover:text-destructive underline"
                >
                  Remover freela
                </button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Date */}
      <div className={cn('flex items-center gap-2 text-xs flex-wrap', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
        <Calendar className={cn('w-3.5 h-3.5 shrink-0', activity.isDelivery && 'text-blue-500')} />
        <input
          type="date"
          value={activity.dueDate || ''}
          onChange={(e) => onUpdateDue(activity.id, e.target.value || null)}
          className="bg-transparent outline-none cursor-pointer hover:text-foreground transition-colors"
          placeholder="Início"
        />
        <span className="opacity-60">→</span>
        <input
          type="date"
          value={activity.endDate || ''}
          min={activity.dueDate || undefined}
          onChange={(e) => onUpdateEnd(activity.id, e.target.value || null)}
          className="bg-transparent outline-none cursor-pointer hover:text-foreground transition-colors"
          placeholder="Fim"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={activity.isCaptacao}
          onChange={(e) => onUpdateCaptacao(activity.id, e.target.checked)}
          className="h-3.5 w-3.5 accent-red-500"
        />
        <span className={cn(activity.isCaptacao && 'text-red-600 font-medium')}>Captação</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={activity.isDelivery}
          onChange={(e) => onUpdateDelivery(activity.id, e.target.checked)}
          className="h-3.5 w-3.5 accent-blue-500"
        />
        <span className={cn(activity.isDelivery && 'text-blue-600 font-medium')}>Entrega</span>
      </label>
      </div>
    </div>
  );
}

function ActivityCard({ activity, members, dragging }: { activity: Activity; members: MemberOption[]; dragging?: boolean }) {
  const assignees = activity.assignedToUserIds
    .map(uid => members.find(m => m.id === uid))
    .filter((m): m is MemberOption => !!m);
  const hasFreela = !!activity.freelaName;
  return (
    <div className={cn('rounded-lg border bg-card p-3 text-sm shadow-lg flex flex-col gap-2', dragging && 'rotate-2')}>
      <div className="font-semibold leading-tight">{activity.title}</div>
      {(assignees.length > 0 || hasFreela) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex -space-x-1.5">
            {assignees.map(a => {
              const init = a.name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
              return (
                <Avatar key={a.id} className="w-5 h-5 ring-1 ring-card">
                  {a.photoUrl && <AvatarImage src={a.photoUrl} alt={a.name} />}
                  <AvatarFallback className="text-[9px] bg-muted">{init}</AvatarFallback>
                </Avatar>
              );
            })}
            {hasFreela && (
              <Avatar className="w-5 h-5 ring-1 ring-card bg-amber-100">
                <AvatarFallback className="text-[9px] text-amber-700 font-bold">F</AvatarFallback>
              </Avatar>
            )}
          </div>
          <span className="truncate">
            {hasFreela && assignees.length === 0 ? activity.freelaName : assignees.length === 1 ? assignees[0].name : assignees.length > 1 ? `${assignees.length} responsáveis` : ''}
            {hasFreela && assignees.length > 0 ? ` · ${activity.freelaName}` : ''}
          </span>
        </div>
      )}
      {activity.dueDate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />{formatDateBR(activity.dueDate)}
        </div>
      )}
    </div>
  );
}
