import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import {
  ProspectionLead,
  LeadFunnelStatus,
  LeadStatus,
  DEFAULT_LEAD_STATUSES,
} from '@/types/prospection';
import { computeLeadTemperature } from '@/utils/leadTemperature';

function statusFromDb(row: any): LeadStatus {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    color: row.color,
    order: row.order,
    role: row.role ?? null,
    isDefault: !!row.is_default,
  };
}

function slugifyStatusKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || `status_${Date.now()}`;
}


// ============= DB mapping helpers =============

function leadFromDb(row: any): ProspectionLead {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactRole: row.contact_role,
    phone: row.phone,
    email: row.email,
    city: row.city,
    origin: row.origin,
    segment: row.segment,
    acquisitionType: row.acquisition_type,
    estimatedPotential: Number(row.estimated_potential),
    temperature: row.temperature,
    funnelStatus: row.funnel_status,
    prospectionResponsible: row.prospection_responsible,
    closingResponsible: row.closing_responsible,
    lastContactDate: row.last_contact_date,
    nextAction: row.next_action,
    nextActionDate: row.next_action_date,
    priority: row.priority,
    strategicNotes: row.strategic_notes,
    responsibleUserId: row.responsible_user_id ?? null,
    temperatureManual: row.temperature_manual ?? false,
    meetingScheduledAt: row.meeting_scheduled_at ?? null,
    meetingHappened: row.meeting_happened ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function leadToDb(l: Partial<ProspectionLead>, workspaceId?: string): any {
  const row: any = {};
  if (workspaceId) row.workspace_id = workspaceId;
  if (l.companyName !== undefined) row.company_name = l.companyName;
  if (l.contactName !== undefined) row.contact_name = l.contactName;
  if (l.contactRole !== undefined) row.contact_role = l.contactRole;
  if (l.phone !== undefined) row.phone = l.phone;
  if (l.email !== undefined) row.email = l.email;
  if (l.city !== undefined) row.city = l.city;
  if (l.origin !== undefined) row.origin = l.origin;
  if (l.segment !== undefined) row.segment = l.segment;
  if (l.acquisitionType !== undefined) row.acquisition_type = l.acquisitionType;
  if (l.estimatedPotential !== undefined) row.estimated_potential = l.estimatedPotential;
  if (l.temperature !== undefined) row.temperature = l.temperature;
  if (l.funnelStatus !== undefined) row.funnel_status = l.funnelStatus;
  if (l.prospectionResponsible !== undefined) row.prospection_responsible = l.prospectionResponsible;
  if (l.closingResponsible !== undefined) row.closing_responsible = l.closingResponsible;
  if (l.lastContactDate !== undefined) row.last_contact_date = l.lastContactDate;
  if (l.nextAction !== undefined) row.next_action = l.nextAction;
  if (l.nextActionDate !== undefined) row.next_action_date = l.nextActionDate;
  if (l.priority !== undefined) row.priority = l.priority;
  if (l.strategicNotes !== undefined) row.strategic_notes = l.strategicNotes;
  if (l.responsibleUserId !== undefined) row.responsible_user_id = l.responsibleUserId || null;
  if (l.temperatureManual !== undefined) row.temperature_manual = l.temperatureManual;
  if (l.meetingScheduledAt !== undefined) row.meeting_scheduled_at = l.meetingScheduledAt;
  if (l.meetingHappened !== undefined) row.meeting_happened = l.meetingHappened;
  return row;
}

interface ProspectionContextType {
  leads: ProspectionLead[];
  isLoading: boolean;
  addLead: (lead: Omit<ProspectionLead, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ProspectionLead | null>;
  updateLead: (id: string, updates: Partial<ProspectionLead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  getLead: (id: string) => ProspectionLead | undefined;
  reactivateLead: (id: string) => Promise<void>;
  migrateLeadToCRM: (id: string) => { clientName: string } | null;
  // Status do funil personalizáveis
  statuses: LeadStatus[];
  addStatus: (data: { label: string; color: string; role?: LeadStatus['role']; order: number }) => Promise<void>;
  updateStatus: (id: string, updates: Partial<Pick<LeadStatus, 'label' | 'color' | 'role'>>) => Promise<void>;
  deleteStatus: (id: string, moveToKey: string) => Promise<void>;
  reorderStatuses: (ordered: LeadStatus[]) => Promise<void>;
}

const ProspectionContext = createContext<ProspectionContextType>({} as ProspectionContextType);

export function useProspection() {
  return useContext(ProspectionContext);
}

export function ProspectionProvider({ children }: { children: ReactNode }) {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;
  const [leads, setLeads] = useState<ProspectionLead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadStatuses = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { data, error } = await supabase
        .from('lead_statuses').select('*').eq('workspace_id', workspaceId).order('order');
      if (error) throw error;
      let rows = data || [];
      if (rows.length === 0) {
        // Seed dos status padrão para workspaces novos
        const payload = DEFAULT_LEAD_STATUSES.map(s => ({
          workspace_id: workspaceId,
          key: s.key,
          label: s.label,
          color: s.color,
          order: s.order,
          role: s.role,
          is_default: true,
        }));
        const { data: seeded } = await supabase
          .from('lead_statuses').insert(payload).select();
        rows = seeded || [];
      }
      setStatuses(rows.map(statusFromDb).sort((a, b) => a.order - b.order));
    } catch (e: any) {
      console.error('Error loading lead statuses:', e);
    }
  }, [workspaceId]);

  const load = useCallback(async (silent = false) => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await supabase.from('prospection_leads').select('*').eq('workspace_id', workspaceId);
      if (error) throw error;
      setLeads((data || []).map(leadFromDb));
    } catch (e: any) {
      console.error('Error loading leads:', e);
      if (!silent) toast.error('Erro ao carregar leads');
    } finally { if (!silent) setIsLoading(false); }
  }, [workspaceId]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  useRealtimeSync({
    workspaceId,
    tables: ['prospection_leads', 'lead_statuses'],
    onChange: () => { load(true); loadStatuses(); },
  });

  const addStatus = useCallback(async (data: { label: string; color: string; role?: LeadStatus['role']; order: number }) => {
    if (!workspaceId) return;
    try {
      let key = slugifyStatusKey(data.label);
      if (statuses.some(s => s.key === key)) key = `${key}_${Date.now().toString(36).slice(-4)}`;
      const insertOrder = Math.max(0, Math.min(data.order, statuses.length));
      const { error } = await supabase.from('lead_statuses').insert({
        workspace_id: workspaceId,
        key,
        label: data.label.trim(),
        color: data.color,
        order: insertOrder,
        role: data.role ?? null,
        is_default: false,
      });
      if (error) throw error;
      // Reindexa a ordem considerando a posição escolhida
      const rest = [...statuses].sort((a, b) => a.order - b.order);
      const reordered = [...rest.slice(0, insertOrder), null, ...rest.slice(insertOrder)];
      await Promise.all(reordered.map((s, i) =>
        s ? supabase.from('lead_statuses').update({ order: i }).eq('id', s.id) : Promise.resolve()
      ));
      await loadStatuses();
      toast.success('Status criado');
    } catch (e: any) { toast.error('Erro ao criar status: ' + e.message); }
  }, [workspaceId, statuses, loadStatuses]);

  const updateStatus = useCallback(async (id: string, updates: Partial<Pick<LeadStatus, 'label' | 'color' | 'role'>>) => {
    try {
      const row: any = {};
      if (updates.label !== undefined) row.label = updates.label.trim();
      if (updates.color !== undefined) row.color = updates.color;
      if (updates.role !== undefined) row.role = updates.role;
      const { error } = await supabase.from('lead_statuses').update(row).eq('id', id);
      if (error) throw error;
      setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (e: any) { toast.error('Erro ao atualizar status: ' + e.message); }
  }, []);

  const deleteStatus = useCallback(async (id: string, moveToKey: string) => {
    if (!workspaceId) return;
    try {
      const target = statuses.find(s => s.id === id);
      if (!target) return;
      if (target.isDefault) { toast.error('Status padrão não pode ser excluído'); return; }
      const { error: moveErr } = await supabase
        .from('prospection_leads')
        .update({ funnel_status: moveToKey })
        .eq('workspace_id', workspaceId)
        .eq('funnel_status', target.key);
      if (moveErr) throw moveErr;
      const { error } = await supabase.from('lead_statuses').delete().eq('id', id);
      if (error) throw error;
      await Promise.all([load(true), loadStatuses()]);
      toast.success('Status excluído');
    } catch (e: any) { toast.error('Erro ao excluir status: ' + e.message); }
  }, [workspaceId, statuses, load, loadStatuses]);

  const reorderStatuses = useCallback(async (ordered: LeadStatus[]) => {
    setStatuses(ordered.map((s, i) => ({ ...s, order: i })));
    try {
      await Promise.all(ordered.map((s, i) =>
        supabase.from('lead_statuses').update({ order: i }).eq('id', s.id)
      ));
    } catch (e: any) { toast.error('Erro ao reordenar status: ' + e.message); }
  }, []);


  const addLead = useCallback(async (data: Omit<ProspectionLead, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProspectionLead | null> => {
    if (!workspaceId) {
      toast.error('Sessão expirada ou workspace não carregado. Faça login novamente.');
      return null;
    }
    try {
      const payload = { ...data };
      if (!payload.temperatureManual) {
        payload.temperature = computeLeadTemperature(payload).temperature;
      }
      const { data: row, error } = await supabase.from('prospection_leads').insert(leadToDb(payload, workspaceId)).select().single();
      if (error) throw error;
      const lead = leadFromDb(row);
      setLeads(prev => [...prev, lead]);
      return lead;
    } catch (e: any) { toast.error('Erro ao criar lead: ' + e.message); return null; }
  }, [workspaceId]);

  const updateLead = useCallback(async (id: string, updates: Partial<ProspectionLead>) => {
    try {
      const current = leads.find(l => l.id === id);
      const merged: Partial<ProspectionLead> = { ...updates };
      const manual = merged.temperatureManual ?? current?.temperatureManual ?? false;
      if (!manual && current) {
        const full = { ...current, ...updates };
        merged.temperature = computeLeadTemperature(full).temperature;
      }
      const { error } = await supabase.from('prospection_leads').update(leadToDb(merged)).eq('id', id);
      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...merged, updatedAt: new Date().toISOString() } : l));
    } catch (e: any) { toast.error('Erro ao atualizar lead: ' + e.message); }
  }, [leads]);

  const deleteLead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('prospection_leads').delete().eq('id', id);
      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (e: any) { toast.error('Erro ao deletar lead: ' + e.message); }
  }, []);

  const getLead = useCallback((id: string) => {
    return leads.find(l => l.id === id);
  }, [leads]);

  const reactivateLead = useCallback(async (id: string) => {
    const first = [...statuses].sort((a, b) => a.order - b.order)[0];
    await updateLead(id, { funnelStatus: (first?.key || 'mapeado') as LeadFunnelStatus });
  }, [updateLead, statuses]);

  const migrateLeadToCRM = useCallback((id: string) => {
    const lead = leads.find(l => l.id === id);
    const qualified = statuses.find(s => s.role === 'qualified');
    if (!lead || lead.funnelStatus !== (qualified?.key || 'qualificado_crm')) return null;
    return { clientName: lead.companyName };
  }, [leads, statuses]);

  return (
    <ProspectionContext.Provider value={{ leads, isLoading, addLead, updateLead, deleteLead, getLead, reactivateLead, migrateLeadToCRM, statuses, addStatus, updateStatus, deleteStatus, reorderStatuses }}>
      {children}
    </ProspectionContext.Provider>
  );
}
