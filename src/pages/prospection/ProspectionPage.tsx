import { useState, useMemo, useEffect, ReactNode, useRef, useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCenter,
} from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search, Plus, Filter, LayoutGrid, List, Users, PhoneCall,
  CalendarCheck, FileText, XCircle, DollarSign, Target, Flame,
  ArrowUpRight, RotateCcw, Trash2, Edit, Eye,
  ChevronDown, Building2, User, Phone, Mail, MapPin, Briefcase,
  Clock, Flag, MessageSquare, X, Save, BarChart3, AlertTriangle,
  TrendingUp, Activity, Calendar, Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useProspection } from '@/contexts/ProspectionContext';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMonthlyGoals } from '@/hooks/useMonthlyGoals';
import {
  ProspectionLead, LeadOriginType, LeadSegment,
  LeadFunnelStatus, LeadPriority, AcquisitionType, LeadStatus,
  LEAD_ORIGIN_LABELS, LEAD_SEGMENT_LABELS,
  LEAD_FUNNEL_STATUS_LABELS, LEAD_PRIORITY_LABELS, ACQUISITION_TYPE_LABELS,
  FUNNEL_STATUS_ORDER, getStatusColor,
} from '@/types/prospection';
import { ManageLeadStatusesDialog } from '@/components/prospection/ManageLeadStatusesDialog';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const KANBAN_COLUMN_WIDTH_CLASS = 'w-[300px] md:w-[320px] lg:w-[340px] flex-none';

function PriorityBadge({ priority }: { priority: LeadPriority }) {
  const styles: Record<LeadPriority, string> = {
    alta: 'bg-destructive/15 text-destructive border-destructive/20',
    media: 'bg-warning/15 text-warning border-warning/20',
    baixa: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={`${styles[priority]} text-xs gap-1`}>
      <Flag className="w-3 h-3" />
      {LEAD_PRIORITY_LABELS[priority]}
    </Badge>
  );
}


const emptyLead: Omit<ProspectionLead, 'id' | 'createdAt' | 'updatedAt'> = {
  companyName: '',
  contactName: '',
  contactRole: '',
  phone: '',
  email: '',
  city: '',
  origin: 'prospeccao_ativa',
  segment: 'tecnologia',
  acquisitionType: 'outbound',
  estimatedPotential: 0,
  temperature: 'frio',
  funnelStatus: 'mapeado',
  prospectionResponsible: '',
  closingResponsible: '',
  lastContactDate: '',
  nextAction: '',
  nextActionDate: '',
  priority: 'media',
  strategicNotes: '',
  responsibleUserId: null,
  temperatureManual: false,
};

function DroppableColumn({ status, children }: { status: LeadFunnelStatus; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <div
      ref={setNodeRef}
      className={`${KANBAN_COLUMN_WIDTH_CLASS} rounded-2xl p-1 transition-colors ${isOver ? 'bg-accent/10 ring-2 ring-accent/40' : ''}`}
    >
      {children}
    </div>
  );
}

function DraggableLeadCard({ lead, children }: { lead: ProspectionLead; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

export function ProspectionPage() {
  const { leads, addLead, updateLead, deleteLead, reactivateLead, statuses } = useProspection();
  const { addClient, clients } = useCRM();
  const { getMeetingsGoalForMonth } = useMonthlyGoals();
  const isLeadMigrated = (lead: ProspectionLead) =>
    clients.some(c => c.companyName.trim().toLowerCase() === lead.companyName.trim().toLowerCase());
  const auth = useAuth();

  // Status do funil (personalizáveis por workspace)
  const [manageStatusOpen, setManageStatusOpen] = useState(false);
  const orderedStatuses = useMemo(() => [...statuses].sort((a, b) => a.order - b.order), [statuses]);
  const meetingKey = orderedStatuses.find(s => s.key === 'reuniao_agendada')?.key
    || orderedStatuses.find(s => s.role === 'meeting')?.key || null;
  const qualifiedKey = orderedStatuses.find(s => s.key === 'qualificado_crm')?.key
    || orderedStatuses.find(s => s.role === 'qualified')?.key || null;
  const firstStatusKey = orderedStatuses[0]?.key || 'mapeado';
  const statusLabel = (key: LeadFunnelStatus) =>
    orderedStatuses.find(s => s.key === key)?.label || LEAD_FUNNEL_STATUS_LABELS[key] || key;

  const FunnelStatusBadge = ({ status }: { status: LeadFunnelStatus }) => {
    const s = orderedStatuses.find(x => x.key === status);
    const color = getStatusColor(s?.color || 'slate');
    return (
      <Badge variant="outline" className={`${color.badge} text-xs`}>
        {s?.label || LEAD_FUNNEL_STATUS_LABELS[status] || status}
      </Badge>
    );
  };

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const changeLeadStatus = (lead: ProspectionLead, newStatus: LeadFunnelStatus, extraUpdates: Partial<ProspectionLead> = {}) => {
    if (lead.funnelStatus === newStatus) {
      if (Object.keys(extraUpdates).length > 0) updateLead(lead.id, extraUpdates);
      return;
    }
    const updates: Partial<ProspectionLead> = { ...extraUpdates, funnelStatus: newStatus };
    // Entering the meeting status — mark schedule time and reset confirmation
    if (meetingKey && newStatus === meetingKey && lead.funnelStatus !== meetingKey) {
      updates.meetingScheduledAt = new Date().toISOString();
      updates.meetingHappened = null;
    }
    // Leaving the meeting status without confirmation — ask if the meeting actually happened
    if (meetingKey && lead.funnelStatus === meetingKey && newStatus !== meetingKey && (lead.meetingHappened === null || lead.meetingHappened === undefined)) {
      setMeetingConfirm({ leadId: lead.id, newStatus, extraUpdates });
      return;
    }
    updateLead(lead.id, updates);
    maybeAskQualify(lead, newStatus);
  };

  // Ao entrar em "Qualificado para CRM", perguntar se deve cadastrar como cliente
  const maybeAskQualify = (lead: ProspectionLead, newStatus: LeadFunnelStatus) => {
    if (!qualifiedKey || newStatus !== qualifiedKey) return;
    if (lead.funnelStatus === qualifiedKey) return;
    if (isLeadMigrated(lead)) return;
    setQualifyConfirm(lead);
  };


  const handleKanbanDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith('col-')) return;
    const newStatus = overId.slice(4) as LeadFunnelStatus;
    const lead = leads.find(l => l.id === active.id);
    if (!lead) return;
    changeLeadStatus(lead, newStatus);
  };


  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const kanbanHeaderRef = useRef<HTMLDivElement>(null);
  const proxyScrollRef = useRef<HTMLDivElement>(null);
  const [kanbanScrollWidth, setKanbanScrollWidth] = useState(0);
  const [showProxyScroll, setShowProxyScroll] = useState(false);

  // Sync kanban horizontal scroll <-> sticky proxy scrollbar at bottom of viewport
  useLayoutEffect(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    const update = () => {
      setKanbanScrollWidth(el.scrollWidth);
      setShowProxyScroll(el.scrollWidth > el.clientWidth + 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach(c => ro.observe(c as Element));
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  useEffect(() => {
    const el = kanbanScrollRef.current;
    const header = kanbanHeaderRef.current;
    const proxy = proxyScrollRef.current;
    if (!el) return;
    let syncing = false;

    const syncScroll = (source: HTMLDivElement) => {
      if (syncing) return;
      syncing = true;
      const left = source.scrollLeft;
      if (source !== el) el.scrollLeft = left;
      if (header && source !== header) header.scrollLeft = left;
      if (proxy && source !== proxy) proxy.scrollLeft = left;
      syncing = false;
    };

    const onKanban = () => syncScroll(el);
    const onHeader = () => { if (header) syncScroll(header); };
    const onProxy = () => { if (proxy) syncScroll(proxy); };

    el.addEventListener('scroll', onKanban);
    header?.addEventListener('scroll', onHeader);
    proxy?.addEventListener('scroll', onProxy);
    return () => {
      el.removeEventListener('scroll', onKanban);
      header?.removeEventListener('scroll', onHeader);
      proxy?.removeEventListener('scroll', onProxy);
    };
  }, [showProxyScroll]);

  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [filterOrigin, setFilterOrigin] = useState<string>('all');
  const [filterResponsible, setFilterResponsible] = useState<string>('all');
  const [filterAcquisition, setFilterAcquisition] = useState<string>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<ProspectionLead | null>(null);
  const [formData, setFormData] = useState(emptyLead);
  const [detailLead, setDetailLead] = useState<ProspectionLead | null>(null);
  const [meetingsListOpen, setMeetingsListOpen] = useState<null | { title: string; leads: ProspectionLead[] }>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [meetingConfirm, setMeetingConfirm] = useState<{ leadId: string; newStatus: LeadFunnelStatus; extraUpdates?: Partial<ProspectionLead> } | null>(null);
  const [qualifyConfirm, setQualifyConfirm] = useState<ProspectionLead | null>(null);

  // Open lead profile via ?lead=<id> URL param (e.g., from Welcome page alerts)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const leadId = searchParams.get('lead');
    if (!leadId || leads.length === 0) return;
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setDetailLead(lead);
      const next = new URLSearchParams(searchParams);
      next.delete('lead');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, leads, setSearchParams]);

  // Workspace members eligible to be lead responsible (vendedor/admin/owner)
  const [members, setMembers] = useState<{ id: string; name: string; role: string; photoUrl: string | null }[]>([]);
  useEffect(() => {
    const workspaceId = auth.workspace?.id;
    if (!workspaceId) return;
    (async () => {
      const { data: wm } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', workspaceId)
        .in('role', ['owner', 'admin', 'vendedor']);
      const ids = (wm || []).map((m: any) => m.user_id);
      if (ids.length === 0) { setMembers([]); return; }
      const { data: profs } = await supabase.from('profiles').select('id, name, photo_url').in('id', ids);
      const roleById = new Map((wm || []).map((m: any) => [m.user_id, m.role]));
      const list = (profs || [])
        .map((p: any) => ({ id: p.id, name: p.name || 'Sem nome', role: roleById.get(p.id) || '', photoUrl: p.photo_url ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      setMembers(list);
    })();
  }, [auth.workspace?.id]);
  const memberName = (id?: string | null) => members.find(m => m.id === id)?.name || '';
  const memberPhoto = (id?: string | null) => members.find(m => m.id === id)?.photoUrl || null;

  const ResponsibleAvatar = ({ userId, size = 'sm' }: { userId?: string | null; size?: 'sm' | 'md' }) => {
    const sizeCls = size === 'md' ? 'h-8 w-8 text-xs' : 'h-6 w-6 text-[10px]';
    if (!userId) {
      return (
        <div title="Sem responsável" className={`${sizeCls} shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center border border-dashed`}>
          ?
        </div>
      );
    }
    const name = memberName(userId);
    const photo = memberPhoto(userId);
    const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
    return (
      <div title={name || 'Responsável'} className={`${sizeCls} shrink-0 rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center font-medium`}>
        {photo ? <img src={photo} alt={name} className="w-full h-full object-cover" /> : initials}
      </div>
    );
  };

  // Available years
  const years = useMemo(() => {
    const y = new Set(leads.map(l => new Date(l.createdAt).getFullYear()));
    y.add(new Date().getFullYear());
    return Array.from(y).sort((a, b) => b - a);
  }, [leads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const d = new Date(lead.createdAt);
      if (filterYear !== 'all' && d.getFullYear() !== Number(filterYear)) return false;
      if (filterMonth !== 'all' && d.getMonth() !== Number(filterMonth)) return false;
      if (filterOrigin !== 'all' && lead.origin !== filterOrigin) return false;
      if (filterResponsible !== 'all' && lead.prospectionResponsible !== filterResponsible) return false;
      if (filterAcquisition !== 'all' && lead.acquisitionType !== filterAcquisition) return false;
      if (search) {
        const q = search.toLowerCase();
        return lead.companyName.toLowerCase().includes(q)
          || lead.contactName.toLowerCase().includes(q)
          || lead.city.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR'));
  }, [leads, filterYear, filterMonth, filterOrigin, filterResponsible, filterAcquisition, search]);

  // Open create dialog
  const openCreate = () => {
    setEditingLead(null);
    setFormData({ ...emptyLead, funnelStatus: firstStatusKey });
    setDialogOpen(true);
  };

  const openEdit = (lead: ProspectionLead) => {
    setEditingLead(lead);
    setFormData({
      companyName: lead.companyName,
      contactName: lead.contactName,
      contactRole: lead.contactRole,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      origin: lead.origin,
      segment: lead.segment,
      acquisitionType: lead.acquisitionType,
      estimatedPotential: lead.estimatedPotential,
      temperature: lead.temperature,
      funnelStatus: lead.funnelStatus,
      prospectionResponsible: lead.prospectionResponsible,
      closingResponsible: lead.closingResponsible,
      lastContactDate: lead.lastContactDate,
      nextAction: lead.nextAction,
      nextActionDate: lead.nextActionDate,
      priority: lead.priority,
      strategicNotes: lead.strategicNotes,
      responsibleUserId: lead.responsibleUserId ?? null,
      temperatureManual: lead.temperatureManual ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.companyName.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }
    if (!formData.responsibleUserId) {
      toast.error('Selecione o responsável pelo lead');
      return;
    }

    if (editingLead) {
      const { funnelStatus, ...rest } = formData;
      // Handle status transition (with meeting confirmation if applicable)
      if (funnelStatus !== editingLead.funnelStatus) {
        await updateLead(editingLead.id, rest);
        changeLeadStatus(editingLead, funnelStatus);
      } else {
        await updateLead(editingLead.id, formData);
      }
      toast.success('Lead atualizado!');
    } else {
      await addLead(formData);
      toast.success('Lead criado!');
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteLead(id);
    setDeleteConfirm(null);
    toast.success('Lead excluído');
  };

  const mapOriginToCRM = (origin: LeadOriginType): import('@/types/crm').LeadOrigin => {
    const map: Record<LeadOriginType, import('@/types/crm').LeadOrigin> = {
      prospeccao_ativa: 'prospeccao_ativa',
      organico: 'organico',
      indicacao: 'indicacao',
      instagram: 'organico',
      meta_ads: 'trafego_pago',
      google_ads: 'google',
      evento: 'evento_feira',
      networking: 'parceria',
      site: 'site',
      outro: 'organico',
    };
    return map[origin];
  };

  const handleMigrateToCRM = async (lead: ProspectionLead) => {
    const newClient = await addClient({
      companyName: lead.companyName,
      cnpj: '',
      responsiblePerson: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      leadOrigin: mapOriginToCRM(lead.origin),
      sector: lead.segment || '',
      score: 0,
    });
    if (newClient) {
      if (qualifiedKey && lead.funnelStatus !== qualifiedKey) {
        updateLead(lead.id, { funnelStatus: qualifiedKey });
      }
      toast.success(`"${lead.companyName}" migrado para o CRM como cliente!`);
    }
  };

  const handleReactivate = (lead: ProspectionLead) => {
    reactivateLead(lead.id);
    toast.success(`"${lead.companyName}" reativado!`);
  };

  // Colunas do kanban seguem os status cadastrados
  const kanbanStatuses: LeadFunnelStatus[] = orderedStatuses.map(s => s.key);


  const uniqueResponsibles = useMemo(() => {
    const names = new Set(leads.map(l => l.prospectionResponsible).filter(Boolean));
    return Array.from(names);
  }, [leads]);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Gestão de Leads" subtitle="Módulo pré-CRM de aquisição e qualificação" />
      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-4 md:space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setManageStatusOpen(true)} size="default" className="gap-2 rounded-xl w-full sm:w-auto">
            <Settings2 className="w-4 h-4" /> Gerenciar Status
          </Button>
          <Button onClick={openCreate} size="default" className="gap-2 rounded-xl shadow-sm w-full sm:w-auto">
            <Plus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </motion.div>

      <ManageLeadStatusesDialog open={manageStatusOpen} onOpenChange={setManageStatusOpen} />

      <>
          {/* Filters */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col gap-3">
                  <div className="w-full">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Buscar empresa, contato ou cidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl text-sm" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={filterYear} onValueChange={setFilterYear}>
                      <SelectTrigger className="w-[90px] h-9 rounded-xl text-sm"><SelectValue placeholder="Ano" /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger className="w-[120px] h-9 rounded-xl text-sm"><SelectValue placeholder="Mês" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os meses</SelectItem>
                        {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterOrigin} onValueChange={setFilterOrigin}>
                      <SelectTrigger className="w-[120px] h-9 rounded-xl text-sm"><SelectValue placeholder="Origem" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas origens</SelectItem>
                        {Object.entries(LEAD_ORIGIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={filterAcquisition} onValueChange={setFilterAcquisition}>
                      <SelectTrigger className="w-[110px] h-9 rounded-xl text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                      </SelectContent>
                    </Select>
                    {uniqueResponsibles.length > 0 && (
                      <Select value={filterResponsible} onValueChange={setFilterResponsible}>
                        <SelectTrigger className="w-[120px] h-9 rounded-xl text-sm"><SelectValue placeholder="Responsável" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueResponsibles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
          <motion.div key="kanban" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleKanbanDragEnd}
            >
            <div id="kanban-column-headers" ref={kanbanHeaderRef} className="sticky top-14 md:top-16 z-30 overflow-x-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-3 pt-2">
              <div className="flex gap-5">
                {kanbanStatuses.map(status => {
                  const statusLeads = filteredLeads.filter(l => l.funnelStatus === status);
                  return (
                    <div key={status} className={`${KANBAN_COLUMN_WIDTH_CLASS} px-2 py-2 rounded-2xl border border-border/60 bg-background shadow-sm`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <FunnelStatusBadge status={status} />
                          <span className="text-xs font-medium text-muted-foreground shrink-0">{statusLeads.length}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div ref={kanbanScrollRef} className="flex gap-5 overflow-x-auto pb-4 scrollbar-thin">
              {kanbanStatuses.map(status => {
                const statusLeads = filteredLeads.filter(l => l.funnelStatus === status);
                return (
                  <DroppableColumn key={status} status={status}>
                    <div className="space-y-3 min-h-[40px]">
                      {statusLeads.map(lead => (
                        <DraggableLeadCard key={lead.id} lead={lead}>
                          <Card className="border-0 shadow-sm rounded-2xl cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                            onClick={() => setDetailLead(lead)}>
                            <CardContent className="p-4 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  <ResponsibleAvatar userId={lead.responsibleUserId} />
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{lead.companyName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{lead.contactName}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive"
                                    onClick={e => { e.stopPropagation(); setDeleteConfirm(lead.id); }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">{LEAD_ORIGIN_LABELS[lead.origin]}</Badge>
                                <PriorityBadge priority={lead.priority} />
                              </div>
                              {lead.estimatedPotential > 0 && (
                                <p className="text-xs font-semibold">R$ {lead.estimatedPotential.toLocaleString('pt-BR')}</p>
                              )}
                              {lead.nextAction && (
                                <p className="text-xs text-muted-foreground truncate">
                                  <Clock className="w-3 h-3 inline mr-1" />{lead.nextAction}
                                </p>
                              )}
                              {!!qualifiedKey && status === qualifiedKey && (
                                <Button size="sm" className={`w-full gap-1 text-xs h-7 mt-1 ${isLeadMigrated(lead) ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`} onClick={e => { e.stopPropagation(); handleMigrateToCRM(lead); }}>
                                  <ArrowUpRight className="w-3 h-3" /> {isLeadMigrated(lead) ? 'Migrado ao CRM ✓' : 'Migrar para CRM'}
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        </DraggableLeadCard>
                      ))}
                      {statusLeads.length === 0 && (
                        <div className="border border-dashed rounded-2xl p-6 text-center text-xs text-muted-foreground">
                          Nenhum lead
                        </div>
                      )}
                    </div>
                  </DroppableColumn>
                );
              })}
            </div>
            </DndContext>
            {showProxyScroll && (
              <div
                ref={proxyScrollRef}
                className="sticky bottom-0 left-0 right-0 overflow-x-auto overflow-y-hidden bg-background/80 backdrop-blur border-t border-border z-30 scrollbar-thin"
                style={{ height: 14 }}
              >
                <div style={{ width: kanbanScrollWidth, height: 1 }} />
              </div>
            )}



          </motion.div>
      </AnimatePresence>
        </>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Editar Lead' : 'Novo Lead'}</DialogTitle>
            <DialogDescription>Preencha as informações do lead</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div className="space-y-3 md:col-span-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Informações Básicas
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da Empresa *</Label>
              <Input value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Contato</Label>
              <Input value={formData.contactName} onChange={e => setFormData(p => ({ ...p, contactName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo</Label>
              <Input value={formData.contactRole} onChange={e => setFormData(p => ({ ...p, contactRole: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cidade</Label>
              <Input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} />
            </div>

            {/* Classification */}
            <div className="space-y-3 md:col-span-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5" /> Classificação
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Origem *</Label>
              <Select value={formData.origin} onValueChange={(v: LeadOriginType) => setFormData(p => ({ ...p, origin: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_ORIGIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Setor</Label>
              <Select value={formData.segment} onValueChange={(v: LeadSegment) => setFormData(p => ({ ...p, segment: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_SEGMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Aquisição</Label>
              <Select value={formData.acquisitionType} onValueChange={(v: AcquisitionType) => setFormData(p => ({ ...p, acquisitionType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound (Prospecção ativa)</SelectItem>
                  <SelectItem value="inbound">Inbound (Tráfego / Orgânico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status do Funil</Label>
              <Select value={formData.funnelStatus} onValueChange={(v: LeadFunnelStatus) => setFormData(p => ({ ...p, funnelStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {orderedStatuses.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Follow-up */}
            <div className="space-y-3 md:col-span-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Follow-up
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data do Último Contato</Label>
              <Input type="date" value={formData.lastContactDate} onChange={e => setFormData(p => ({ ...p, lastContactDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data da Próxima Ação</Label>
              <Input type="date" value={formData.nextActionDate} onChange={e => setFormData(p => ({ ...p, nextActionDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Próxima Ação</Label>
              <Input value={formData.nextAction} onChange={e => setFormData(p => ({ ...p, nextAction: e.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Responsável pelo Lead <span className="text-destructive">*</span></Label>
              <Select
                value={formData.responsibleUserId || ''}
                onValueChange={(v) => setFormData(p => ({ ...p, responsibleUserId: v || null }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            {/* Notes */}
            <div className="space-y-3 md:col-span-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Observações
              </p>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Textarea rows={4} value={formData.strategicNotes} onChange={e => setFormData(p => ({ ...p, strategicNotes: e.target.value }))} placeholder="Observações estratégicas sobre o lead..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" /> {editingLead ? 'Salvar' : 'Criar Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailLead} onOpenChange={() => setDetailLead(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {detailLead.companyName}
                </DialogTitle>
                <DialogDescription>{detailLead.city}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <FunnelStatusBadge status={detailLead.funnelStatus} />
                  <PriorityBadge priority={detailLead.priority} />
                  <Badge variant="outline" className="text-xs">{ACQUISITION_TYPE_LABELS[detailLead.acquisitionType]}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground text-xs">Empresa:</span><p>{detailLead.companyName}</p></div>
                  <div><span className="text-muted-foreground text-xs">Cidade:</span><p>{detailLead.city || '-'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Contato:</span><p>{detailLead.contactName || '-'}{detailLead.contactRole ? ` — ${detailLead.contactRole}` : ''}</p></div>
                  <div>
                    <span className="text-muted-foreground text-xs">Telefone / WhatsApp:</span>
                    {detailLead.phone ? (
                      <p>
                        <a
                          href={`https://wa.me/${(detailLead.phone.startsWith('+') ? detailLead.phone.slice(1) : `55${detailLead.phone}`).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          {detailLead.phone}
                        </a>
                      </p>
                    ) : <p>-</p>}
                  </div>
                  <div><span className="text-muted-foreground text-xs">E-mail:</span><p>{detailLead.email ? <a href={`mailto:${detailLead.email}`} className="text-primary hover:underline">{detailLead.email}</a> : '-'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Origem:</span><p>{LEAD_ORIGIN_LABELS[detailLead.origin]}</p></div>
                  <div><span className="text-muted-foreground text-xs">Setor:</span><p>{LEAD_SEGMENT_LABELS[detailLead.segment]}</p></div>
                  <div><span className="text-muted-foreground text-xs">Tipo de Aquisição:</span><p>{ACQUISITION_TYPE_LABELS[detailLead.acquisitionType]}</p></div>
                  <div><span className="text-muted-foreground text-xs">Status do Funil:</span><p>{statusLabel(detailLead.funnelStatus)}</p></div>
                  <div><span className="text-muted-foreground text-xs">Prioridade:</span><p>{LEAD_PRIORITY_LABELS[detailLead.priority]}</p></div>
                  <div><span className="text-muted-foreground text-xs">Potencial:</span><p className="font-semibold">R$ {detailLead.estimatedPotential.toLocaleString('pt-BR')}</p></div>
                  <div><span className="text-muted-foreground text-xs">Resp. Prospecção:</span><p>{detailLead.prospectionResponsible || '-'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Resp. Fechamento:</span><p>{detailLead.closingResponsible || '-'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Responsável pelo Lead:</span><p>{memberName(detailLead.responsibleUserId) || '-'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Último Contato:</span><p>{detailLead.lastContactDate ? format(new Date(detailLead.lastContactDate + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Data da Próxima Ação:</span><p>{detailLead.nextActionDate ? format(new Date(detailLead.nextActionDate + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground text-xs">Próxima Ação:</span><p>{detailLead.nextAction || '-'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Criado em:</span><p>{detailLead.createdAt ? format(new Date(detailLead.createdAt), 'dd/MM/yyyy HH:mm') : '-'}</p></div>
                  <div><span className="text-muted-foreground text-xs">Atualizado em:</span><p>{detailLead.updatedAt ? format(new Date(detailLead.updatedAt), 'dd/MM/yyyy HH:mm') : '-'}</p></div>
                </div>

                {detailLead.strategicNotes && (
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Observações Estratégicas</p>
                    <p className="text-sm whitespace-pre-wrap">{detailLead.strategicNotes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="gap-1" onClick={() => { setDetailLead(null); openEdit(detailLead); }}>
                    <Edit className="w-4 h-4" /> Editar
                  </Button>
                  {!!qualifiedKey && detailLead.funnelStatus === qualifiedKey && (
                    <Button className={`gap-1 ${isLeadMigrated(detailLead) ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`} onClick={() => { handleMigrateToCRM(detailLead); setDetailLead(null); }}>
                      <ArrowUpRight className="w-4 h-4" /> {isLeadMigrated(detailLead) ? 'Migrado ao CRM ✓' : 'Migrar para CRM'}
                    </Button>
                  )}
                  {detailLead.funnelStatus === 'perdido' && (
                    <Button variant="outline" className="gap-1" onClick={() => { handleReactivate(detailLead); setDetailLead(null); }}>
                      <RotateCcw className="w-4 h-4" /> Reativar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Meeting Happened Confirmation */}
      <Dialog open={!!meetingConfirm} onOpenChange={(open) => { if (!open) setMeetingConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-warning" />
              A reunião aconteceu?
            </DialogTitle>
            <DialogDescription>
              Antes de mudar o status, confirme se a reunião agendada realmente aconteceu.
              Isso será usado para contabilizar as reuniões efetuadas no funil.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!meetingConfirm) return;
                const lead = leads.find(l => l.id === meetingConfirm.leadId);
                if (!lead) { setMeetingConfirm(null); return; }
                updateLead(lead.id, { ...(meetingConfirm.extraUpdates || {}), funnelStatus: meetingConfirm.newStatus, meetingHappened: false });
                setMeetingConfirm(null);
              }}
            >
              Não aconteceu
            </Button>
            <Button
              onClick={() => {
                if (!meetingConfirm) return;
                const lead = leads.find(l => l.id === meetingConfirm.leadId);
                if (!lead) { setMeetingConfirm(null); return; }
                updateLead(lead.id, { ...(meetingConfirm.extraUpdates || {}), funnelStatus: meetingConfirm.newStatus, meetingHappened: true });
                setMeetingConfirm(null);
              }}
            >
              Sim, aconteceu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Meetings realized list */}
      <Dialog open={!!meetingsListOpen} onOpenChange={() => setMeetingsListOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-success" />
              {meetingsListOpen?.title}
            </DialogTitle>
            <DialogDescription>
              {meetingsListOpen?.leads.length ?? 0} {(meetingsListOpen?.leads.length ?? 0) === 1 ? 'reunião realizada' : 'reuniões realizadas'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
            {!meetingsListOpen?.leads.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma reunião realizada no período.</p>
            ) : (
              <div className="space-y-2">
                {meetingsListOpen.leads.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { setMeetingsListOpen(null); setDetailLead(l); }}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-success/10 shrink-0">
                      <CalendarCheck className="w-4 h-4 text-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{l.companyName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.contactName || '—'}
                        {l.meetingScheduledAt && ` · ${format(parseISO(l.meetingScheduledAt), "dd/MM/yyyy", { locale: ptBR })}`}
                      </p>
                    </div>
                    <FunnelStatusBadge status={l.funnelStatus} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMeetingsListOpen(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir este lead? Essa ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
