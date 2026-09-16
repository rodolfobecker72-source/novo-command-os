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
}

const ProspectionContext = createContext<ProspectionContextType>({} as ProspectionContextType);

export function useProspection() {
  return useContext(ProspectionContext);
}

export function ProspectionProvider({ children }: { children: ReactNode }) {
  const { workspace } = useAuth();
  const workspaceId = workspace?.id;
  const [leads, setLeads] = useState<ProspectionLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  useRealtimeSync({
    workspaceId,
    tables: ['prospection_leads'],
    onChange: () => load(true),
  });


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
    await updateLead(id, { funnelStatus: 'mapeado' as LeadFunnelStatus });
  }, [updateLead]);

  const migrateLeadToCRM = useCallback((id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.funnelStatus !== 'qualificado_crm') return null;
    return { clientName: lead.companyName };
  }, [leads]);

  return (
    <ProspectionContext.Provider value={{ leads, isLoading, addLead, updateLead, deleteLead, getLead, reactivateLead, migrateLeadToCRM }}>
      {children}
    </ProspectionContext.Provider>
  );
}
