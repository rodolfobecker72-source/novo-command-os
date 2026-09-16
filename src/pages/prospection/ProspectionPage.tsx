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
  ThermometerSun, ArrowUpRight, RotateCcw, Trash2, Edit, Eye,
  ChevronDown, Building2, User, Phone, Mail, MapPin, Briefcase,
  Clock, Flag, MessageSquare, X, Save, BarChart3, AlertTriangle,
  TrendingUp, Activity, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { computeLeadTemperature } from '@/utils/leadTemperature';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useProspection } from '@/contexts/ProspectionContext';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMonthlyGoals } from '@/hooks/useMonthlyGoals';
import {
  ProspectionLead, LeadOriginType, LeadSegment, LeadTemperature,
  LeadFunnelStatus, LeadPriority, AcquisitionType,
  LEAD_ORIGIN_LABELS, LEAD_SEGMENT_LABELS, LEAD_TEMPERATURE_LABELS,
  LEAD_FUNNEL_STATUS_LABELS, LEAD_PRIORITY_LABELS, ACQUISITION_TYPE_LABELS,
  FUNNEL_STATUS_ORDER,
} from '@/types/prospection';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const KANBAN_COLUMN_WIDTH_CLASS = 'w-[300px] md:w-[320px] lg:w-[340px] flex-none';

function TemperatureBadge({ temp }: { temp: LeadTemperature }) {
  const styles: Record<LeadTemperature, string> = {
    frio: 'bg-muted text-muted-foreground',
    morno: 'bg-warning/15 text-warning border-warning/20',
    quente: 'bg-success/15 text-success border-success/20',
  };
  return (
    <Badge variant="outline" className={`${styles[temp]} text-xs gap-1`}>
      <ThermometerSun className="w-3 h-3" />
      {LEAD_TEMPERATURE_LABELS[temp]}
    </Badge>
  );
}

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
  const { leads, addLead, updateLead, deleteLead, reactivateLead } = useProspection();
  const { addClient, clients } = useCRM();
  const { getMeetingsGoalForMonth } = useMonthlyGoals();
  const isLeadMigrated = (lead: ProspectionLead) =>
    clients.some(c => c.companyName.trim().toLowerCase() === lead.companyName.trim().toLowerCase());
  const auth = useAuth();

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const changeLeadStatus = (lead: ProspectionLead, newStatus: LeadFunnelStatus, extraUpdates: Partial<ProspectionLead> = {}) => {
    if (lead.funnelStatus === newStatus) {
      if (Object.keys(extraUpdates).length > 0) updateLead(lead.id, extraUpdates);
      return;
    }
    const updates: Partial<ProspectionLead> = { ...extraUpdates, funnelStatus: newStatus };
    // Entering "reunião agendada" — mark schedule time and reset confirmation
    if (newStatus === 'reuniao_agendada' && lead.funnelStatus !== 'reuniao_agendada') {
      updates.meetingScheduledAt = new Date().toISOString();
      updates.meetingHappened = null;
    }
    // Leaving "reunião agendada" without confirmation — ask if the meeting actually happened
    if (lead.funnelStatus === 'reuniao_agendada' && newStatus !== 'reuniao_agendada' && (lead.meetingHappened === null || lead.meetingHappened === undefined)) {
      setMeetingConfirm({ leadId: lead.id, newStatus, extraUpdates });
      return;
    }
    updateLead(lead.id, updates);
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


  const [activeTab, setActiveTab] = useState<'leads' | 'painel' | 'funil'>('leads');
  const [funnelMonth, setFunnelMonth] = useState<string>(String(new Date().getMonth()));
  const [funnelYear, setFunnelYear] = useState<string>(String(new Date().getFullYear()));
  const [view, setView] = useState<'table' | 'kanban'>('kanban');
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
  }, [view, activeTab]);

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
  }, [showProxyScroll, view, activeTab]);

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

  // Metrics
  const metrics = useMemo(() => {
    const total = filteredLeads.length;
    const active = filteredLeads.filter(l => !['perdido', 'qualificado_crm'].includes(l.funnelStatus)).length;
    const meetings = filteredLeads.filter(l => l.funnelStatus === 'reuniao_agendada').length;
    const lost = filteredLeads.filter(l => l.funnelStatus === 'perdido').length;
    const volume = filteredLeads.reduce((sum, l) => sum + (l.estimatedPotential || 0), 0);

    const mapped = filteredLeads.filter(l => l.funnelStatus === 'mapeado').length;
    const meetingsTotal = meetings;
    const qualifiedCRM = filteredLeads.filter(l => l.funnelStatus === 'qualificado_crm').length;

    const convMappedToMeeting = total > 0 ? ((meetingsTotal / Math.max(mapped + meetingsTotal, 1)) * 100) : 0;
    const convMeetingToCRM = meetingsTotal > 0 ? ((qualifiedCRM / Math.max(meetingsTotal + qualifiedCRM, 1)) * 100) : 0;
    const lossRate = total > 0 ? ((lost / total) * 100) : 0;

    return { total, active, meetings, lost, volume, convMappedToMeeting, convMeetingToCRM, lossRate };
  }, [filteredLeads]);

  const dashboardCards = [
    { label: 'Total Leads', value: metrics.total, icon: Users, color: 'bg-primary/10 text-primary' },
    { label: 'Leads Ativos', value: metrics.active, icon: Target, color: 'bg-success/10 text-success' },
    { label: 'Reuniões Agendadas', value: metrics.meetings, icon: CalendarCheck, color: 'bg-warning/10 text-warning' },
    { label: 'Leads Perdidos', value: metrics.lost, icon: XCircle, color: 'bg-destructive/10 text-destructive' },
    { label: 'Volume Estimado', value: `R$ ${metrics.volume.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'bg-primary/10 text-primary' },
  ];

  // Open create dialog
  const openCreate = () => {
    setEditingLead(null);
    setFormData(emptyLead);
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
      changeLeadStatus(lead, 'qualificado_crm');
      toast.success(`"${lead.companyName}" migrado para o CRM como cliente!`);
    }
  };

  const handleReactivate = (lead: ProspectionLead) => {
    reactivateLead(lead.id);
    toast.success(`"${lead.companyName}" reativado!`);
  };

  // Kanban columns (nutricao shown separately)
  const kanbanStatuses: LeadFunnelStatus[] = [
    'mapeado', 'contato_realizado', 'reuniao_agendada', 'qualificado_crm', 'nutricao',
  ];


  const uniqueResponsibles = useMemo(() => {
    const names = new Set(leads.map(l => l.prospectionResponsible).filter(Boolean));
    return Array.from(names);
  }, [leads]);

  // Dashboard panel data
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const scheduledActivities = useMemo(() => {
    return filteredLeads
      .filter(l => l.nextActionDate && !['perdido', 'qualificado_crm'].includes(l.funnelStatus))
      .sort((a, b) => a.nextActionDate.localeCompare(b.nextActionDate));
  }, [filteredLeads]);

  const overdueActivities = useMemo(() => {
    return scheduledActivities.filter(l => l.nextActionDate < todayStr);
  }, [scheduledActivities, todayStr]);

  const todayActivities = useMemo(() => {
    return scheduledActivities.filter(l => l.nextActionDate === todayStr);
  }, [scheduledActivities, todayStr]);

  const upcomingActivities = useMemo(() => {
    return scheduledActivities.filter(l => l.nextActionDate > todayStr);
  }, [scheduledActivities, todayStr]);

  const panelMetrics = useMemo(() => {
    const fl = filteredLeads;
    const total = fl.length;
    const byOrigin = Object.entries(LEAD_ORIGIN_LABELS).map(([k, v]) => ({
      key: k, label: v, count: fl.filter(l => l.origin === k).length,
    })).filter(o => o.count > 0).sort((a, b) => b.count - a.count);

    const bySegment = Object.entries(LEAD_SEGMENT_LABELS).map(([k, v]) => ({
      key: k, label: v, count: fl.filter(l => l.segment === k).length,
    })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

    const byTemperature = {
      quente: fl.filter(l => l.temperature === 'quente').length,
      morno: fl.filter(l => l.temperature === 'morno').length,
      frio: fl.filter(l => l.temperature === 'frio').length,
    };

    const outbound = fl.filter(l => l.acquisitionType === 'outbound').length;
    const inbound = fl.filter(l => l.acquisitionType === 'inbound').length;

    const avgPotential = total > 0 ? fl.reduce((s, l) => s + (l.estimatedPotential || 0), 0) / total : 0;

    const highPriority = fl.filter(l => l.priority === 'alta' && !['perdido', 'qualificado_crm'].includes(l.funnelStatus)).length;

    const withoutAction = fl.filter(l => !l.nextActionDate && !['perdido', 'qualificado_crm'].includes(l.funnelStatus)).length;

    return { total, byOrigin, bySegment, byTemperature, outbound, inbound, avgPotential, highPriority, withoutAction };
  }, [filteredLeads]);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Gestão de Leads" subtitle="Módulo pré-CRM de aquisição e qualificação" />
      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-4 md:space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
        </div>
        <Button onClick={openCreate} size="default" className="gap-2 rounded-xl shadow-sm w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Novo Lead
        </Button>
      </motion.div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'leads' ? 'default' : 'outline'}
          className="gap-2 rounded-xl"
          onClick={() => setActiveTab('leads')}
        >
          <Users className="w-4 h-4" /> Leads
        </Button>
        <Button
          variant={activeTab === 'painel' ? 'default' : 'outline'}
          className="gap-2 rounded-xl"
          onClick={() => setActiveTab('painel')}
        >
          <BarChart3 className="w-4 h-4" /> Painel de Controle
        </Button>
        <Button
          variant={activeTab === 'funil' ? 'default' : 'outline'}
          className="gap-2 rounded-xl"
          onClick={() => setActiveTab('funil')}
        >
          <Filter className="w-4 h-4" /> Funil
        </Button>
      </div>

      {activeTab === 'leads' && (
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
                    <div className="flex gap-1 ml-auto">
                      <Button variant={view === 'table' ? 'default' : 'outline'} size="icon" className="rounded-xl h-9 w-9" onClick={() => setView('table')}>
                        <List className="w-4 h-4" />
                      </Button>
                      <Button variant={view === 'kanban' ? 'default' : 'outline'} size="icon" className="rounded-xl h-9 w-9" onClick={() => setView('kanban')}>
                        <LayoutGrid className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {view === 'table' ? (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Temperatura</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Potencial</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Próxima Ação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="font-medium">Nenhum lead encontrado</p>
                          <p className="text-sm">Crie seu primeiro lead para começar</p>
                        </TableCell>
                      </TableRow>
                    ) : filteredLeads.map(lead => (
                      <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailLead(lead)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ResponsibleAvatar userId={lead.responsibleUserId} />
                            <div>
                              <div className="font-medium">{lead.companyName}</div>
                              <div className="text-xs text-muted-foreground">{lead.city}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{lead.contactName}</div>
                          <div className="text-xs text-muted-foreground">{lead.contactRole}</div>
                        </TableCell>
                        <TableCell><span className="text-xs">{LEAD_ORIGIN_LABELS[lead.origin]}</span></TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ACQUISITION_TYPE_LABELS[lead.acquisitionType]}
                          </Badge>
                        </TableCell>
                        <TableCell><TemperatureBadge temp={lead.temperature} /></TableCell>
                        <TableCell><FunnelStatusBadge status={lead.funnelStatus} /></TableCell>
                        <TableCell className="font-medium">
                          {lead.estimatedPotential > 0
                            ? `R$ ${lead.estimatedPotential.toLocaleString('pt-BR')}`
                            : '-'}
                        </TableCell>
                        <TableCell><PriorityBadge priority={lead.priority} /></TableCell>
                        <TableCell>
                          <div className="text-xs">{lead.nextAction || '-'}</div>
                          {lead.nextActionDate && (
                            <div className="text-xs text-muted-foreground">{format(new Date(lead.nextActionDate), 'dd/MM/yyyy')}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            {lead.funnelStatus === 'qualificado_crm' && (
                              <Button size="sm" variant="default" className={`gap-1 text-xs h-7 ${isLeadMigrated(lead) ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`} onClick={() => handleMigrateToCRM(lead)}>
                                <ArrowUpRight className="w-3 h-3" /> {isLeadMigrated(lead) ? 'CRM ✓' : 'CRM'}
                              </Button>
                            )}
                            {lead.funnelStatus === 'perdido' && (
                              <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => handleReactivate(lead)}>
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(lead)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(lead.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden p-3 space-y-3">
                  {filteredLeads.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">Nenhum lead encontrado</p>
                      <p className="text-sm">Crie seu primeiro lead para começar</p>
                    </div>
                  ) : filteredLeads.map(lead => (
                    <div
                      key={lead.id}
                      className="border border-border/60 rounded-lg p-3 space-y-2 bg-card active:bg-muted/50 transition-colors"
                      onClick={() => setDetailLead(lead)}
                    >
                      <div className="flex items-start gap-2">
                        <ResponsibleAvatar userId={lead.responsibleUserId} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{lead.companyName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {lead.contactName}{lead.city ? ` · ${lead.city}` : ''}
                          </p>
                        </div>
                        <FunnelStatusBadge status={lead.funnelStatus} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <TemperatureBadge temp={lead.temperature} />
                        <PriorityBadge priority={lead.priority} />
                        <Badge variant="outline" className="text-xs">{ACQUISITION_TYPE_LABELS[lead.acquisitionType]}</Badge>
                      </div>
                      {(lead.nextAction || lead.estimatedPotential > 0) && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                          <span className="truncate">
                            {lead.nextAction || ''}
                            {lead.nextActionDate ? ` · ${format(new Date(lead.nextActionDate), 'dd/MM/yyyy')}` : ''}
                          </span>
                          {lead.estimatedPotential > 0 && (
                            <span className="font-medium text-foreground shrink-0">
                              R$ {lead.estimatedPotential.toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40" onClick={e => e.stopPropagation()}>
                        {lead.funnelStatus === 'qualificado_crm' && (
                          <Button size="sm" variant="default" className={`gap-1 text-xs h-7 ${isLeadMigrated(lead) ? 'bg-success hover:bg-success/90 text-success-foreground' : ''}`} onClick={() => handleMigrateToCRM(lead)}>
                            <ArrowUpRight className="w-3 h-3" /> {isLeadMigrated(lead) ? 'CRM ✓' : 'CRM'}
                          </Button>
                        )}
                        {lead.funnelStatus === 'perdido' && (
                          <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => handleReactivate(lead)}>
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(lead)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(lead.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
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
                                  <TemperatureBadge temp={lead.temperature} />
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
                              {status === 'qualificado_crm' && (
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
        )}
      </AnimatePresence>
        </>
      )}

      {/* Funil */}
      {activeTab === 'funil' && (() => {
        const funnelStages: { key: LeadFunnelStatus; label: string; color: string }[] = [
          { key: 'mapeado', label: 'Mapeado', color: '#94a3b8' },
          { key: 'contato_realizado', label: 'Contato Realizado', color: '#3b82f6' },
          { key: 'reuniao_agendada', label: 'Reunião Agendada', color: '#f59e0b' },
          { key: 'qualificado_crm', label: 'Qualificado p/ CRM', color: '#10b981' },
        ];

        const yearNum = Number(funnelYear);
        let periodStart: Date | null = null;
        let periodEnd: Date | null = null;
        let periodLabel = '';
        if (funnelMonth === 'all') {
          periodStart = new Date(yearNum, 0, 1);
          periodEnd = new Date(yearNum, 11, 31, 23, 59, 59);
          periodLabel = `Ano de ${yearNum}`;
        } else {
          const monthNum = Number(funnelMonth);
          const ref = new Date(yearNum, monthNum, 1);
          periodStart = startOfMonth(ref);
          periodEnd = endOfMonth(ref);
          periodLabel = format(ref, "MMMM 'de' yyyy", { locale: ptBR });
        }

        const funnelLeads = filteredLeads.filter(l => {
          if (!periodStart || !periodEnd) return true;
          if (!l.createdAt) return false;
          const d = parseISO(l.createdAt);
          return isWithinInterval(d, { start: periodStart, end: periodEnd });
        });

        const counts = funnelStages.map(s => ({
          ...s,
          count: funnelLeads.filter(l => l.funnelStatus === s.key).length,
        }));

        // Meetings scheduled/realized in the period.
        // Uses meetingScheduledAt when present; falls back to updatedAt for leads
        // that were marked as "realizada" without a scheduling timestamp;
        // also keeps leads currently in "reuniao_agendada" regardless of timestamps.
        const meetingsInPeriod = funnelLeads.filter(l => {
          if (l.funnelStatus === 'reuniao_agendada') return true;
          const hasHappenedFlag = l.meetingHappened === true || l.meetingHappened === false;
          if (!l.meetingScheduledAt && !hasHappenedFlag) return false;
          if (!periodStart || !periodEnd) return true;
          const ref = l.meetingScheduledAt || l.updatedAt || l.createdAt;
          if (!ref) return false;
          const d = parseISO(ref);
          return isWithinInterval(d, { start: periodStart, end: periodEnd });
        });
        const meetingsScheduledCount = meetingsInPeriod.length;
        const meetingsHappenedCount = meetingsInPeriod.filter(l => l.meetingHappened === true).length;

        // Monthly meeting goal (only when a specific month is selected)
        const meetingsGoal = funnelMonth !== 'all'
          ? getMeetingsGoalForMonth(`${yearNum}-${String(Number(funnelMonth) + 1).padStart(2, '0')}`)
          : null;
        const meetingsGoalPct = meetingsGoal && meetingsGoal > 0
          ? Math.min(100, Math.round((meetingsHappenedCount / meetingsGoal) * 100))
          : null;

        const nurtureCount = funnelLeads.filter(l => l.funnelStatus === 'nutricao').length;
        const maxCount = Math.max(...counts.map(c => c.count), 1);

        const svgWidth = 800;
        const svgHeight = 480;
        const topWidth = 720;
        const bottomWidth = 220;
        const stageHeight = svgHeight / counts.length;

        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="flex flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-primary" />
                    Funil de Vendas
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{periodLabel} · {funnelLeads.length} leads</p>
                </div>
                <div className="flex gap-2">
                  <Select value={funnelMonth} onValueChange={setFunnelMonth}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Ano inteiro</SelectItem>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={funnelYear} onValueChange={setFunnelYear}>
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  {/* SVG Funnel */}
                  <div className="w-full lg:flex-1 flex justify-center">
                    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[640px] h-auto">
                      <defs>
                        {counts.map((s, i) => (
                          <linearGradient key={i} id={`grad-${i}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={s.color} stopOpacity="0.95" />
                            <stop offset="100%" stopColor={s.color} stopOpacity="0.75" />
                          </linearGradient>
                        ))}
                      </defs>
                      {counts.map((s, i) => {
                        const t1 = i / counts.length;
                        const t2 = (i + 1) / counts.length;
                        const w1 = topWidth - (topWidth - bottomWidth) * t1;
                        const w2 = topWidth - (topWidth - bottomWidth) * t2;
                        const cx = svgWidth / 2;
                        const y1 = i * stageHeight;
                        const y2 = (i + 1) * stageHeight - 6;
                        const points = [
                          `${cx - w1 / 2},${y1}`,
                          `${cx + w1 / 2},${y1}`,
                          `${cx + w2 / 2},${y2}`,
                          `${cx - w2 / 2},${y2}`,
                        ].join(' ');
                        return (
                          <g key={s.key}>
                            <polygon
                              points={points}
                              fill={`url(#grad-${i})`}
                              stroke="hsl(var(--background))"
                              strokeWidth="2"
                            />
                            <text
                              x={cx}
                              y={y1 + stageHeight / 2 - 8}
                              textAnchor="middle"
                              fill="white"
                              fontSize="22"
                              fontWeight="700"
                              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}
                            >
                              {s.count}
                            </text>
                            <text
                              x={cx}
                              y={y1 + stageHeight / 2 + 16}
                              textAnchor="middle"
                              fill="white"
                              fontSize="13"
                              fontWeight="500"
                              opacity="0.95"
                            >
                              {s.label}
                            </text>
                            {s.key === 'reuniao_agendada' && (
                              <text
                                x={cx}
                                y={y1 + stageHeight / 2 + 34}
                                textAnchor="middle"
                                fill="white"
                                fontSize="11"
                                fontWeight="600"
                                opacity="0.95"
                              >
                                {meetingsHappenedCount} realizadas
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>


                  {/* Side breakdown */}
                  <div className="w-full lg:w-72 space-y-3">
                    {counts.map((s, i) => {
                      const prev = i > 0 ? counts[i - 1].count : null;
                      const convPct = prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
                      const widthPct = (s.count / maxCount) * 100;
                      return (
                        <div key={s.key} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                              <span className="font-medium">{s.label}</span>
                            </div>
                            <span className="font-bold tabular-nums">{s.count}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${widthPct}%`, background: s.color }}
                            />
                          </div>
                          {convPct !== null && (
                            <div className="text-[11px] text-muted-foreground">
                              Conversão da etapa anterior: <span className="font-semibold">{convPct}%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="pt-3 mt-3 border-t space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-sm bg-primary/40" />
                          <span className="text-muted-foreground">Em nutrição</span>
                        </div>
                        <span className="font-semibold tabular-nums">{nurtureCount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{funnelLeads.length}</div>
                    <div className="text-xs text-muted-foreground">Total no funil</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {funnelLeads.length > 0
                        ? Math.round((counts[counts.length - 1].count / funnelLeads.length) * 100)
                        : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Taxa de qualificação</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMeetingsListOpen({
                      title: `Reuniões agendadas · ${periodLabel}`,
                      leads: meetingsInPeriod,
                    })}
                    className="text-center rounded-xl transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 p-1 -m-1 cursor-pointer"
                  >
                    <div className="text-2xl font-bold text-warning">{meetingsScheduledCount}</div>
                    <div className="text-xs text-muted-foreground underline-offset-2 hover:underline">Reuniões agendadas</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeetingsListOpen({
                      title: `Reuniões realizadas · ${periodLabel}`,
                      leads: meetingsInPeriod.filter(l => l.meetingHappened === true),
                    })}
                    className="text-center rounded-xl transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 p-1 -m-1 cursor-pointer"
                  >
                    <div className="text-2xl font-bold text-success">{meetingsHappenedCount}</div>
                    <div className="text-xs text-muted-foreground underline-offset-2 hover:underline">Reuniões efetuadas</div>
                    {meetingsScheduledCount > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {Math.round((meetingsHappenedCount / meetingsScheduledCount) * 100)}% de conversão
                      </div>
                    )}
                  </button>
                </div>

                {/* Meta de reuniões do mês */}
                {funnelMonth !== 'all' && (
                  <div className="mt-4 rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">Meta de Reuniões · {periodLabel}</span>
                      </div>
                      {meetingsGoal ? (
                        <span className="text-xs font-medium tabular-nums">
                          <span className="text-primary font-bold">{meetingsHappenedCount}</span>
                          <span className="text-muted-foreground"> / {meetingsGoal} realizadas</span>
                        </span>
                      ) : (
                        <a href="/configuracoes/metas" className="text-xs text-primary hover:underline">
                          Definir meta →
                        </a>
                      )}
                    </div>
                    {meetingsGoal && meetingsGoalPct !== null && (
                      <>
                        <div className="h-2.5 bg-background rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${meetingsGoalPct >= 100 ? 'bg-success' : 'bg-primary'}`}
                            style={{ width: `${meetingsGoalPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                          <span>{meetingsGoalPct}% da meta</span>
                          <span>
                            {meetingsHappenedCount >= meetingsGoal
                              ? 'Meta atingida 🎯'
                              : `Faltam ${meetingsGoal - meetingsHappenedCount} reuniões`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

              </CardContent>
            </Card>
          </motion.div>
        );
      })()}

      {/* Painel de Controle */}
      {activeTab === 'painel' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Period Filters for Panel */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Período:</span>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-[100px] h-10 rounded-xl"><SelectValue placeholder="Ano" /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-[140px] h-10 rounded-xl"><SelectValue placeholder="Mês" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Leads', value: metrics.total, icon: Users, color: 'bg-primary/10 text-primary' },
              { label: 'Leads Ativos', value: metrics.active, icon: Target, color: 'bg-success/10 text-success' },
              { label: 'Reuniões', value: metrics.meetings, icon: CalendarCheck, color: 'bg-warning/10 text-warning' },
              { label: 'Perdidos', value: metrics.lost, icon: XCircle, color: 'bg-destructive/10 text-destructive' },
            ].map((card) => (
              <Card key={card.label} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${card.color}`}>
                      <card.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="text-lg font-bold">{card.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Conversion Rates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mapeado → Reunião</p>
                  <p className="text-2xl font-bold">{metrics.convMappedToMeeting.toFixed(1)}%</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <ArrowUpRight className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reunião → CRM</p>
                  <p className="text-2xl font-bold">{metrics.convMeetingToCRM.toFixed(1)}%</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <XCircle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxa de Perda</p>
                  <p className="text-2xl font-bold">{metrics.lossRate.toFixed(1)}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Extra Insights Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Outbound / Inbound</p>
                <p className="text-lg font-bold">{panelMetrics.outbound} / {panelMetrics.inbound}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Prioridade Alta</p>
                <p className="text-lg font-bold text-destructive">{panelMetrics.highPriority}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Sem Ação Definida</p>
                <p className="text-lg font-bold text-warning">{panelMetrics.withoutAction}</p>
              </CardContent>
            </Card>
          </div>

          {/* Scheduled Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overdue */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Atrasadas
                  <Badge variant="destructive" className="ml-auto text-xs">{overdueActivities.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
                {overdueActivities.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade atrasada 🎉</p>
                ) : overdueActivities.map(lead => (
                  <div key={lead.id} className="p-3 rounded-xl bg-destructive/5 border border-destructive/10 cursor-pointer hover:bg-destructive/10 transition-colors"
                    onClick={() => setDetailLead(lead)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{lead.companyName}</p>
                        <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                      </div>
                      <TemperatureBadge temp={lead.temperature} />
                    </div>
                    <p className="text-xs mt-1.5 text-foreground/80">
                      <Clock className="w-3 h-3 inline mr-1" />{lead.nextAction}
                    </p>
                    <p className="text-xs text-destructive font-medium mt-1">
                      {format(new Date(lead.nextActionDate + 'T12:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Today */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Hoje
                  <Badge className="ml-auto text-xs">{todayActivities.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
                {todayActivities.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade para hoje</p>
                ) : todayActivities.map(lead => (
                  <div key={lead.id} className="p-3 rounded-xl bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setDetailLead(lead)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{lead.companyName}</p>
                        <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                      </div>
                      <TemperatureBadge temp={lead.temperature} />
                    </div>
                    <p className="text-xs mt-1.5 text-foreground/80">
                      <Clock className="w-3 h-3 inline mr-1" />{lead.nextAction}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Upcoming */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-success" />
                  Próximas
                  <Badge variant="outline" className="ml-auto text-xs">{upcomingActivities.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
                {upcomingActivities.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade futura agendada</p>
                ) : upcomingActivities.slice(0, 10).map(lead => (
                  <div key={lead.id} className="p-3 rounded-xl bg-success/5 border border-success/10 cursor-pointer hover:bg-success/10 transition-colors"
                    onClick={() => setDetailLead(lead)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{lead.companyName}</p>
                        <p className="text-xs text-muted-foreground">{lead.contactName}</p>
                      </div>
                      <TemperatureBadge temp={lead.temperature} />
                    </div>
                    <p className="text-xs mt-1.5 text-foreground/80">
                      <Clock className="w-3 h-3 inline mr-1" />{lead.nextAction}
                    </p>
                    <p className="text-xs text-success font-medium mt-1">
                      {format(new Date(lead.nextActionDate + 'T12:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                ))}
                {upcomingActivities.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">+{upcomingActivities.length - 10} mais</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Distribution Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* By Temperature */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ThermometerSun className="w-4 h-4" /> Temperatura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Quente', value: panelMetrics.byTemperature.quente, color: 'bg-success', total: panelMetrics.total },
                  { label: 'Morno', value: panelMetrics.byTemperature.morno, color: 'bg-warning', total: panelMetrics.total },
                  { label: 'Frio', value: panelMetrics.byTemperature.frio, color: 'bg-muted-foreground', total: panelMetrics.total },
                ].map(t => (
                  <div key={t.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{t.label}</span>
                      <span className="font-medium">{t.value}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${t.color} rounded-full transition-all`}
                        style={{ width: `${t.total > 0 ? (t.value / t.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* By Origin */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Origem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                {panelMetrics.byOrigin.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
                ) : panelMetrics.byOrigin.map(o => (
                  <div key={o.key} className="flex items-center justify-between text-sm">
                    <span className="text-xs">{o.label}</span>
                    <Badge variant="outline" className="text-xs">{o.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* By Segment */}
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" /> Setor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                {panelMetrics.bySegment.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
                ) : panelMetrics.bySegment.map(s => (
                  <div key={s.key} className="flex items-center justify-between text-sm">
                    <span className="text-xs">{s.label}</span>
                    <Badge variant="outline" className="text-xs">{s.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}


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
              <div className="flex items-center justify-between">
                <Label className="text-xs">Temperatura</Label>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <Switch
                    checked={!!formData.temperatureManual}
                    onCheckedChange={(v) => setFormData(p => ({ ...p, temperatureManual: v }))}
                  />
                  Manual
                </label>
              </div>
              {formData.temperatureManual ? (
                <Select value={formData.temperature} onValueChange={(v: LeadTemperature) => setFormData(p => ({ ...p, temperature: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAD_TEMPERATURE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                (() => {
                  const r = computeLeadTemperature(formData as any);
                  return (
                    <div className="rounded-md border border-input bg-muted/30 px-3 py-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <TemperatureBadge temp={r.temperature} />
                        <span className="text-[11px] text-muted-foreground font-medium">Score: {r.score}/100</span>
                      </div>
                      <ul className="text-[10px] text-muted-foreground space-y-0.5">
                        {r.breakdown.map((b, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate">{b.label}</span>
                            <span className={b.points > 0 ? 'text-emerald-600' : b.points < 0 ? 'text-red-600' : ''}>
                              {b.points > 0 ? '+' : ''}{b.points}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status do Funil</Label>
              <Select value={formData.funnelStatus} onValueChange={(v: LeadFunnelStatus) => setFormData(p => ({ ...p, funnelStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_FUNNEL_STATUS_LABELS).filter(([k]) => k !== 'perdido').map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                  <TemperatureBadge temp={detailLead.temperature} />
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
                  <div><span className="text-muted-foreground text-xs">Temperatura:</span><p>{LEAD_TEMPERATURE_LABELS[detailLead.temperature]}</p></div>
                  <div><span className="text-muted-foreground text-xs">Status do Funil:</span><p>{LEAD_FUNNEL_STATUS_LABELS[detailLead.funnelStatus]}</p></div>
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
                  {detailLead.funnelStatus === 'qualificado_crm' && (
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
