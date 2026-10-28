import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Client,
  Budget,
  BudgetVersion,
  CostItem,
  CRMCard,
  CRMStatus,
  LeadOrigin,
  ServiceType,
  ProjectExecution,
  ServiceItem,
  ExecutionServiceItem,
  ExecutionCostItem,
  DeliveryLink,
  KanbanColumn,
  DEFAULT_KANBAN_COLUMNS,
  ServiceCategory,
  ServiceObjective,
  DEFAULT_SERVICE_CATEGORIES,
  DEFAULT_SERVICE_OBJECTIVES,
  HardDrive,
  HDProjectAllocation,
  LegacyProject,
  Asset,
  ProjectColumn,
  ProjectCard,
  DEFAULT_PROJECT_COLUMNS,
  calculateServiceTotals,
} from '@/types/crm';
import { calculateClientScore, ScoreBreakdown } from '@/utils/clientScore';
import type { ScoreHistoryEntry } from '@/components/client/ScoreHistory';

// ============= snake_case <-> camelCase helpers =============

function clientFromDb(row: any): Client {
  return {
    id: row.id,
    companyName: row.company_name,
    cnpj: row.cnpj,
    responsiblePerson: row.responsible_person,
    legalRepresentativeName: row.legal_representative_name || '',
    legalRepresentativeCpf: row.legal_representative_cpf || '',
    email: row.email,
    phone: row.phone,
    leadOrigin: row.lead_origin as LeadOrigin,
    sector: row.sector || '',
    score: row.score,
    address: row.address || '',
    addressNumber: row.address_number || '',
    addressComplement: row.address_complement || '',
    neighborhood: row.neighborhood || '',
    zipCode: row.zip_code || '',
    city: row.city || '',
    state: row.state || '',
    stateRegistration: row.state_registration || '',
    municipalRegistration: row.municipal_registration || '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function clientToDb(c: Partial<Client>, workspaceId?: string): any {
  const row: any = {};
  if (workspaceId) row.workspace_id = workspaceId;
  if (c.companyName !== undefined) row.company_name = c.companyName;
  if (c.cnpj !== undefined) row.cnpj = c.cnpj;
  if (c.responsiblePerson !== undefined) row.responsible_person = c.responsiblePerson;
  if (c.legalRepresentativeName !== undefined) row.legal_representative_name = c.legalRepresentativeName;
  if (c.legalRepresentativeCpf !== undefined) row.legal_representative_cpf = c.legalRepresentativeCpf;
  if (c.email !== undefined) row.email = c.email;
  if (c.phone !== undefined) row.phone = c.phone;
  if (c.leadOrigin !== undefined) row.lead_origin = c.leadOrigin;
  if (c.sector !== undefined) row.sector = c.sector;
  if (c.score !== undefined) row.score = c.score;
  if (c.address !== undefined) row.address = c.address;
  if (c.addressNumber !== undefined) row.address_number = c.addressNumber;
  if (c.addressComplement !== undefined) row.address_complement = c.addressComplement;
  if (c.neighborhood !== undefined) row.neighborhood = c.neighborhood;
  if (c.zipCode !== undefined) row.zip_code = c.zipCode;
  if (c.city !== undefined) row.city = c.city;
  if (c.state !== undefined) row.state = c.state;
  if (c.stateRegistration !== undefined) row.state_registration = c.stateRegistration;
  if (c.municipalRegistration !== undefined) row.municipal_registration = c.municipalRegistration;
  return row;
}

function kanbanColumnFromDb(row: any): KanbanColumn {
  return { id: row.id, key: row.key, label: row.label, color: row.color, order: row.order, isDefault: row.is_default };
}

function serviceCategoryFromDb(row: any): ServiceCategory {
  return { id: row.id, key: row.key, label: row.label, order: row.order, isDefault: row.is_default };
}

function serviceObjectiveFromDb(row: any): ServiceObjective {
  return { id: row.id, categoryKey: row.category_key, key: row.key, label: row.label, order: row.order };
}

function projectColumnFromDb(row: any): ProjectColumn {
  return { id: row.id, key: row.key, label: row.label, color: row.color, order: row.order, isDefault: row.is_default };
}

function budgetFromDb(row: any, versions: BudgetVersion[]): Budget {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    projectName: row.project_name,
    projectDescription: row.project_description,
    clientId: row.client_id,
    serviceType: row.service_type,
    objective: row.objective,
    description: row.description,
    paymentTerms: row.payment_terms,
    includesTax: row.includes_tax,
    includesLogistics: row.includes_logistics,
    includesAccommodation: row.includes_accommodation,
    includesMeals: row.includes_meals,
    includesRawMaterial: row.includes_raw_material,
    includesTechnicalVisit: row.includes_technical_visit,
    hasExecutionDate: row.has_execution_date,
    executionStartDate: row.execution_start_date ? new Date(row.execution_start_date) : null,
    executionEndDate: row.execution_end_date ? new Date(row.execution_end_date) : null,
    executionStartTime: row.execution_start_time ?? null,
    executionEndTime: row.execution_end_time ?? null,
    location: row.location,
    status: row.status,
    versions,
    currentVersion: row.current_version,
    executionMonth: row.execution_month || null,
    approvedVersion: row.approved_version,
    approvalDate: row.approval_date ? new Date(row.approval_date) : null,
    finalValue: row.final_value,
    contractUrl: row.contract_url,
    nfUrl: row.nf_url,
    driveUrl: row.drive_url || '',
    execution: row.execution as ProjectExecution | null,
    rejectionReason: row.rejection_reason || '',
    rejectionObservation: row.rejection_observation || '',
    pdfReleased: row.pdf_released ?? false,
    isRecurring: row.is_recurring ?? false,
    contactId: row.contact_id ?? null,
    hideNfInPdf: row.hide_nf_in_pdf ?? false,
    hideOperationalInPdf: row.hide_operational_in_pdf ?? false,
    hideNfObservationInPdf: row.hide_nf_observation_in_pdf ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function budgetVersionFromDb(row: any): BudgetVersion {
  return {
    id: row.id,
    budgetId: row.budget_id,
    version: row.version,
    services: (row.services || []) as ServiceItem[],
    operationalCosts: (row.operational_costs || []) as CostItem[],
    costs: (row.costs || []) as CostItem[],
    productionCost: Number(row.production_cost),
    fixedCostPercentage: Number(row.fixed_cost_percentage),
    nfCostPercentage: Number(row.nf_cost_percentage),
    totalCost: Number(row.total_cost),
    fullPrice: Number(row.full_price),
    discount4Price: Number(row.discount4_price),
    discount5Price: Number(row.discount5_price),
    margin: Number(row.margin),
    reason: row.reason,
    isRejected: row.is_rejected,
    rejectionReason: row.rejection_reason,
    createdAt: new Date(row.created_at),
  };
}

function assetFromDb(row: any): Asset {
  return {
    id: row.id, name: row.name, description: row.description, value: Number(row.value),
    serialNumber: row.serial_number, heroAssetNumber: row.hero_asset_number, photo: row.photo,
    referenceLink: row.reference_link, assignedTo: row.assigned_to,
    createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
  };
}

function hardDriveFromDb(row: any): HardDrive {
  return {
    id: row.id, label: row.label, capacityGB: Number(row.capacity_gb),
    projects: (row.projects || []) as HDProjectAllocation[],
    createdAt: new Date(row.created_at),
  };
}

function legacyProjectFromDb(row: any): LegacyProject {
  return {
    id: row.id, projectNumber: row.project_number, clientId: row.client_id,
    clientName: row.client_name, sizeGB: Number(row.size_gb), createdAt: new Date(row.created_at),
  };
}

function scoreHistoryFromDb(row: any): ScoreHistoryEntry {
  return {
    id: row.id, clientId: row.client_id, score: row.score, previousScore: row.previous_score,
    reason: row.reason, timestamp: new Date(row.created_at),
  };
}

function projectCardFromDb(row: any): ProjectCard {
  return {
    id: row.id, budgetId: row.budget_id, proposalId: row.proposal_id,
    projectName: row.project_name, clientName: row.client_name, clientId: row.client_id,
    serviceTypes: (row.service_types || []) as ServiceType[],
    objective: row.objective, status: row.status, progress: row.progress,
    tasks: (row.tasks || []) as any[], links: (row.links || []) as any[],
    comments: (row.comments || []) as any[], materialLink: row.material_link,
    materialLinks: Array.isArray((row as any).material_links) ? ((row as any).material_links as string[]) : (row.material_link ? [row.material_link] : []),
    startDate: row.start_date ? new Date(row.start_date) : null,
    endDate: row.end_date ? new Date(row.end_date) : null,
    notes: row.notes, driveUrl: row.drive_url || '', createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
  };
}

// ============= Context type =============

interface CRMContextType {
  isLoading: boolean;
  clients: Client[];
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Client | null>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  getClient: (id: string) => Client | undefined;
  getClientScoreBreakdown: (clientId: string) => ScoreBreakdown;

  budgets: Budget[];
  addBudget: (budget: Omit<Budget, 'id' | 'versions' | 'currentVersion' | 'approvedVersion' | 'approvalDate' | 'finalValue' | 'contractUrl' | 'nfUrl' | 'execution' | 'createdAt' | 'updatedAt'>) => Promise<Budget | null>;
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<void>;
  updateBudgetStatus: (id: string, status: CRMStatus) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  getBudget: (id: string) => Budget | undefined;

  addBudgetVersion: (budgetId: string, version: Omit<BudgetVersion, 'id' | 'budgetId' | 'version' | 'createdAt'>) => Promise<void>;
  duplicateBudget: (budgetId: string, executionMonths: string[]) => Promise<number>;
  updateBudgetVersion: (budgetId: string, versionId: string, updates: Partial<BudgetVersion>) => Promise<void>;
  deleteLastVersion: (budgetId: string) => Promise<void>;
  approveBudget: (budgetId: string, versionNumber: number, executionMonth?: string) => Promise<void>;

  updateExecution: (budgetId: string, execution: Partial<ProjectExecution>) => Promise<void>;
  updateExecutionCost: (budgetId: string, serviceId: string, costId: string, updates: Partial<ExecutionCostItem>, isExtraCost?: boolean) => Promise<void>;
  addExtraCost: (budgetId: string, serviceId: string, cost: Omit<ExecutionCostItem, 'id' | 'budgetedValue'>) => Promise<void>;
  removeExtraCost: (budgetId: string, serviceId: string, costId: string) => Promise<void>;
  finalizeExecution: (budgetId: string, finalReport?: string) => Promise<void>;
  addDeliveryLink: (budgetId: string, link: Omit<DeliveryLink, 'id' | 'createdAt'>) => Promise<void>;
  removeDeliveryLink: (budgetId: string, linkId: string) => Promise<void>;

  kanbanColumns: KanbanColumn[];
  addKanbanColumn: (column: Omit<KanbanColumn, 'id' | 'order'>) => Promise<void>;
  updateKanbanColumn: (id: string, updates: Partial<KanbanColumn>) => Promise<void>;
  deleteKanbanColumn: (id: string) => Promise<void>;
  reorderKanbanColumns: (columns: KanbanColumn[]) => Promise<void>;
  getStatusLabel: (status: CRMStatus) => string;

  serviceCategories: ServiceCategory[];
  serviceObjectives: ServiceObjective[];
  addServiceCategory: (category: Omit<ServiceCategory, 'id' | 'order'>) => Promise<void>;
  updateServiceCategory: (id: string, updates: Partial<ServiceCategory>) => Promise<void>;
  deleteServiceCategory: (id: string) => Promise<void>;
  reorderServiceCategories: (categories: ServiceCategory[]) => Promise<void>;
  addServiceObjective: (objective: Omit<ServiceObjective, 'id' | 'order'>) => Promise<void>;
  updateServiceObjective: (id: string, updates: Partial<ServiceObjective>) => Promise<void>;
  deleteServiceObjective: (id: string) => Promise<void>;
  reorderServiceObjectives: (objectives: ServiceObjective[]) => Promise<void>;
  getObjectivesForCategory: (categoryKey: string) => { value: string; label: string }[];
  getCategoryLabel: (key: string) => string;

  hardDrives: HardDrive[];
  addHardDrive: (hd: Omit<HardDrive, 'id' | 'projects' | 'createdAt'>) => Promise<void>;
  updateHardDrive: (id: string, updates: Partial<Pick<HardDrive, 'label' | 'capacityGB'>>) => Promise<void>;
  deleteHardDrive: (id: string) => Promise<void>;
  allocateProjectToHD: (hdId: string, allocation: Omit<HDProjectAllocation, 'id' | 'allocatedAt'>) => Promise<void>;
  removeProjectFromHD: (hdId: string, allocationId: string) => Promise<void>;

  legacyProjects: LegacyProject[];
  deleteLegacyProject: (id: string) => Promise<void>;
  getLegacyProject: (id: string) => LegacyProject | undefined;
  getHDForBudget: (budgetId: string) => { hdLabel: string; hdId: string } | null;

  scoreHistory: ScoreHistoryEntry[];
  getClientScoreHistory: (clientId: string) => ScoreHistoryEntry[];

  assets: Asset[];
  addAsset: (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Asset | null>;
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;

  projectCards: ProjectCard[];
  projectColumns: ProjectColumn[];
  updateProjectCard: (id: string, updates: Partial<ProjectCard>) => Promise<void>;
  deleteProjectCard: (id: string) => Promise<void>;
  archiveProjectCards: (ids: string[], groupName: string) => Promise<void>;
  addProjectColumn: (column: Omit<ProjectColumn, 'id' | 'order'>) => Promise<void>;
  updateProjectColumn: (id: string, updates: Partial<ProjectColumn>) => Promise<void>;
  deleteProjectColumn: (id: string) => Promise<void>;
  reorderProjectColumns: (orderedIds: string[]) => Promise<void>;

  getCRMCards: () => CRMCard[];
  getCardsByStatus: (status: CRMStatus) => CRMCard[];
  moveCard: (cardId: string, newStatus: CRMStatus) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: ReactNode }) {
  const { workspace, session, isLoading: authLoading, role } = useAuth();
  const roleRef = useRef(role);
  useEffect(() => { roleRef.current = role; }, [role]);
  const workspaceId = workspace?.id;

  // Refs to avoid stale closures in ensureWorkspace
  const sessionRef = useRef(session);
  const workspaceIdRef = useRef(workspaceId);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);

  // Ref for score recalculation debounce
  const scoreRecalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const lastLoadedWorkspaceRef = useRef<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const clientsRef = useRef(clients);
  useEffect(() => { clientsRef.current = clients; }, [clients]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [serviceObjectives, setServiceObjectives] = useState<ServiceObjective[]>([]);
  const [hardDrives, setHardDrives] = useState<HardDrive[]>([]);
  const [legacyProjects, setLegacyProjects] = useState<LegacyProject[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryEntry[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projectCards, setProjectCards] = useState<ProjectCard[]>([]);
  const [projectColumns, setProjectColumns] = useState<ProjectColumn[]>([]);
  const [clientContacts, setClientContacts] = useState<{ id: string; client_id: string; workspace_id: string; name: string; phone: string; is_primary: boolean }[]>([]);

  const loadAll = useCallback(async (force = false) => {
    const wsId = workspaceIdRef.current;
    if (!wsId) {
      setIsLoading(false);
      return;
    }
    if (!force && lastLoadedWorkspaceRef.current === wsId) {
      return;
    }
    setIsLoading(true);
    const safetyTimeout = setTimeout(() => {
      console.warn('[CRM] Safety timeout: forcing isLoading=false after 15s');
      setIsLoading(false);
    }, 15000);
    try {
      const [
        clientsRes, contactsRes, kanbanRes, catRes, objRes, projColRes,
        budgetsRes, versionsRes, projectCardsRes,
        assetsRes, hdRes, legacyRes, scoreRes,
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('workspace_id', wsId),
        supabase.from('client_contacts').select('*').eq('workspace_id', wsId),
        supabase.from('kanban_columns').select('*').eq('workspace_id', wsId).order('order'),
        supabase.from('service_categories').select('*').eq('workspace_id', wsId).order('order'),
        supabase.from('service_objectives').select('*').eq('workspace_id', wsId).order('order'),
        supabase.from('project_columns').select('*').eq('workspace_id', wsId).order('order'),
        supabase.from('budgets').select('*').eq('workspace_id', wsId),
        supabase.from('budget_versions').select('*').eq('workspace_id', wsId),
        supabase.from('project_cards').select('*').eq('workspace_id', wsId).is('archived_at', null),
        supabase.from('assets').select('*').eq('workspace_id', wsId),
        supabase.from('hard_drives').select('*').eq('workspace_id', wsId),
        supabase.from('legacy_projects').select('*').eq('workspace_id', wsId),
        supabase.from('score_history').select('*').eq('workspace_id', wsId),
      ]);

      const errors: string[] = [];
      if (clientsRes.error) errors.push('clientes');
      if (kanbanRes.error) errors.push('kanban');
      if (catRes.error) errors.push('categorias');
      if (objRes.error) errors.push('objetivos');
      if (projColRes.error) errors.push('colunas de projeto');
      if (budgetsRes.error) errors.push('orçamentos');
      if (versionsRes.error) errors.push('versões');
      if (projectCardsRes.error) errors.push('cards de projeto');
      if (assetsRes.error) errors.push('patrimônios');
      if (hdRes.error) errors.push('HDs');
      if (legacyRes.error) errors.push('projetos legados');
      if (scoreRes.error) errors.push('histórico de score');
      if (contactsRes.error) errors.push('responsáveis das empresas');

      if (errors.length > 0) {
        console.error('[CRM] Falha ao carregar:', errors.join(', '));
        if (!force) toast.error(`Erro ao carregar: ${errors.join(', ')}. Recarregue a página.`);
      }

      setClients((clientsRes.data || []).map(clientFromDb).sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR')));

      let kanbanData = kanbanRes.data || [];
      if (kanbanData.length === 0 && !force) {
        const defaults = DEFAULT_KANBAN_COLUMNS.map(c => ({
          workspace_id: wsId, key: c.key, label: c.label, color: c.color, order: c.order, is_default: c.isDefault || false,
        }));
        const { data, error } = await supabase.from('kanban_columns').insert(defaults).select();
        if (error) {
          console.error('[CRM] Falha ao criar colunas padrão do kanban:', error.message);
          toast.error('Não foi possível criar as colunas padrão do CRM. Recarregue a página.');
        }
        kanbanData = data || [];
      }
      setKanbanColumns(kanbanData.map(kanbanColumnFromDb));

      let catData = catRes.data || [];
      // Only the owner may write service categories (RLS), so only they seed defaults.
      if (catData.length === 0 && !force && roleRef.current === 'owner') {
        const defaults = DEFAULT_SERVICE_CATEGORIES.map(c => ({
          workspace_id: wsId, key: c.key, label: c.label, order: c.order, is_default: c.isDefault || false,
        }));
        const { data, error } = await supabase.from('service_categories').insert(defaults).select();
        if (error) {
          console.error('[CRM] Falha ao criar categorias de serviço padrão:', error.message);
          toast.error('Não foi possível criar as categorias de serviço padrão. Recarregue a página.');
        }
        catData = data || [];
      }
      setServiceCategories(catData.map(serviceCategoryFromDb));

      setServiceObjectives((objRes.data || []).map(serviceObjectiveFromDb));

      let projColData = projColRes.data || [];
      if (projColData.length === 0 && !force) {
        const defaults = DEFAULT_PROJECT_COLUMNS.map(c => ({
          workspace_id: wsId, key: c.key, label: c.label, color: c.color, order: c.order, is_default: c.isDefault || false,
        }));
        const { data, error } = await supabase.from('project_columns').insert(defaults).select();
        if (error) {
          console.error('[CRM] Falha ao criar colunas padrão de projetos:', error.message);
          toast.error('Não foi possível criar as colunas padrão de Projetos. Recarregue a página.');
        }
        projColData = data || [];
      }
      setProjectColumns(projColData.map(projectColumnFromDb));

      const versionsByBudget: Record<string, BudgetVersion[]> = {};
      (versionsRes.data || []).forEach(row => {
        const v = budgetVersionFromDb(row);
        if (!versionsByBudget[v.budgetId]) versionsByBudget[v.budgetId] = [];
        versionsByBudget[v.budgetId].push(v);
      });
      setBudgets((budgetsRes.data || []).map(row => budgetFromDb(row, versionsByBudget[row.id] || [])));

      setProjectCards((projectCardsRes.data || []).map(projectCardFromDb));

      setAssets((assetsRes.data || []).map(assetFromDb));
      setHardDrives((hdRes.data || []).map(hardDriveFromDb));
      setLegacyProjects((legacyRes.data || []).map(legacyProjectFromDb));
      setScoreHistory((scoreRes.data || []).map(scoreHistoryFromDb));
      setClientContacts(contactsRes.data || []);
    } catch (error) {
      console.error('Error loading CRM data:', error);
      if (!force) toast.error('Erro ao carregar dados do CRM');
    } finally {
      clearTimeout(safetyTimeout);
      lastLoadedWorkspaceRef.current = wsId;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll(false);
  }, [workspaceId, loadAll]);

  // Realtime: refresh silently whenever any CRM-related table changes for this workspace
  useRealtimeSync({
    workspaceId,
    tables: [
      'clients','budgets','budget_versions','kanban_columns','service_categories',
      'service_objectives','service_items','project_columns','project_cards',
      'assets','hard_drives','legacy_projects','score_history','payment_terms',
    ],
    onChange: () => loadAll(true),
    debounceMs: 400,
  });


  // Helper: check workspace ready before any mutation, with DB fallback
  // Uses refs to avoid stale closures
  const ensureWorkspace = useCallback(async (): Promise<string | null> => {
    const currentSession = sessionRef.current;
    const currentWorkspaceId = workspaceIdRef.current;

    if (!currentSession) {
      console.error('[CRM] Sessão não encontrada no contexto');
      toast.error('Sua sessão expirou. Faça login novamente.');
      supabase.auth.signOut();
      window.location.href = '/login';
      return null;
    }
    if (currentWorkspaceId) return currentWorkspaceId;

    // Fallback: query workspace_members directly
    console.warn('[CRM] workspaceId is null in state, querying DB as fallback...');
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', currentSession.user.id)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('[CRM] Fallback query failed:', error.message);
        toast.error('Workspace não encontrado. Tente recarregar a página.');
        return null;
      }
      if (!data) {
        console.error('[CRM] Fallback: nenhum workspace_member encontrado');
        toast.error('Nenhum workspace associado à sua conta.');
        return null;
      }
      return data.workspace_id;
    } catch (e: any) {
      console.error('[CRM] Fallback exception:', e.message);
      toast.error('Erro ao buscar workspace. Recarregue a página.');
      return null;
    }
  }, []);

  // ============= Client functions =============
  const addClient = async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client | null> => {
    const wsId = await ensureWorkspace();
    if (!wsId) return null;
    try {
      const { data, error } = await supabase.from('clients').insert({ ...clientToDb(clientData, wsId) }).select().single();
      if (error) throw error;
      const newClient = clientFromDb(data);
      setClients(prev => [...prev, newClient].sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR')));
      return newClient;
    } catch (e: any) { toast.error('Erro ao criar cliente: ' + e.message); return null; }
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    try {
      const { error } = await supabase.from('clients').update(clientToDb(updates)).eq('id', id);
      if (error) throw error;
      setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c));
    } catch (e: any) { toast.error('Erro ao atualizar cliente: ' + e.message); }
  };

  const deleteClient = async (id: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (e: any) { toast.error('Erro ao deletar cliente: ' + e.message); }
  };

  const getClient = (id: string) => clients.find(c => c.id === id);

  const getClientScoreBreakdown = useCallback((clientId: string): ScoreBreakdown => {
    return calculateClientScore(clientId, budgets);
  }, [budgets]);

  const getClientScoreHistory = useCallback((clientId: string): ScoreHistoryEntry[] => {
    return scoreHistory.filter(e => e.clientId === clientId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [scoreHistory]);

  // Score recalculation — debounced to avoid race conditions
  useEffect(() => {
    if (!workspaceId || isLoading) return;

    if (scoreRecalcTimerRef.current) clearTimeout(scoreRecalcTimerRef.current);

    scoreRecalcTimerRef.current = setTimeout(async () => {
      const clientsToUpdate = new Set<string>();
      budgets.forEach(b => clientsToUpdate.add(b.clientId));

      const updates: { clientId: string; newScore: number; oldScore: number }[] = [];
      clientsToUpdate.forEach(clientId => {
        const client = clientsRef.current.find(c => c.id === clientId);
        if (client) {
          const scoreBreakdown = calculateClientScore(clientId, budgets);
          if (client.score !== scoreBreakdown.finalScore) {
            updates.push({ clientId, newScore: scoreBreakdown.finalScore, oldScore: client.score });
          }
        }
      });

      if (updates.length === 0) return;

      try {
        await Promise.all(updates.map(async ({ clientId, newScore, oldScore }) => {
          const reason = newScore > oldScore ? 'Melhoria de score' : 'Recálculo automático';
          try {
            const { data: historyData, error: histError } = await supabase.from('score_history').insert({
              workspace_id: workspaceId,
              client_id: clientId,
              score: newScore,
              previous_score: oldScore,
              reason,
            }).select().single();
            if (histError) console.error('[CRM] Erro ao inserir score_history:', histError.message);
            if (historyData) setScoreHistory(prev => [...prev, scoreHistoryFromDb(historyData)]);
          } catch (e: any) {
            console.error('[CRM] Exceção ao inserir score_history:', e.message);
          }
          const { error: updateError } = await supabase.from('clients').update({ score: newScore }).eq('id', clientId).eq('workspace_id', workspaceId);
          if (updateError) console.error('[CRM] Erro ao atualizar score do cliente:', updateError.message);
        }));

        // Batch update local state once
        setClients(prev => prev.map(c => {
          const update = updates.find(u => u.clientId === c.id);
          return update ? { ...c, score: update.newScore, updatedAt: new Date() } : c;
        }));
      } catch (e: any) {
        console.error('[CRM] Erro no recálculo de scores:', e.message);
      }
    }, 500); // 500ms debounce

    return () => {
      if (scoreRecalcTimerRef.current) clearTimeout(scoreRecalcTimerRef.current);
    };
  }, [budgets, workspaceId, isLoading]);

  // ============= Kanban Column functions =============
  const addKanbanColumn = async (columnData: Omit<KanbanColumn, 'id' | 'order'>) => {
    const wsId = await ensureWorkspace();
    if (!wsId) return;
    const maxOrder = Math.max(...kanbanColumns.map(c => c.order), -1);
    try {
      const { data, error } = await supabase.from('kanban_columns').insert({
        workspace_id: wsId, key: columnData.key, label: columnData.label,
        color: columnData.color, order: maxOrder + 1, is_default: columnData.isDefault || false,
      }).select().single();
      if (error) throw error;
      setKanbanColumns(prev => [...prev, kanbanColumnFromDb(data)]);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const updateKanbanColumn = async (id: string, updates: Partial<KanbanColumn>) => {
    try {
      const dbUpdates: any = {};
      if (updates.key !== undefined) dbUpdates.key = updates.key;
      if (updates.label !== undefined) dbUpdates.label = updates.label;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      if (updates.order !== undefined) dbUpdates.order = updates.order;
      const { error } = await supabase.from('kanban_columns').update(dbUpdates).eq('id', id);
      if (error) throw error;
      setKanbanColumns(prev => prev.map(col => col.id === id ? { ...col, ...updates } : col));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const deleteKanbanColumn = async (id: string) => {
    const column = kanbanColumns.find(c => c.id === id);
    if (column?.isDefault) return;
    try {
      const { error } = await supabase.from('kanban_columns').delete().eq('id', id);
      if (error) throw error;
      const firstColumn = kanbanColumns.find(c => c.order === 0);
      if (firstColumn && column) {
        // Move budgets from deleted column to first column
        const { error: moveError } = await supabase.from('budgets').update({ status: firstColumn.key }).eq('workspace_id', workspaceId!).eq('status', column.key);
        if (moveError) console.error('[CRM] deleteKanbanColumn: erro ao mover budgets:', moveError.message);
        setBudgets(prev => prev.map(b => b.status === column.key ? { ...b, status: firstColumn.key } : b));
      }
      setKanbanColumns(prev => prev.filter(col => col.id !== id));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const reorderKanbanColumns = async (newColumns: KanbanColumn[]) => {
    const previousColumns = kanbanColumns;
    const reordered = newColumns.map((col, index) => ({ ...col, order: index }));
    setKanbanColumns(reordered);
    try {
      const results = await Promise.all(
        reordered.map(col => supabase.from('kanban_columns').update({ order: col.order }).eq('id', col.id))
      );
      const failed = results.find(r => r.error);
      if (failed?.error) {
        console.error('[CRM] Erro ao reordenar colunas:', failed.error.message);
        toast.error('Erro ao reordenar colunas');
        setKanbanColumns(previousColumns); // rollback
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
      setKanbanColumns(previousColumns); // rollback
    }
  };

  const getStatusLabel = (status: CRMStatus): string => {
    return kanbanColumns.find(c => c.key === status)?.label || status;
  };

  // ============= Service Category functions =============
  const addServiceCategory = async (categoryData: Omit<ServiceCategory, 'id' | 'order'>) => {
    const wsId = await ensureWorkspace();
    if (!wsId) return;
    const maxOrder = Math.max(...serviceCategories.map(c => c.order), -1);
    try {
      const { data, error } = await supabase.from('service_categories').insert({
        workspace_id: wsId, key: categoryData.key, label: categoryData.label,
        order: maxOrder + 1, is_default: categoryData.isDefault || false,
      }).select().single();
      if (error) throw error;
      setServiceCategories(prev => [...prev, serviceCategoryFromDb(data)]);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const updateServiceCategory = async (id: string, updates: Partial<ServiceCategory>) => {
    try {
      const category = serviceCategories.find(c => c.id === id);
      const dbUpdates: any = {};
      if (updates.label !== undefined) {
        dbUpdates.label = updates.label;
        // Also update the key to match the new label
        const newKey = updates.label.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
        dbUpdates.key = newKey;
        updates.key = newKey;
      }
      if (updates.key !== undefined) dbUpdates.key = updates.key;
      const { error } = await supabase.from('service_categories').update(dbUpdates).eq('id', id);
      if (error) throw error;

      // If key changed, update related objectives and service items
      if (category && dbUpdates.key && category.key !== dbUpdates.key) {
        const oldKey = category.key;
        const newKey = dbUpdates.key;
        await supabase.from('service_objectives').update({ category_key: newKey }).eq('workspace_id', workspaceId!).eq('category_key', oldKey);
        await supabase.from('service_items').update({ category_key: newKey }).eq('workspace_id', workspaceId!).eq('category_key', oldKey);
        setServiceObjectives(prev => prev.map(obj => obj.categoryKey === oldKey ? { ...obj, categoryKey: newKey } : obj));
      }

      setServiceCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const deleteServiceCategory = async (id: string) => {
    const category = serviceCategories.find(c => c.id === id);
    try {
      // Delete related objectives
      const { error: objDelError } = await supabase.from('service_objectives').delete().eq('workspace_id', workspaceId!).eq('category_key', category!.key);
      if (objDelError) console.error('[CRM] deleteServiceCategory: erro ao deletar objetivos:', objDelError.message);
      const { error } = await supabase.from('service_categories').delete().eq('id', id);
      if (error) throw error;
      setServiceObjectives(prev => prev.filter(obj => obj.categoryKey !== category?.key));
      setServiceCategories(prev => prev.filter(cat => cat.id !== id));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const reorderServiceCategories = async (newCategories: ServiceCategory[]) => {
    const previous = serviceCategories;
    const reordered = newCategories.map((cat, index) => ({ ...cat, order: index }));
    setServiceCategories(reordered);
    try {
      const results = await Promise.all(
        reordered.map(cat => supabase.from('service_categories').update({ order: cat.order }).eq('id', cat.id))
      );
      const failed = results.find(r => r.error);
      if (failed?.error) {
        toast.error('Erro ao reordenar categorias');
        setServiceCategories(previous);
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
      setServiceCategories(previous);
    }
  };

  const addServiceObjective = async (objectiveData: Omit<ServiceObjective, 'id' | 'order'>) => {
    const wsId = await ensureWorkspace();
    if (!wsId) return;
    const categoryObjectives = serviceObjectives.filter(o => o.categoryKey === objectiveData.categoryKey);
    const maxOrder = Math.max(...categoryObjectives.map(o => o.order), -1);
    try {
      const { data, error } = await supabase.from('service_objectives').insert({
        workspace_id: wsId, category_key: objectiveData.categoryKey,
        key: objectiveData.key, label: objectiveData.label, order: maxOrder + 1,
      }).select().single();
      if (error) throw error;
      setServiceObjectives(prev => [...prev, serviceObjectiveFromDb(data)]);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const updateServiceObjective = async (id: string, updates: Partial<ServiceObjective>) => {
    try {
      const dbUpdates: any = {};
      if (updates.key !== undefined) dbUpdates.key = updates.key;
      if (updates.label !== undefined) dbUpdates.label = updates.label;
      if (updates.categoryKey !== undefined) dbUpdates.category_key = updates.categoryKey;
      const { error } = await supabase.from('service_objectives').update(dbUpdates).eq('id', id);
      if (error) throw error;
      setServiceObjectives(prev => prev.map(obj => obj.id === id ? { ...obj, ...updates } : obj));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const deleteServiceObjective = async (id: string) => {
    try {
      const { error } = await supabase.from('service_objectives').delete().eq('id', id);
      if (error) throw error;
      setServiceObjectives(prev => prev.filter(obj => obj.id !== id));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const reorderServiceObjectives = async (newObjectives: ServiceObjective[]) => {
    const previous = serviceObjectives;
    const reordered = newObjectives.map((obj, index) => ({ ...obj, order: index }));
    const reorderedIds = new Set(reordered.map(o => o.id));
    setServiceObjectives(prev => [
      ...prev.filter(o => !reorderedIds.has(o.id)),
      ...reordered,
    ]);
    try {
      const results = await Promise.all(
        reordered.map(obj => supabase.from('service_objectives').update({ order: obj.order }).eq('id', obj.id))
      );
      const failed = results.find(r => r.error);
      if (failed?.error) {
        toast.error('Erro ao reordenar objetivos');
        setServiceObjectives(previous);
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
      setServiceObjectives(previous);
    }
  };

  const getObjectivesForCategory = (categoryKey: string) => {
    return serviceObjectives.filter(obj => obj.categoryKey === categoryKey)
      .sort((a, b) => a.order - b.order).map(obj => ({ value: obj.key, label: obj.label }));
  };

  const getCategoryLabel = (key: string) => serviceCategories.find(c => c.key === key)?.label || key;

  // ============= Budget functions =============
  const addBudget = async (budgetData: Omit<Budget, 'id' | 'versions' | 'currentVersion' | 'approvedVersion' | 'approvalDate' | 'finalValue' | 'contractUrl' | 'nfUrl' | 'execution' | 'createdAt' | 'updatedAt'>): Promise<Budget | null> => {
    const wsId = await ensureWorkspace();
    if (!wsId) {
      console.error('[CRM] addBudget: ensureWorkspace retornou null');
      return null;
    }
    try {
      const { data, error } = await supabase.from('budgets').insert({
        workspace_id: wsId,
        proposal_id: budgetData.proposalId,
        project_name: budgetData.projectName,
        project_description: budgetData.projectDescription || '',
        client_id: budgetData.clientId,
        service_type: budgetData.serviceType,
        objective: budgetData.objective,
        description: budgetData.description,
        payment_terms: budgetData.paymentTerms,
        includes_tax: budgetData.includesTax,
        includes_logistics: budgetData.includesLogistics,
        includes_accommodation: budgetData.includesAccommodation,
        includes_meals: budgetData.includesMeals,
        includes_raw_material: budgetData.includesRawMaterial ?? false,
        includes_technical_visit: budgetData.includesTechnicalVisit ?? false,
        has_execution_date: budgetData.hasExecutionDate ?? false,
        execution_start_date: budgetData.executionStartDate?.toISOString() || null,
        execution_end_date: budgetData.executionEndDate?.toISOString() || null,
        location: budgetData.location ?? '',
        drive_url: (budgetData as any).driveUrl || '',
        contact_id: (budgetData as any).contactId || null,
        status: budgetData.status,
      }).select().single();
      if (error) {
        console.error('[CRM] addBudget: erro no insert:', error.message);
        throw error;
      }
      const newBudget = budgetFromDb(data, []);
      setBudgets(prev => [...prev, newBudget]);
      return newBudget;
    } catch (e: any) {
      console.error('[CRM] addBudget: exceção:', e.message);
      toast.error('Erro ao criar orçamento: ' + e.message);
      return null;
    }
  };

  const duplicateBudget = async (budgetId: string, executionMonths: string[]): Promise<number> => {
    const wsId = await ensureWorkspace();
    if (!wsId) {
      toast.error('Workspace não encontrado.');
      return 0;
    }
    const original = budgets.find(b => b.id === budgetId);
    if (!original) {
      toast.error('Orçamento original não encontrado.');
      return 0;
    }
    // Próximo proposalId disponível
    const numericIds = budgets.map(b => parseInt(b.proposalId, 10)).filter(n => !isNaN(n));
    let nextId = numericIds.length > 0 ? Math.max(...numericIds, 899) + 1 : 900;

    // Pega a versão a duplicar: aprovada (se houver) ou a corrente
    const sourceVersion = original.versions.find(v => v.version === (original.approvedVersion ?? original.currentVersion));

    let createdCount = 0;
    for (const month of executionMonths) {
      try {
        const { data: newBudgetRow, error: insErr } = await supabase.from('budgets').insert({
          workspace_id: wsId,
          proposal_id: original.proposalId,
          project_name: original.projectName,
          project_description: original.projectDescription || '',
          client_id: original.clientId,
          service_type: original.serviceType || '',
          objective: original.objective || '',
          description: original.description || '',
          payment_terms: original.paymentTerms || '',
          includes_tax: original.includesTax,
          includes_logistics: original.includesLogistics,
          includes_accommodation: original.includesAccommodation,
          includes_meals: original.includesMeals,
          includes_raw_material: original.includesRawMaterial ?? false,
          includes_technical_visit: original.includesTechnicalVisit ?? false,
          has_execution_date: false,
          execution_start_date: null,
          execution_end_date: null,
          location: original.location ?? '',
          drive_url: original.driveUrl || '',
          status: 'oportunidade_mapeada',
          execution_month: month,
          is_recurring: true,
        }).select().single();
        if (insErr) throw insErr;

        let createdVersion: BudgetVersion | null = null;
        if (sourceVersion) {
          const { data: vRow, error: vErr } = await supabase.from('budget_versions').insert({
            workspace_id: wsId,
            budget_id: newBudgetRow.id,
            version: 1,
            services: sourceVersion.services as any,
            operational_costs: sourceVersion.operationalCosts as any,
            costs: sourceVersion.costs as any,
            production_cost: sourceVersion.productionCost,
            fixed_cost_percentage: sourceVersion.fixedCostPercentage,
            nf_cost_percentage: sourceVersion.nfCostPercentage,
            total_cost: sourceVersion.totalCost,
            full_price: sourceVersion.fullPrice,
            discount4_price: sourceVersion.discount4Price,
            discount5_price: sourceVersion.discount5Price,
            margin: sourceVersion.margin,
            reason: `Duplicado de #${original.proposalId} (${month})`,
            is_rejected: false,
            rejection_reason: null,
          }).select().single();
          if (vErr) throw vErr;
          createdVersion = budgetVersionFromDb(vRow);
          await supabase.from('budgets').update({ current_version: 1 }).eq('id', newBudgetRow.id);
          newBudgetRow.current_version = 1;
        }

        const newBudget = budgetFromDb(newBudgetRow, createdVersion ? [createdVersion] : []);
        setBudgets(prev => [...prev, newBudget]);
        nextId++;
        createdCount++;
      } catch (e: any) {
        console.error('[CRM] duplicateBudget: erro para mês', month, e.message);
        toast.error(`Erro ao duplicar para ${month}: ${e.message}`);
      }
    }
    return createdCount;
  };

  const updateBudget = async (id: string, updates: Partial<Budget>) => {
    try {
      const dbUpdates: any = {};
      if (updates.proposalId !== undefined) dbUpdates.proposal_id = updates.proposalId;
      if (updates.projectName !== undefined) dbUpdates.project_name = updates.projectName;
      if (updates.projectDescription !== undefined) dbUpdates.project_description = updates.projectDescription;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.paymentTerms !== undefined) dbUpdates.payment_terms = updates.paymentTerms;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.includesTax !== undefined) dbUpdates.includes_tax = updates.includesTax;
      if (updates.includesLogistics !== undefined) dbUpdates.includes_logistics = updates.includesLogistics;
      if (updates.includesAccommodation !== undefined) dbUpdates.includes_accommodation = updates.includesAccommodation;
      if (updates.includesMeals !== undefined) dbUpdates.includes_meals = updates.includesMeals;
      if (updates.includesRawMaterial !== undefined) dbUpdates.includes_raw_material = updates.includesRawMaterial;
      if (updates.includesTechnicalVisit !== undefined) dbUpdates.includes_technical_visit = updates.includesTechnicalVisit;
      if (updates.hasExecutionDate !== undefined) dbUpdates.has_execution_date = updates.hasExecutionDate;
      if (updates.executionStartDate !== undefined) dbUpdates.execution_start_date = updates.executionStartDate?.toISOString() || null;
      if (updates.executionEndDate !== undefined) dbUpdates.execution_end_date = updates.executionEndDate?.toISOString() || null;
      if (updates.executionStartTime !== undefined) dbUpdates.execution_start_time = updates.executionStartTime || null;
      if (updates.executionEndTime !== undefined) dbUpdates.execution_end_time = updates.executionEndTime || null;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.executionMonth !== undefined) dbUpdates.execution_month = updates.executionMonth;
      if (updates.contractUrl !== undefined) dbUpdates.contract_url = updates.contractUrl;
      if (updates.nfUrl !== undefined) dbUpdates.nf_url = updates.nfUrl;
      if (updates.driveUrl !== undefined) dbUpdates.drive_url = updates.driveUrl;
      if (updates.approvedVersion !== undefined) dbUpdates.approved_version = updates.approvedVersion;
      if (updates.approvalDate !== undefined) dbUpdates.approval_date = updates.approvalDate?.toISOString() || null;
      if (updates.finalValue !== undefined) dbUpdates.final_value = updates.finalValue;
      if (updates.execution !== undefined) dbUpdates.execution = updates.execution;
      if (updates.currentVersion !== undefined) dbUpdates.current_version = updates.currentVersion;
      if (updates.rejectionReason !== undefined) dbUpdates.rejection_reason = updates.rejectionReason;
      if (updates.rejectionObservation !== undefined) dbUpdates.rejection_observation = updates.rejectionObservation;
      if (updates.pdfReleased !== undefined) dbUpdates.pdf_released = updates.pdfReleased;
      if (updates.isRecurring !== undefined) dbUpdates.is_recurring = updates.isRecurring;
      if (updates.contactId !== undefined) dbUpdates.contact_id = updates.contactId;
      if (updates.hideNfInPdf !== undefined) dbUpdates.hide_nf_in_pdf = updates.hideNfInPdf;
      if (updates.hideOperationalInPdf !== undefined) dbUpdates.hide_operational_in_pdf = updates.hideOperationalInPdf;
      if (updates.hideNfObservationInPdf !== undefined) dbUpdates.hide_nf_observation_in_pdf = updates.hideNfObservationInPdf;

      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase.from('budgets').update(dbUpdates).eq('id', id);
        if (error) throw error;
      }

      // Sync proposalId/projectName to project_cards if changed
      const pcUpdates: any = {};
      if (updates.proposalId !== undefined) pcUpdates.proposal_id = updates.proposalId;
      if (updates.projectName !== undefined) pcUpdates.project_name = updates.projectName;
      if (Object.keys(pcUpdates).length > 0) {
        await supabase.from('project_cards').update(pcUpdates).eq('budget_id', id);
        setProjectCards(prev => prev.map(pc => pc.budgetId === id ? {
          ...pc,
          ...(updates.proposalId !== undefined ? { proposalId: updates.proposalId } : {}),
          ...(updates.projectName !== undefined ? { projectName: updates.projectName } : {}),
        } : pc));
      }

      // If status changed to 'nao_aprovada', remove the associated project card
      if (updates.status === 'nao_aprovada') {
        const { error: pcDelError } = await supabase.from('project_cards').delete().eq('budget_id', id);
        if (pcDelError) console.error('[CRM] updateBudget: erro ao excluir project card:', pcDelError.message);
        else setProjectCards(prev => prev.filter(pc => pc.budgetId !== id));
      }

      // If status changed to 'aprovada', ensure a project card exists
      if (updates.status === 'aprovada' && workspaceId) {
        const budget = budgets.find(b => b.id === id);
        const alreadyExists = projectCards.some(pc => pc.budgetId === id);
        if (budget && !alreadyExists) {
          const client = clients.find(c => c.id === budget.clientId);
          const approvedVer = budget.versions.find(v => v.version === (budget.approvedVersion ?? budget.currentVersion));
          const serviceTypes = approvedVer?.services && approvedVer.services.length > 0
            ? [...new Set(approvedVer.services.map(s => s.serviceType))]
            : (budget.serviceType ? [budget.serviceType] : []);
          const objective = approvedVer?.services?.[0]?.objective || budget.objective || '';
          const firstColKey = [...projectColumns].sort((a, b) => a.order - b.order)[0]?.key || 'planejamento';
          const { data: pcData, error: pcError } = await supabase.from('project_cards').insert({
            workspace_id: workspaceId, budget_id: id, proposal_id: budget.proposalId,
            project_name: updates.projectName ?? budget.projectName,
            client_name: client?.companyName || 'Cliente não encontrado',
            client_id: budget.clientId, service_types: serviceTypes as any, objective,
            status: firstColKey, progress: 0, tasks: [] as any, links: [] as any, comments: [] as any,
            material_link: '', start_date: budget.executionStartDate?.toISOString() || null,
            end_date: budget.executionEndDate?.toISOString() || null, notes: '',
          }).select().single();
          if (pcError) console.error('[CRM] updateBudget: erro ao criar project card:', pcError.message);
          if (pcData) setProjectCards(prev => [...prev, projectCardFromDb(pcData)]);
        }
      }



      setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...updates, updatedAt: new Date() } : b));
    } catch (e: any) { toast.error('Erro ao atualizar orçamento: ' + e.message); }
  };

  const updateBudgetStatus = async (id: string, status: CRMStatus) => {
    await updateBudget(id, { status });
  };

  const deleteBudget = async (id: string) => {
    const wsId = await ensureWorkspace();
    try {
      const { error: versionsError } = await supabase.from('budget_versions').delete().eq('budget_id', id).eq('workspace_id', wsId || '');
      if (versionsError) console.error('[CRM] Erro ao deletar versões:', versionsError.message);
      const { error } = await supabase.from('budgets').delete().eq('id', id);
      if (error) throw error;
      setBudgets(prev => prev.filter(b => b.id !== id));
    } catch (e: any) { toast.error('Erro ao deletar orçamento: ' + e.message); }
  };

  const getBudget = (id: string) => budgets.find(b => b.id === id);

  const addBudgetVersion = async (budgetId: string, versionData: Omit<BudgetVersion, 'id' | 'budgetId' | 'version' | 'createdAt'>) => {
    const wsId = await ensureWorkspace();
    if (!wsId) {
      console.error('[CRM] addBudgetVersion: ensureWorkspace retornou null');
      return;
    }
    let currentVersion: number;
    const budget = budgets.find(b => b.id === budgetId);
    if (budget) {
      currentVersion = budget.currentVersion;
    } else {
      // Budget recém-criado, state ainda não atualizou - buscar do DB
      const { data: budgetData, error: fetchError } = await supabase
        .from('budgets').select('current_version')
        .eq('id', budgetId).maybeSingle();
      if (fetchError) {
        console.error('[CRM] addBudgetVersion: erro ao buscar budget:', fetchError.message);
        toast.error('Erro ao buscar orçamento: ' + fetchError.message);
        return;
      }
      if (!budgetData) {
        console.error('[CRM] addBudgetVersion: budget não encontrado no DB');
        toast.error('Orçamento não encontrado no banco de dados.');
        return;
      }
      currentVersion = budgetData.current_version ?? 0;
    }
    const newVersionNum = currentVersion + 1;
    try {
      const { data, error } = await supabase.from('budget_versions').insert({
        workspace_id: wsId, budget_id: budgetId, version: newVersionNum,
        services: versionData.services as any, operational_costs: versionData.operationalCosts as any,
        costs: versionData.costs as any, production_cost: versionData.productionCost,
        fixed_cost_percentage: versionData.fixedCostPercentage, nf_cost_percentage: versionData.nfCostPercentage,
        total_cost: versionData.totalCost, full_price: versionData.fullPrice,
        discount4_price: versionData.discount4Price, discount5_price: versionData.discount5Price,
        margin: versionData.margin, reason: versionData.reason,
        is_rejected: versionData.isRejected || false, rejection_reason: versionData.rejectionReason || null,
      }).select().single();
      if (error) {
        console.error('[CRM] addBudgetVersion: erro no insert:', error.message);
        throw error;
      }

      const { error: cvError } = await supabase.from('budgets').update({ current_version: newVersionNum }).eq('id', budgetId);
      if (cvError) console.error('[CRM] addBudgetVersion: erro ao atualizar current_version:', cvError.message);

      const newVersion = budgetVersionFromDb(data);
      setBudgets(prev => prev.map(b => {
        if (b.id === budgetId) {
          return { ...b, versions: [...b.versions, newVersion], currentVersion: newVersionNum, updatedAt: new Date() };
        }
        return b;
      }));
    } catch (e: any) {
      console.error('[CRM] addBudgetVersion: exceção:', e.message);
      toast.error('Erro ao adicionar versão: ' + e.message);
    }
  };

  const updateBudgetVersion = async (budgetId: string, versionId: string, updates: Partial<BudgetVersion>) => {
    try {
      const dbUpdates: any = {};
      if (updates.services !== undefined) dbUpdates.services = updates.services;
      if (updates.operationalCosts !== undefined) dbUpdates.operational_costs = updates.operationalCosts;
      if (updates.costs !== undefined) dbUpdates.costs = updates.costs;
      if (updates.productionCost !== undefined) dbUpdates.production_cost = updates.productionCost;
      if (updates.fixedCostPercentage !== undefined) dbUpdates.fixed_cost_percentage = updates.fixedCostPercentage;
      if (updates.nfCostPercentage !== undefined) dbUpdates.nf_cost_percentage = updates.nfCostPercentage;
      if (updates.totalCost !== undefined) dbUpdates.total_cost = updates.totalCost;
      if (updates.fullPrice !== undefined) dbUpdates.full_price = updates.fullPrice;
      if (updates.discount4Price !== undefined) dbUpdates.discount4_price = updates.discount4Price;
      if (updates.discount5Price !== undefined) dbUpdates.discount5_price = updates.discount5Price;
      if (updates.margin !== undefined) dbUpdates.margin = updates.margin;
      if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
      if (updates.isRejected !== undefined) dbUpdates.is_rejected = updates.isRejected;
      if (updates.rejectionReason !== undefined) dbUpdates.rejection_reason = updates.rejectionReason;

      const { error } = await supabase.from('budget_versions').update(dbUpdates).eq('id', versionId);
      if (error) throw error;

      // If updating the price of an approved budget, sync budgets.final_value so dashboards reflect it.
      // Covers editing the approved version and editing any version of an already-approved budget.
      const budget = budgets.find(b => b.id === budgetId);
      const editedVersion = budget?.versions.find(v => v.id === versionId);
      let newFinalValue: number | undefined;
      if (
        budget &&
        editedVersion &&
        updates.fullPrice !== undefined &&
        updates.fullPrice !== budget.finalValue &&
        (budget.status === 'aprovada' || budget.approvedVersion === editedVersion.version)
      ) {
        newFinalValue = updates.fullPrice;
        const { error: bErr } = await supabase
          .from('budgets')
          .update({ final_value: newFinalValue })
          .eq('id', budgetId);
        if (bErr) console.error('[CRM] updateBudgetVersion: erro ao sincronizar final_value:', bErr.message);
      }

      setBudgets(prev => prev.map(b => {
        if (b.id === budgetId) {
          return {
            ...b,
            versions: b.versions.map(v => v.id === versionId ? { ...v, ...updates } : v),
            finalValue: newFinalValue !== undefined ? newFinalValue : b.finalValue,
            updatedAt: new Date(),
          };
        }
        return b;
      }));
    } catch (e: any) { toast.error('Erro ao atualizar versão: ' + e.message); }
  };

  const deleteLastVersion = async (budgetId: string) => {
    try {
      const budget = budgets.find(b => b.id === budgetId);
      if (!budget || budget.versions.length <= 1) {
        toast.error('Não é possível excluir a única versão.');
        return;
      }
      const sortedVersions = [...budget.versions].sort((a, b) => b.version - a.version);
      const lastVersion = sortedVersions[0];
      if (lastVersion.version === budget.approvedVersion) {
        toast.error('Não é possível excluir uma versão aprovada.');
        return;
      }
      const { error } = await supabase.from('budget_versions').delete().eq('id', lastVersion.id);
      if (error) throw error;
      const newCurrentVersion = sortedVersions[1].version;
      const { error: cvError } = await supabase.from('budgets').update({ current_version: newCurrentVersion }).eq('id', budgetId);
      if (cvError) console.error('[CRM] deleteLastVersion: erro ao atualizar current_version:', cvError.message);
      setBudgets(prev => prev.map(b => {
        if (b.id === budgetId) {
          return { ...b, versions: b.versions.filter(v => v.id !== lastVersion.id), currentVersion: newCurrentVersion, updatedAt: new Date() };
        }
        return b;
      }));
      toast.success(`Versão V${lastVersion.version} excluída com sucesso!`);
    } catch (e: any) {
      toast.error('Erro ao excluir versão: ' + e.message);
    }
  };

  const approveBudget = async (budgetId: string, versionNumber: number, executionMonth?: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;

    const approvedVersion = budget.versions.find(v => v.version === versionNumber);
    let execution: ProjectExecution | null = null;

    if (approvedVersion && approvedVersion.services && approvedVersion.services.length > 0) {
      const opCosts = approvedVersion.operationalCosts || [];
      const opCostsTotal = opCosts.reduce((sum, c) => sum + c.value, 0);
      execution = {
        id: uuidv4(), budgetId, approvedVersionId: approvedVersion.id, executor: '', nfTaxValue: 0,
        services: approvedVersion.services.map(service => {
          const serviceCostTotal = service.costs.reduce((sum, c) => sum + c.value, 0);
          const serviceCalc = calculateServiceTotals(service);
          return {
            id: service.id, serviceType: service.serviceType, objective: service.objective, description: service.description,
            costs: service.costs.map(cost => ({ ...cost, budgetedValue: cost.value, realValue: cost.value, supplier: '' })),
            extraCosts: [], budgetedTotal: serviceCostTotal, realTotal: serviceCostTotal,
            budgetedFinalValue: serviceCalc.finalValue, finalValue: serviceCalc.finalValue, nfTaxProportion: 0,
          };
        }),
        operationalCosts: opCosts.map(cost => ({ ...cost, budgetedValue: cost.value, realValue: cost.value, supplier: '' })),
        extraOperationalCosts: [],
        budgetedTotal: approvedVersion.totalCost + opCostsTotal, realTotal: approvedVersion.totalCost + opCostsTotal, realMargin: approvedVersion.margin,
        isFinalized: false, finalizedAt: null, deliveryLinks: [], createdAt: new Date(), updatedAt: new Date(),
      };
    }

    try {
      const { error: approveError } = await supabase.from('budgets').update({
        status: 'aprovada', approved_version: versionNumber,
        approval_date: new Date().toISOString(), final_value: approvedVersion?.fullPrice || null,
        execution: execution as any,
        execution_month: executionMonth || null,
      }).eq('id', budgetId);
      if (approveError) {
        console.error('[CRM] approveBudget: erro ao atualizar budget:', approveError.message);
        throw approveError;
      }

      setBudgets(prev => prev.map(b => {
        if (b.id === budgetId) {
          return {
            ...b, status: 'aprovada' as CRMStatus, approvedVersion: versionNumber,
            approvalDate: new Date(), finalValue: approvedVersion?.fullPrice || null, execution,
            executionMonth: executionMonth || null, updatedAt: new Date(),
          };
        }
        return b;
      }));

      // Auto-create project card
      const alreadyExists = projectCards.some(pc => pc.budgetId === budgetId);
      if (!alreadyExists && workspaceId) {
        const client = clients.find(c => c.id === budget.clientId);
        const serviceTypes = approvedVersion?.services ? [...new Set(approvedVersion.services.map(s => s.serviceType))] : [budget.serviceType];
        const objective = approvedVersion?.services?.[0]?.objective || budget.objective || '';
        const firstColKey = [...projectColumns].sort((a, b) => a.order - b.order)[0]?.key || 'planejamento';

        const { data: pcData, error: pcError } = await supabase.from('project_cards').insert({
          workspace_id: workspaceId, budget_id: budgetId, proposal_id: budget.proposalId,
          project_name: budget.projectName, client_name: client?.companyName || 'Cliente não encontrado',
          client_id: budget.clientId, service_types: serviceTypes as any, objective,
          status: firstColKey, progress: 0, tasks: [] as any, links: [] as any, comments: [] as any,
          material_link: '', start_date: budget.executionStartDate?.toISOString() || null,
          end_date: budget.executionEndDate?.toISOString() || null, notes: '',
        }).select().single();
        if (pcError) console.error('[CRM] approveBudget: erro ao criar project card:', pcError.message);
        if (pcData) setProjectCards(prev => [...prev, projectCardFromDb(pcData)]);
      }
    } catch (e: any) { toast.error('Erro ao aprovar orçamento: ' + e.message); }
  };

  // ============= Execution functions (update JSONB on budget) =============
  const persistExecution = async (budgetId: string, execution: ProjectExecution): Promise<boolean> => {
    try {
      const { error } = await supabase.from('budgets').update({ execution: execution as any }).eq('id', budgetId);
      if (error) {
        console.error('[CRM] Error persisting execution:', error);
        toast.error('Erro ao salvar dados de execução: ' + error.message);
        return false;
      }
      return true;
    } catch (e: any) {
      console.error('[CRM] Error persisting execution:', e);
      toast.error('Erro ao salvar dados de execução');
      return false;
    }
  };

  const updateExecution = async (budgetId: string, executionUpdates: Partial<ProjectExecution>) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget?.execution) return;

    const updatedExecution = { ...budget.execution, ...executionUpdates, updatedAt: new Date() };
    if (executionUpdates.nfTaxValue !== undefined) {
      const totalServiceValue = updatedExecution.services.reduce((sum, s) => sum + s.realTotal, 0);
      updatedExecution.services = updatedExecution.services.map(service => ({
        ...service, nfTaxProportion: totalServiceValue > 0 ? (service.realTotal / totalServiceValue) * executionUpdates.nfTaxValue! : 0,
      }));
    }
    if (executionUpdates.operationalCosts || executionUpdates.extraOperationalCosts) {
      const serviceTotal = updatedExecution.services.reduce((sum, s) => sum + s.realTotal, 0);
      const opTotal = (updatedExecution.operationalCosts || []).reduce((sum, c) => sum + c.realValue, 0);
      const extraOpTotal = (updatedExecution.extraOperationalCosts || []).reduce((sum, c) => sum + c.realValue, 0);
      updatedExecution.realTotal = serviceTotal + opTotal + extraOpTotal;
      const finalValue = budget.finalValue || updatedExecution.budgetedTotal;
      updatedExecution.realMargin = finalValue > 0 ? ((finalValue - updatedExecution.realTotal) / finalValue) * 100 : 0;
    }

    // Optimistic update
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: updatedExecution, updatedAt: new Date() } : b));

    const success = await persistExecution(budgetId, updatedExecution);
    if (!success) {
      // Rollback
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: budget.execution, updatedAt: budget.updatedAt } : b));
    }
  };

  const updateExecutionCost = async (budgetId: string, serviceId: string, costId: string, updates: Partial<ExecutionCostItem>, isExtraCost = false) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget?.execution) return;

    const updatedServices = budget.execution.services.map(service => {
      if (service.id === serviceId) {
        let updatedCosts = service.costs;
        let updatedExtraCosts = service.extraCosts || [];
        if (isExtraCost) {
          updatedExtraCosts = updatedExtraCosts.map(cost => cost.id === costId ? { ...cost, ...updates } : cost);
        } else {
          updatedCosts = updatedCosts.map(cost => cost.id === costId ? { ...cost, ...updates } : cost);
        }
        const realTotal = updatedCosts.reduce((sum, c) => sum + c.realValue, 0) + updatedExtraCosts.reduce((sum, c) => sum + c.realValue, 0);
        return { ...service, costs: updatedCosts, extraCosts: updatedExtraCosts, realTotal };
      }
      return service;
    });
    const realTotal = updatedServices.reduce((sum, s) => sum + s.realTotal, 0);
    const finalValue = budget.finalValue || budget.execution.budgetedTotal;
    const realMargin = finalValue > 0 ? ((finalValue - realTotal) / finalValue) * 100 : 0;
    const updatedExecution = { ...budget.execution, services: updatedServices, realTotal, realMargin, updatedAt: new Date() };

    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: updatedExecution, updatedAt: new Date() } : b));

    const success = await persistExecution(budgetId, updatedExecution);
    if (!success) {
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: budget.execution, updatedAt: budget.updatedAt } : b));
    }
  };

  const addExtraCost = async (budgetId: string, serviceId: string, cost: Omit<ExecutionCostItem, 'id' | 'budgetedValue'>) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget?.execution) return;

    const updatedServices = budget.execution.services.map(service => {
      if (service.id === serviceId) {
        const newCost: ExecutionCostItem = { ...cost, id: uuidv4(), budgetedValue: 0 };
        const updatedExtraCosts = [...(service.extraCosts || []), newCost];
        const realTotal = service.costs.reduce((sum, c) => sum + c.realValue, 0) + updatedExtraCosts.reduce((sum, c) => sum + c.realValue, 0);
        return { ...service, extraCosts: updatedExtraCosts, realTotal };
      }
      return service;
    });
    const realTotal = updatedServices.reduce((sum, s) => sum + s.realTotal, 0);
    const finalValue = budget.finalValue || budget.execution.budgetedTotal;
    const realMargin = finalValue > 0 ? ((finalValue - realTotal) / finalValue) * 100 : 0;
    const updatedExecution = { ...budget.execution, services: updatedServices, realTotal, realMargin, updatedAt: new Date() };

    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: updatedExecution, updatedAt: new Date() } : b));

    const success = await persistExecution(budgetId, updatedExecution);
    if (!success) {
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: budget.execution, updatedAt: budget.updatedAt } : b));
    }
  };

  const removeExtraCost = async (budgetId: string, serviceId: string, costId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget?.execution) return;

    const updatedServices = budget.execution.services.map(service => {
      if (service.id === serviceId) {
        const updatedExtraCosts = (service.extraCosts || []).filter(c => c.id !== costId);
        const realTotal = service.costs.reduce((sum, c) => sum + c.realValue, 0) + updatedExtraCosts.reduce((sum, c) => sum + c.realValue, 0);
        return { ...service, extraCosts: updatedExtraCosts, realTotal };
      }
      return service;
    });
    const realTotal = updatedServices.reduce((sum, s) => sum + s.realTotal, 0);
    const finalValue = budget.finalValue || budget.execution.budgetedTotal;
    const realMargin = finalValue > 0 ? ((finalValue - realTotal) / finalValue) * 100 : 0;
    const updatedExecution = { ...budget.execution, services: updatedServices, realTotal, realMargin, updatedAt: new Date() };

    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: updatedExecution, updatedAt: new Date() } : b));

    const success = await persistExecution(budgetId, updatedExecution);
    if (!success) {
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: budget.execution, updatedAt: budget.updatedAt } : b));
    }
  };

  const finalizeExecution = async (budgetId: string, finalReport?: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget?.execution) return;

    const updatedExecution = {
      ...budget.execution, isFinalized: true, finalizedAt: new Date(),
      finalReport: finalReport || budget.execution.finalReport, updatedAt: new Date(),
    };

    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: updatedExecution, updatedAt: new Date() } : b));

    const success = await persistExecution(budgetId, updatedExecution);
    if (!success) {
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: budget.execution, updatedAt: budget.updatedAt } : b));
    }
  };

  const addDeliveryLink = async (budgetId: string, link: Omit<DeliveryLink, 'id' | 'createdAt'>) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget?.execution) return;

    const newLink: DeliveryLink = { ...link, id: uuidv4(), createdAt: new Date() };
    const updatedExecution = {
      ...budget.execution, deliveryLinks: [...budget.execution.deliveryLinks, newLink], updatedAt: new Date(),
    };

    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: updatedExecution, updatedAt: new Date() } : b));

    const success = await persistExecution(budgetId, updatedExecution);
    if (!success) {
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: budget.execution, updatedAt: budget.updatedAt } : b));
    }
  };

  const removeDeliveryLink = async (budgetId: string, linkId: string) => {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget?.execution) return;

    const updatedExecution = {
      ...budget.execution, deliveryLinks: budget.execution.deliveryLinks.filter(l => l.id !== linkId), updatedAt: new Date(),
    };

    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: updatedExecution, updatedAt: new Date() } : b));

    const success = await persistExecution(budgetId, updatedExecution);
    if (!success) {
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, execution: budget.execution, updatedAt: budget.updatedAt } : b));
    }
  };

  // ============= Hard Drive functions =============
  const addHardDrive = async (hdData: Omit<HardDrive, 'id' | 'projects' | 'createdAt'>) => {
    const wsId = await ensureWorkspace();
    if (!wsId) return;
    try {
      const { data, error } = await supabase.from('hard_drives').insert({
        workspace_id: wsId, label: hdData.label, capacity_gb: hdData.capacityGB, projects: [] as any,
      }).select().single();
      if (error) throw error;
      setHardDrives(prev => [...prev, hardDriveFromDb(data)]);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const updateHardDrive = async (id: string, updates: Partial<Pick<HardDrive, 'label' | 'capacityGB'>>) => {
    try {
      const dbUpdates: any = {};
      if (updates.label !== undefined) dbUpdates.label = updates.label;
      if (updates.capacityGB !== undefined) dbUpdates.capacity_gb = updates.capacityGB;
      const { error } = await supabase.from('hard_drives').update(dbUpdates).eq('id', id);
      if (error) throw error;
      setHardDrives(prev => prev.map(hd => hd.id === id ? { ...hd, ...updates } : hd));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const deleteHardDrive = async (id: string) => {
    try {
      const { error } = await supabase.from('hard_drives').delete().eq('id', id);
      if (error) throw error;
      setHardDrives(prev => prev.filter(hd => hd.id !== id));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const allocateProjectToHD = async (hdId: string, allocation: Omit<HDProjectAllocation, 'id' | 'allocatedAt'>) => {
    const hd = hardDrives.find(h => h.id === hdId);
    if (!hd) return;
    const newAllocation: HDProjectAllocation = { ...allocation, id: uuidv4(), allocatedAt: new Date() };
    const updatedProjects = [...hd.projects, newAllocation];
    try {
      const { error } = await supabase.from('hard_drives').update({ projects: updatedProjects as any }).eq('id', hdId);
      if (error) throw error;
      setHardDrives(prev => prev.map(h => h.id === hdId ? { ...h, projects: updatedProjects } : h));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const removeProjectFromHD = async (hdId: string, allocationId: string) => {
    const hd = hardDrives.find(h => h.id === hdId);
    if (!hd) return;
    const updatedProjects = hd.projects.filter(p => p.id !== allocationId);
    try {
      const { error } = await supabase.from('hard_drives').update({ projects: updatedProjects as any }).eq('id', hdId);
      if (error) throw error;
      setHardDrives(prev => prev.map(h => h.id === hdId ? { ...h, projects: updatedProjects } : h));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  // ============= Legacy Project functions =============
  const deleteLegacyProject = async (id: string) => {
    try {
      const { error } = await supabase.from('legacy_projects').delete().eq('id', id);
      if (error) throw error;
      setLegacyProjects(prev => prev.filter(p => p.id !== id));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const getLegacyProject = (id: string) => legacyProjects.find(p => p.id === id);

  const getHDForBudget = useCallback((budgetId: string): { hdLabel: string; hdId: string } | null => {
    for (const hd of hardDrives) {
      if (hd.projects.some(p => p.budgetId === budgetId)) return { hdLabel: hd.label, hdId: hd.id };
    }
    return null;
  }, [hardDrives]);

  // ============= Asset functions =============
  const addAsset = async (assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset | null> => {
    const wsId = await ensureWorkspace();
    if (!wsId) return null;
    try {
      const { data, error } = await supabase.from('assets').insert({
        workspace_id: wsId, name: assetData.name, description: assetData.description,
        value: assetData.value, serial_number: assetData.serialNumber,
        hero_asset_number: assetData.heroAssetNumber, photo: assetData.photo,
        reference_link: assetData.referenceLink, assigned_to: assetData.assignedTo,
      }).select().single();
      if (error) throw error;
      const newAsset = assetFromDb(data);
      setAssets(prev => [...prev, newAsset]);
      return newAsset;
    } catch (e: any) { toast.error('Erro: ' + e.message); return null; }
  };

  const updateAsset = async (id: string, updates: Partial<Asset>) => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.value !== undefined) dbUpdates.value = updates.value;
      if (updates.serialNumber !== undefined) dbUpdates.serial_number = updates.serialNumber;
      if (updates.heroAssetNumber !== undefined) dbUpdates.hero_asset_number = updates.heroAssetNumber;
      if (updates.photo !== undefined) dbUpdates.photo = updates.photo;
      if (updates.referenceLink !== undefined) dbUpdates.reference_link = updates.referenceLink;
      if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;
      const { error } = await supabase.from('assets').update(dbUpdates).eq('id', id);
      if (error) throw error;
      setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const deleteAsset = async (id: string) => {
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
      setAssets(prev => prev.filter(a => a.id !== id));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  // ============= Project Card functions =============
  const updateProjectCard = async (id: string, updates: Partial<ProjectCard>) => {
    try {
      const dbUpdates: any = {};
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
      if (updates.tasks !== undefined) dbUpdates.tasks = updates.tasks as any;
      if (updates.links !== undefined) dbUpdates.links = updates.links as any;
      if (updates.comments !== undefined) dbUpdates.comments = updates.comments as any;
      if (updates.materialLink !== undefined) dbUpdates.material_link = updates.materialLink;
      if (updates.materialLinks !== undefined) (dbUpdates as any).material_links = updates.materialLinks;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate?.toISOString() || null;
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate?.toISOString() || null;
      if (updates.projectName !== undefined) dbUpdates.project_name = updates.projectName;
      if (updates.objective !== undefined) dbUpdates.objective = updates.objective;
      if (updates.serviceTypes !== undefined) dbUpdates.service_types = updates.serviceTypes as any;
      if (updates.driveUrl !== undefined) dbUpdates.drive_url = updates.driveUrl;

      const { error } = await supabase.from('project_cards').update(dbUpdates).eq('id', id);
      if (error) throw error;
      setProjectCards(prev => prev.map(card => card.id === id ? { ...card, ...updates, updatedAt: new Date() } : card));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const deleteProjectCard = async (id: string) => {
    try {
      await supabase.from('project_activities').delete().eq('project_card_id', id);
      const { error } = await supabase.from('project_cards').delete().eq('id', id);
      if (error) throw error;
      setProjectCards(prev => prev.filter(card => card.id !== id));
      toast.success('Projeto excluído da gestão de projetos');
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const archiveProjectCards = async (ids: string[], groupName: string) => {
    const wsId = await ensureWorkspace();
    const group = groupName.trim();
    if (!group || ids.length === 0) return;
    try {
      const cards = projectCards.filter(c => ids.includes(c.id));
      const rows = cards.map(c => ({
        workspace_id: wsId,
        group_name: group,
        project_number: c.proposalId || '',
        project_name: c.projectName || '',
        client_name: c.clientName || '',
        link: c.driveUrl || c.materialLink || (c.materialLinks?.[0] ?? '') || '',
        source_card_id: c.id,
      }));
      const { error: insErr } = await supabase.from('archived_projects').insert(rows);
      if (insErr) throw insErr;

      const { error: updErr } = await supabase
        .from('project_cards')
        .update({ archived_at: new Date().toISOString() })
        .in('id', ids);
      if (updErr) throw updErr;

      setProjectCards(prev => prev.filter(c => !ids.includes(c.id)));
      toast.success(`${ids.length} projeto(s) enviado(s) para o histórico`);
    } catch (e: any) {
      toast.error('Erro ao arquivar: ' + e.message);
      throw e;
    }
  };



  const addProjectColumn = async (colData: Omit<ProjectColumn, 'id' | 'order'>) => {
    const wsId = await ensureWorkspace();
    if (!wsId) return;
    const maxOrder = Math.max(...projectColumns.map(c => c.order), -1);
    try {
      const { data, error } = await supabase.from('project_columns').insert({
        workspace_id: wsId, key: colData.key, label: colData.label,
        color: colData.color, order: maxOrder + 1, is_default: colData.isDefault || false,
      }).select().single();
      if (error) throw error;
      setProjectColumns(prev => [...prev, projectColumnFromDb(data)]);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const updateProjectColumn = async (id: string, updates: Partial<ProjectColumn>) => {
    try {
      const dbUpdates: any = {};
      if (updates.key !== undefined) dbUpdates.key = updates.key;
      if (updates.label !== undefined) dbUpdates.label = updates.label;
      if (updates.color !== undefined) dbUpdates.color = updates.color;
      const { error } = await supabase.from('project_columns').update(dbUpdates).eq('id', id);
      if (error) throw error;
      setProjectColumns(prev => prev.map(col => col.id === id ? { ...col, ...updates } : col));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const deleteProjectColumn = async (id: string) => {
    const col = projectColumns.find(c => c.id === id);
    if (col?.isDefault) return;
    try {
      const firstCol = [...projectColumns].sort((a, b) => a.order - b.order)[0];
      if (firstCol && col) {
        const { error: moveCardsError } = await supabase.from('project_cards').update({ status: firstCol.key }).eq('workspace_id', workspaceId!).eq('status', col.key);
        if (moveCardsError) console.error('[CRM] deleteProjectColumn: erro ao mover cards:', moveCardsError.message);
        setProjectCards(prev => prev.map(card => card.status === col.key ? { ...card, status: firstCol.key } : card));
      }
      const { error } = await supabase.from('project_columns').delete().eq('id', id);
      if (error) throw error;
      setProjectColumns(prev => prev.filter(c => c.id !== id));
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  };

  const reorderProjectColumns = async (orderedIds: string[]) => {
    try {
      const updates = orderedIds.map((id, idx) =>
        supabase.from('project_columns').update({ order: idx }).eq('id', id)
      );
      await Promise.all(updates);
      setProjectColumns(prev => {
        const map = new Map(prev.map(c => [c.id, c]));
        return orderedIds.map((id, idx) => ({ ...(map.get(id) as ProjectColumn), order: idx })).filter(Boolean);
      });
    } catch (e: any) { toast.error('Erro ao reordenar: ' + e.message); }
  };
  const getCRMCards = (): CRMCard[] => {
    const wsContacts = clientContacts.filter(c => c.workspace_id === workspaceId);
    const contactById = new Map(wsContacts.map(c => [c.id, c]));
    const primaryByClient = new Map<string, { name: string; phone: string }>();
    wsContacts.forEach(c => {
      if (c.is_primary && !primaryByClient.has(c.client_id)) primaryByClient.set(c.client_id, c);
    });
    return budgets.map(budget => {
      const client = getClient(budget.clientId);
      const currentVersionData = budget.versions.find(v => v.version === budget.currentVersion);
      const serviceTypes: ServiceType[] = currentVersionData?.services
        ? [...new Set(currentVersionData.services.map(s => s.serviceType))] : [budget.serviceType];
      const isRecurring = budget.isRecurring ?? false;
      const contact = (budget.contactId ? contactById.get(budget.contactId) : undefined)
        || primaryByClient.get(budget.clientId);
      return {
        id: budget.id, budgetId: budget.id,
        projectName: `${budget.proposalId} - ${budget.projectName}`,
        clientName: client?.companyName || 'Cliente não encontrado',
        clientId: budget.clientId, serviceType: budget.serviceType, serviceTypes,
        value: currentVersionData?.fullPrice || null, status: budget.status,
        clientScore: client?.score || 0, currentVersion: budget.currentVersion,
        executionMonth: budget.executionMonth,
        rejectionReason: budget.rejectionReason,
        rejectionObservation: budget.rejectionObservation,
        createdAt: budget.createdAt.toISOString(),
        isRecurring,
        contactName: contact?.name || client?.responsiblePerson || null,
        contactPhone: contact?.phone || client?.phone || null,
      };
    });
  };

  const getCardsByStatus = (status: CRMStatus) => getCRMCards()
    .filter(card => card.status === status)
    .sort((a, b) => {
      const numA = parseInt(a.projectName, 10);
      const numB = parseInt(b.projectName, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.projectName.localeCompare(b.projectName);
    });

  const moveCard = (cardId: string, newStatus: CRMStatus) => {
    updateBudgetStatus(cardId, newStatus);
  };

  const value: CRMContextType = useMemo(() => ({
    isLoading,
    clients, addClient, updateClient, deleteClient, getClient, getClientScoreBreakdown,
    budgets, addBudget, updateBudget, updateBudgetStatus, deleteBudget, getBudget,
    addBudgetVersion, updateBudgetVersion, deleteLastVersion, approveBudget, duplicateBudget,
    updateExecution, updateExecutionCost, addExtraCost, removeExtraCost, finalizeExecution, addDeliveryLink, removeDeliveryLink,
    kanbanColumns, addKanbanColumn, updateKanbanColumn, deleteKanbanColumn, reorderKanbanColumns, getStatusLabel,
    serviceCategories, serviceObjectives, addServiceCategory, updateServiceCategory, deleteServiceCategory, reorderServiceCategories,
    addServiceObjective, updateServiceObjective, deleteServiceObjective, reorderServiceObjectives, getObjectivesForCategory, getCategoryLabel,
    hardDrives, addHardDrive, updateHardDrive, deleteHardDrive, allocateProjectToHD, removeProjectFromHD,
    legacyProjects, deleteLegacyProject, getLegacyProject, getHDForBudget,
    scoreHistory, getClientScoreHistory,
    assets, addAsset, updateAsset, deleteAsset,
    projectCards, projectColumns, updateProjectCard, deleteProjectCard, archiveProjectCards, addProjectColumn, updateProjectColumn, deleteProjectColumn, reorderProjectColumns,
    getCRMCards, getCardsByStatus, moveCard,
  }), [
    // workspaceId/session entram nas deps para evitar closures desatualizadas
    // das funções (que não são useCallback) ao trocar de workspace ou sessão.
    workspaceId, session,
    isLoading, clients, budgets, kanbanColumns, serviceCategories, serviceObjectives,
    hardDrives, legacyProjects, scoreHistory, assets, projectCards, projectColumns, clientContacts,
  ]);

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (context === undefined) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}
