import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';
import { generateProposalPDF } from '@/utils/pdfGenerator';
import type { PDFLayoutSettings } from '@/utils/pdfGenerator';
import { generateFinancialReportPDF } from '@/utils/financialReportPDF';
import { generateContractPDF } from '@/utils/contractPDF';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { useCRM } from '@/contexts/CRMContext';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import {
  CRMStatus,
  ServiceType,
  CostItem,
  PaymentStatus,
  PAYMENT_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  formatCurrency,
  formatCNPJ,
  formatPhone,
  calculateServiceTotals,
  ServiceItem,
  ExecutionCostItem,
  BudgetVersion,
  PaymentStatus as PaymentStatusType,
  DeliveryType,
  DELIVERY_TYPE_LABELS,
} from '@/types/crm';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TeamMemberSelect } from '@/components/crm/TeamMemberSelect';
import { SortableTableBody } from '@/components/crm/SortableTableBody';
import { ServiceItemSelector } from '@/components/crm/ServiceItemSelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  FileText,
  Plus,
  Trash2,
  Calculator,
  Download,
  Copy,
  CheckCircle,
  Check,
  Upload,
  Building2,
  User,
  Phone,
  Calendar,
  DollarSign,
  TrendingUp,
  Edit2,
  Save,
  Film,
  Camera,
  Smartphone,
  BarChart3,
  XCircle,
  Link,
  ExternalLink,
  Flag,
  HardDrive,
  Layers,
  LockKeyhole,
  Eye,
  Loader2,
  AlertCircle,
  Package,
  Repeat,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SERVICE_ICONS: Record<string, typeof Film> = {
  CINE: Film,
  FOTO: Camera,
  MOBILE: Smartphone,
};

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatExecutionMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES_PT[idx] || month}/${year}`;
}

export function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, workspace, role } = useAuth();
  const { getBudget, getClient, updateBudget, addBudgetVersion, approveBudget, updateBudgetVersion, deleteLastVersion, updateExecutionCost, updateExecution, addExtraCost, removeExtraCost, deleteBudget, finalizeExecution, addDeliveryLink, removeDeliveryLink, kanbanColumns, getObjectivesForCategory, getCategoryLabel, serviceCategories, getHDForBudget } = useCRM();

  const budget = getBudget(id || '');
  const client = budget ? getClient(budget.clientId) : null;

  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newVersionReason, setNewVersionReason] = useState('');
  const [newVersionServices, setNewVersionServices] = useState<ServiceItem[]>([]);
  const [newVersionOperationalCosts, setNewVersionOperationalCosts] = useState<CostItem[]>([]);
  const [newVersionFixedCostPct, setNewVersionFixedCostPct] = useState(0); // deprecated, always 0
  const [newVersionNfPct, setNewVersionNfPct] = useState(13);
  const [newVersionTargetMargin, setNewVersionTargetMargin] = useState(0);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveExecutionMonth, setApproveExecutionMonth] = useState('');
  const [isEditingExecutionMonth, setIsEditingExecutionMonth] = useState(false);
  const [editedExecutionMonth, setEditedExecutionMonth] = useState('');
  const [executionNfValue, setExecutionNfValue] = useState<number>(0);
  const [isEditingNf, setIsEditingNf] = useState(false);
  const [isEditingExecDate, setIsEditingExecDate] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPaymentTerms, setEditedPaymentTerms] = useState('');
  const [editedProjectName, setEditedProjectName] = useState('');
  const [editedProjectDescription, setEditedProjectDescription] = useState('');
  const [editedProposalId, setEditedProposalId] = useState('');
  const [editedLocation, setEditedLocation] = useState('');
  const [editedIncludesTax, setEditedIncludesTax] = useState(false);
  const [editedIncludesLogistics, setEditedIncludesLogistics] = useState(false);
  const [editedIncludesAccommodation, setEditedIncludesAccommodation] = useState(false);
  const [editedIncludesMeals, setEditedIncludesMeals] = useState(false);
  const [editedIncludesRawMaterial, setEditedIncludesRawMaterial] = useState(false);
  const [editedIncludesTechnicalVisit, setEditedIncludesTechnicalVisit] = useState(false);
  const [editedHasExecutionDate, setEditedHasExecutionDate] = useState(false);
  const [editedExecutionStartDate, setEditedExecutionStartDate] = useState<Date | null>(null);
  const [editedExecutionEndDate, setEditedExecutionEndDate] = useState<Date | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const fromParam = searchParams.get('from');
  const initialTab = searchParams.get('tab') === 'execution' ? 'execution' : 'budget';
  const [activeTab, setActiveTab] = useState(initialTab);
  const backTo = fromParam === 'financeiro' ? '/financeiro?tab=projetos' : '/crm';
  const backLabel = fromParam === 'financeiro' ? 'Voltar para Projetos/Mês' : 'Voltar ao CRM';
  const [deleteOpen, setDeleteOpen] = useState(false);
  
  // Inline version editing states
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewVersion, setPdfPreviewVersion] = useState<BudgetVersion | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [editVersionServices, setEditVersionServices] = useState<ServiceItem[]>([]);
  const [editVersionOperationalCosts, setEditVersionOperationalCosts] = useState<CostItem[]>([]);
  const [editVersionNfPct, setEditVersionNfPct] = useState(13);
  const [editVersionTargetMargin, setEditVersionTargetMargin] = useState(0);

  // Catalog (service items) selector
  const [catalogSelector, setCatalogSelector] = useState<{
    open: boolean;
    categoryKey: string;
    onPick: (item: { description: string; unitValue: number }) => void;
  }>({ open: false, categoryKey: '', onPick: () => {} });

  const openCatalogForEditService = (serviceId: string, categoryKey: string) => {
    setCatalogSelector({
      open: true,
      categoryKey,
      onPick: ({ description, unitValue }) => {
        setEditVersionServices(prev => prev.map(s =>
          s.id === serviceId
            ? { ...s, costs: [...s.costs, { id: uuidv4(), description, quantity: 1, unitValue, value: unitValue, paymentStatus: 'pendente' as PaymentStatus, paymentDate: null }] }
            : s
        ));
      },
    });
  };

  const openCatalogForEditOperational = () => {
    setCatalogSelector({
      open: true,
      categoryKey: 'despesas_operacionais',
      onPick: ({ description, unitValue }) => {
        setEditVersionOperationalCosts(prev => [...prev, { id: uuidv4(), description, quantity: 1, unitValue, value: unitValue, paymentStatus: 'pendente' as PaymentStatus, paymentDate: null }]);
      },
    });
  };

  const openCatalogForNewVersionService = (serviceId: string, categoryKey: string) => {
    setCatalogSelector({
      open: true,
      categoryKey,
      onPick: ({ description, unitValue }) => {
        setNewVersionServices(prev => prev.map(s =>
          s.id === serviceId
            ? { ...s, costs: [...s.costs, { id: uuidv4(), description, quantity: 1, unitValue, value: unitValue, paymentStatus: 'pendente' as PaymentStatus, paymentDate: null }] }
            : s
        ));
      },
    });
  };

  const openCatalogForNewVersionOperational = () => {
    setCatalogSelector({
      open: true,
      categoryKey: 'despesas_operacionais',
      onPick: ({ description, unitValue }) => {
        setNewVersionOperationalCosts(prev => [...prev, { id: uuidv4(), description, quantity: 1, unitValue, value: unitValue, paymentStatus: 'pendente' as PaymentStatus, paymentDate: null }]);
      },
    });
  };

  // Commercial rules (loaded for draft editing)
  const [availablePaymentTerms, setAvailablePaymentTerms] = useState<{ id: string; name: string }[]>([]);
  const [defaultTargetMargin, setDefaultTargetMargin] = useState<number>(20);

  useEffect(() => {
    if (!workspace?.id) return;
    supabase
      .from('payment_terms')
      .select('id, name')
      .eq('workspace_id', workspace.id)
      .eq('active', true)
      .order('created_at')
      .then(({ data }) => {
        if (data) setAvailablePaymentTerms(data);
      });
    supabase
      .from('workspace_settings')
      .select('default_target_margin_percentage')
      .eq('workspace_id', workspace.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.default_target_margin_percentage != null) {
          setDefaultTargetMargin(Number(data.default_target_margin_percentage));
        }
      });
  }, [workspace?.id]);
  
  // Rejection dialog states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingVersionId, setRejectingVersionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Extra cost dialog states
  const [extraCostDialogOpen, setExtraCostDialogOpen] = useState(false);
  const [selectedServiceForExtraCost, setSelectedServiceForExtraCost] = useState<string | null>(null);
  const [newExtraCostDescription, setNewExtraCostDescription] = useState('');
  const [newExtraCostValue, setNewExtraCostValue] = useState<number>(0);
  const [newExtraCostSupplier, setNewExtraCostSupplier] = useState('');

  // Finalization dialog states
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [finalReport, setFinalReport] = useState('');
  
  // Delivery link states
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showAddLink, setShowAddLink] = useState(false);
  
  // Notion link state
  const [notionInput, setNotionInput] = useState('');
  const [isEditingNotion, setIsEditingNotion] = useState(false);

  // Document upload states (contract / NF)
  const [uploadingDoc, setUploadingDoc] = useState<'contract' | 'nf' | null>(null);

  const handleDocUpload = async (type: 'contract' | 'nf', file: File) => {
    if (!budget || !workspace) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 20MB)');
      return;
    }
    setUploadingDoc(type);
    try {
      const path = `${workspace.id}/${budget.id}/${type}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('budget-documents')
        .upload(path, file, { contentType: 'application/pdf', upsert: true });
      if (upErr) throw upErr;
      await updateBudget(budget.id, type === 'contract' ? { contractUrl: path } : { nfUrl: path });
      toast.success(type === 'nf' ? 'Nota Fiscal enviada' : 'Contrato enviado');
    } catch (e: any) {
      toast.error(e.message || 'Falha no upload');
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleViewDoc = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('budget-documents')
      .createSignedUrl(path, 3600);
    if (error || !data) {
      toast.error('Não foi possível abrir o arquivo');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleRemoveDoc = async (type: 'contract' | 'nf') => {
    if (!budget) return;
    const path = type === 'contract' ? budget.contractUrl : budget.nfUrl;
    if (path) {
      await supabase.storage.from('budget-documents').remove([path]);
    }
    await updateBudget(budget.id, type === 'contract' ? { contractUrl: null } : { nfUrl: null });
    toast.success('Arquivo removido');
  };
  // Calculate totals for new version (hooks must be before early returns)
  const newVersionOperationalTotal = useMemo(() => {
    return newVersionOperationalCosts.reduce((sum, c) => sum + c.value, 0);
  }, [newVersionOperationalCosts]);

  const newVersionTotals = useMemo(() => {
    const productionCost = newVersionServices.reduce((sum, service) => {
      return sum + service.costs.reduce((s, c) => s + (c.value || 0), 0);
    }, 0);
    const operationalTotal = newVersionOperationalTotal;
    const totalCosts = productionCost + operationalTotal;

    const divisor = 1 - (newVersionTargetMargin / 100) - (newVersionNfPct / 100);
    const totalProjectValue = divisor > 0 ? totalCosts / divisor : totalCosts;
    const nfValue = totalProjectValue * (newVersionNfPct / 100);
    const marginValue = totalProjectValue - totalCosts - nfValue;

    return { productionCost, operationalTotal, totalCosts, totalProjectValue, nfValue, marginValue };
  }, [newVersionServices, newVersionOperationalTotal, newVersionNfPct, newVersionTargetMargin]);
  // Inline version editing computed totals
  const editVersionTotals = useMemo(() => {
    const productionCost = editVersionServices.reduce((sum, service) => {
      return sum + service.costs.reduce((s, c) => s + (c.value || 0), 0);
    }, 0);
    const operationalTotal = editVersionOperationalCosts.reduce((sum, c) => sum + c.value, 0);
    const totalCosts = productionCost + operationalTotal;
    const divisor = 1 - (editVersionTargetMargin / 100) - (editVersionNfPct / 100);
    const totalProjectValue = divisor > 0 ? totalCosts / divisor : totalCosts;
    return { productionCost, operationalTotal, totalCosts, totalProjectValue };
  }, [editVersionServices, editVersionOperationalCosts, editVersionNfPct, editVersionTargetMargin]);

  if (!budget || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Orçamento não encontrado</h2>
          <Button onClick={() => navigate('/crm')}>Voltar ao CRM</Button>
        </div>
      </div>
    );
  }

  const currentVersionData = budget.versions.find(
    (v) => v.version === budget.currentVersion
  );

  const handleStatusChange = (status: CRMStatus) => {
    updateBudget(budget.id, { status });
    toast.success('Status atualizado!');
  };

  const handleSaveEdit = async () => {
    try {
      await updateBudget(budget.id, { 
        proposalId: editedProposalId,
        paymentTerms: editedPaymentTerms,
        location: editedLocation,
        projectName: editedProjectName,
        projectDescription: editedProjectDescription,
        includesTax: editedIncludesTax,
        includesLogistics: editedIncludesLogistics,
        includesAccommodation: editedIncludesAccommodation,
        includesMeals: editedIncludesMeals,
        includesRawMaterial: editedIncludesRawMaterial,
        includesTechnicalVisit: editedIncludesTechnicalVisit,
        hasExecutionDate: editedHasExecutionDate,
        executionStartDate: editedHasExecutionDate ? editedExecutionStartDate : null,
        executionEndDate: editedHasExecutionDate ? editedExecutionEndDate : null,
        executionMonth: editedHasExecutionDate && editedExecutionStartDate ? format(new Date(editedExecutionStartDate), 'yyyy-MM') : (budget.executionMonth || null),
      });
      setIsEditing(false);
      toast.success('Informações atualizadas!');
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      toast.error('Erro ao salvar alterações. Tente novamente.');
    }
  };

  // Normalize legacy costs missing quantity/unitValue so Qtd column renders correctly
  const normalizeCost = (c: any) => {
    const quantity = c.quantity && c.quantity > 0 ? c.quantity : 1;
    const unitValue = c.unitValue && c.unitValue > 0
      ? c.unitValue
      : (quantity > 0 ? (c.value || 0) / quantity : (c.value || 0));
    return { ...c, quantity, unitValue, value: quantity * unitValue };
  };

  // Initialize new version services from current version
  const initNewVersionServices = () => {
    if (currentVersionData?.services) {
      setNewVersionServices(
        currentVersionData.services.map((s) => ({
          ...s,
          id: uuidv4(),
          costs: s.costs.map((c) => ({ ...normalizeCost(c), id: uuidv4() })),
        }))
      );
    } else {
      setNewVersionServices([]);
    }
    setNewVersionOperationalCosts(
      (currentVersionData?.operationalCosts || []).map(c => ({ ...normalizeCost(c), id: uuidv4() }))
    );

    setNewVersionFixedCostPct(0); // deprecated
    setNewVersionNfPct(currentVersionData?.nfCostPercentage ?? 13);
    setNewVersionTargetMargin(currentVersionData?.margin ?? 0);
  };

  // Update service in new version
  const updateNewVersionService = (serviceId: string, updates: Partial<ServiceItem>) => {
    setNewVersionServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, ...updates } : s))
    );
  };

  // Add cost to service in new version
  const addCostToNewVersionService = (serviceId: string) => {
    setNewVersionServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              costs: [
                ...s.costs,
                {
                  id: uuidv4(),
                  description: '',
                  quantity: 1,
                  unitValue: 0,
                  value: 0,
                  paymentStatus: 'pendente' as PaymentStatus,
                  paymentDate: null,
                },
              ],
            }
          : s
      )
    );
  };

  // Update cost in new version service
  const updateNewVersionCost = (serviceId: string, costId: string, updates: Partial<CostItem>) => {
    setNewVersionServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              costs: s.costs.map((c) => (c.id === costId ? { ...c, ...updates } : c)),
            }
          : s
      )
    );
  };

  // Remove cost from new version service
  const removeNewVersionCost = (serviceId: string, costId: string) => {
    setNewVersionServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? { ...s, costs: s.costs.filter((c) => c.id !== costId) }
          : s
      )
    );
  };

  // Add new service to new version
  const addServiceToNewVersion = (serviceType: ServiceType) => {
    setNewVersionServices((prev) => [
      ...prev,
      {
        id: uuidv4(),
        serviceType,
        objective: '',
        description: '',
        costs: [],
        fixedCostPercentage: 0,
        nfCostPercentage: 0,
        targetMargin: 0,
      },
    ]);
  };

  // Remove service from new version
  const removeServiceFromNewVersion = (serviceId: string) => {
    setNewVersionServices((prev) => prev.filter((s) => s.id !== serviceId));
  };

  // Reorder service in new version
  const moveNewVersionService = (serviceId: string, direction: 'up' | 'down') => {
    setNewVersionServices((prev) => {
      const idx = prev.findIndex((s) => s.id === serviceId);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleCreateNewVersion = async () => {
    if (!newVersionReason.trim()) {
      toast.error('Informe o motivo da nova versão');
      return;
    }

    if (newVersionServices.length === 0) {
      toast.error('Adicione pelo menos um serviço');
      return;
    }

    await addBudgetVersion(budget.id, {
      services: newVersionServices,
      operationalCosts: newVersionOperationalCosts,
      costs: [],
      productionCost: newVersionTotals.productionCost,
      fixedCostPercentage: newVersionFixedCostPct,
      nfCostPercentage: newVersionNfPct,
      totalCost: newVersionTotals.totalCosts,
      fullPrice: newVersionTotals.totalProjectValue,
      discount4Price: newVersionTotals.totalProjectValue * 0.96,
      discount5Price: newVersionTotals.totalProjectValue * 0.95,
      margin: newVersionTargetMargin,
      reason: newVersionReason,
    });
    setNewVersionReason('');
    setNewVersionServices([]);
    setNewVersionOpen(false);
    toast.success(`Nova versão V${budget.currentVersion + 1} criada com sucesso!`);
  };

  const handleApprove = async () => {
    if (budget.currentVersion > 0) {
      await approveBudget(budget.id, budget.currentVersion, approveExecutionMonth || undefined);
      setApproveOpen(false);
      setApproveExecutionMonth('');
      toast.success('Orçamento aprovado! Planilha de execução criada.');
    }
  };

  const handleUpdateExecutionSupplier = (serviceId: string, costId: string, supplier: string) => {
    updateExecutionCost(budget.id, serviceId, costId, { supplier });
  };

  const handleSaveNfValue = () => {
    if (budget.execution) {
      updateExecution(budget.id, { nfTaxValue: executionNfValue });
      setIsEditingNf(false);
      toast.success('Valor do imposto NF atualizado!');
    }
  };

  const handleUpdateExecutionCost = (serviceId: string, costId: string, realValue: number, isExtraCost = false) => {
    updateExecutionCost(budget.id, serviceId, costId, { realValue }, isExtraCost);
  };

  const handleUpdateExecutionPayment = (serviceId: string, costId: string, status: PaymentStatusType, date: Date | null, isExtraCost = false) => {
    updateExecutionCost(budget.id, serviceId, costId, { paymentStatus: status, paymentDate: date }, isExtraCost);
  };

  const handleUpdateExtraCostSupplier = (serviceId: string, costId: string, supplier: string) => {
    updateExecutionCost(budget.id, serviceId, costId, { supplier }, true);
  };

  const handleAddExtraCost = () => {
    if (!selectedServiceForExtraCost || !newExtraCostDescription.trim()) {
      toast.error('Preencha a descrição do gasto');
      return;
    }
    
    addExtraCost(budget.id, selectedServiceForExtraCost, {
      description: newExtraCostDescription,
      quantity: 1,
      unitValue: newExtraCostValue,
      value: newExtraCostValue,
      realValue: newExtraCostValue,
      paymentStatus: 'pendente',
      paymentDate: null,
      supplier: newExtraCostSupplier,
    });
    
    // Reset form
    setNewExtraCostDescription('');
    setNewExtraCostValue(0);
    setNewExtraCostSupplier('');
    setExtraCostDialogOpen(false);
    setSelectedServiceForExtraCost(null);
    toast.success('Gasto extra adicionado!');
  };

  const handleRemoveExtraCost = (serviceId: string, costId: string) => {
    removeExtraCost(budget.id, serviceId, costId);
    toast.success('Gasto extra removido!');
  };

  const handleRejectVersion = () => {
    if (!rejectingVersionId) return;
    
    if (!rejectionReason.trim()) {
      toast.error('Informe o motivo da recusa');
      return;
    }
    
    updateBudgetVersion(budget.id, rejectingVersionId, { 
      isRejected: true, 
      rejectionReason: rejectionReason 
    });
    
    setRejectDialogOpen(false);
    setRejectingVersionId(null);
    setRejectionReason('');
    toast.success('Versão marcada como recusada');
  };

  // ===== Inline version editing handlers =====
  const startEditingVersion = () => {
    const fallbackMargin = defaultTargetMargin || 20;
    if (currentVersionData) {
      setEditVersionServices(currentVersionData.services.map(s => ({
        ...s,
        targetMargin: s.targetMargin && s.targetMargin > 0 ? s.targetMargin : fallbackMargin,
        costs: s.costs.map(c => normalizeCost(c)),
      })));
      setEditVersionOperationalCosts((currentVersionData.operationalCosts || []).map(c => normalizeCost(c)));

      setEditVersionNfPct(currentVersionData.nfCostPercentage ?? 13);
      setEditVersionTargetMargin(
        currentVersionData.margin && currentVersionData.margin > 0
          ? currentVersionData.margin
          : fallbackMargin
      );
    } else {
      setEditVersionServices([]);
      setEditVersionOperationalCosts([]);
      setEditVersionNfPct(13);
      setEditVersionTargetMargin(fallbackMargin);
    }
    setIsEditingVersion(true);
  };

  const updateEditService = (serviceId: string, updates: Partial<ServiceItem>) => {
    setEditVersionServices(prev => prev.map(s => s.id === serviceId ? { ...s, ...updates } : s));
  };

  // Edit delivery info on approved/current version without entering full edit mode
  const updateApprovedServiceDelivery = async (serviceId: string, updates: Partial<ServiceItem>) => {
    if (!budget || !currentVersionData) return;
    const newServices = currentVersionData.services.map(s =>
      s.id === serviceId ? { ...s, ...updates } : s
    );
    try {
      await updateBudgetVersion(budget.id, currentVersionData.id, { services: newServices });
    } catch (e) {
      toast.error('Erro ao atualizar prazo de entrega');
    }
  };

  const updateEditCost = (serviceId: string, costId: string, updates: Partial<CostItem>) => {
    setEditVersionServices(prev => prev.map(s =>
      s.id === serviceId ? { ...s, costs: s.costs.map(c => c.id === costId ? { ...c, ...updates } : c) } : s
    ));
  };

  const addEditCost = (serviceId: string) => {
    setEditVersionServices(prev => prev.map(s =>
      s.id === serviceId ? { ...s, costs: [...s.costs, { id: uuidv4(), description: '', quantity: 1, unitValue: 0, value: 0, paymentStatus: 'pendente' as PaymentStatus, paymentDate: null }] } : s
    ));
  };

  const addEditService = (serviceType: ServiceType) => {
    setEditVersionServices(prev => [
      ...prev,
      {
        id: uuidv4(),
        serviceType,
        objective: '',
        description: '',
        costs: [],
        fixedCostPercentage: 0,
        nfCostPercentage: 0,
        targetMargin: defaultTargetMargin || 20,
      },
    ]);
  };

  const removeEditService = (serviceId: string) => {
    setEditVersionServices(prev => prev.filter(s => s.id !== serviceId));
  };

  const moveEditService = (serviceId: string, direction: 'up' | 'down') => {
    setEditVersionServices(prev => {
      const idx = prev.findIndex(s => s.id === serviceId);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const removeEditCost = (serviceId: string, costId: string) => {
    setEditVersionServices(prev => prev.map(s =>
      s.id === serviceId ? { ...s, costs: s.costs.filter(c => c.id !== costId) } : s
    ));
  };

  const addEditOperationalCost = () => {
    setEditVersionOperationalCosts(prev => [...prev, { id: uuidv4(), description: '', quantity: 1, unitValue: 0, value: 0, paymentStatus: 'pendente' as PaymentStatus, paymentDate: null }]);
  };

  const updateEditOperationalCost = (costId: string, updates: Partial<CostItem>) => {
    setEditVersionOperationalCosts(prev => prev.map(c => c.id === costId ? { ...c, ...updates } : c));
  };

  const removeEditOperationalCost = (costId: string) => {
    setEditVersionOperationalCosts(prev => prev.filter(c => c.id !== costId));
  };

  const handleSaveVersionEdit = async () => {
    const { productionCost, totalCosts, totalProjectValue } = editVersionTotals;
    if (!currentVersionData) {
      if (editVersionServices.length === 0) {
        toast.error('Adicione ao menos um serviço antes de salvar.');
        return;
      }
      await addBudgetVersion(budget.id, {
        services: editVersionServices,
        operationalCosts: editVersionOperationalCosts,
        costs: [],
        productionCost,
        fixedCostPercentage: 0,
        nfCostPercentage: editVersionNfPct,
        totalCost: totalCosts,
        fullPrice: totalProjectValue,
        discount4Price: totalProjectValue * 0.96,
        discount5Price: totalProjectValue * 0.95,
        margin: editVersionTargetMargin,
        reason: 'Versão inicial',
      });
      setIsEditingVersion(false);
      toast.success('Versão criada com sucesso!');
      return;
    }
    await updateBudgetVersion(budget.id, currentVersionData.id, {
      services: editVersionServices,
      operationalCosts: editVersionOperationalCosts,
      productionCost,
      nfCostPercentage: editVersionNfPct,
      totalCost: totalCosts,
      fullPrice: totalProjectValue,
      discount4Price: totalProjectValue * 0.96,
      discount5Price: totalProjectValue * 0.95,
      margin: editVersionTargetMargin,
    });
    setIsEditingVersion(false);
    toast.success('Versão atualizada com sucesso!');
  };

  const handleFinalizeExecution = () => {
    finalizeExecution(budget.id, finalReport);
    setFinalizeDialogOpen(false);
    setFinalReport('');
    toast.success('Execução finalizada com sucesso!');
  };

  const handleAddDeliveryLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) {
      toast.error('Preencha título e URL');
      return;
    }
    addDeliveryLink(budget.id, { title: newLinkTitle, url: newLinkUrl });
    setNewLinkTitle('');
    setNewLinkUrl('');
    setShowAddLink(false);
    toast.success('Link de entrega adicionado!');
  };

  const handleRemoveDeliveryLink = (linkId: string) => {
    removeDeliveryLink(budget.id, linkId);
    toast.success('Link removido!');
  };

  const fetchLayoutSettings = async (): Promise<PDFLayoutSettings | null> => {
    if (!workspace) return null;
    try {
      const { data } = await supabase
        .from('workspace_layout')
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        return {
          logoUrl: d.logo_url || '',
          companyName: d.company_name || '',
          website: d.website || '',
          email: d.email || '',
          pdfTitle: d.pdf_title || undefined,
          sectionClientTitle: d.section_client_title || undefined,
          sectionBriefingTitle: d.section_briefing_title || undefined,
          sectionInclusionsTitle: d.section_inclusions_title || undefined,
          sectionServicesTitle: d.section_services_title || undefined,
          sectionOperationalTitle: d.section_operational_title || undefined,
          sectionInvestmentTitle: d.section_investment_title || undefined,
          sectionTotalTitle: d.section_total_title || undefined,
          sectionTermsTitle: d.section_terms_title || undefined,
          termsCompanyLabel: d.terms_company_label || undefined,
          termsCompanyItems: d.terms_company_items || undefined,
          termsClientLabel: d.terms_client_label || undefined,
          termsClientItems: d.terms_client_items || undefined,
          termsGeneralLabel: d.terms_general_label || undefined,
          termsGeneralItems: d.terms_general_items || undefined,
          termsApprovalText: d.terms_approval_text || undefined,
          validityText: d.validity_text || undefined,
        };
      }
    } catch (err) {
      console.warn('Could not load layout settings:', err);
    }
    return null;
  };

  const isVendedor = role === 'vendedor';
  const isAdminOrOwner = role === 'owner' || role === 'admin';
  const canDownloadPDF = !isVendedor || budget?.pdfReleased;

  const generatePDFForVersion = async (version: BudgetVersion) => {
    if (!canDownloadPDF) {
      toast.error('O PDF ainda não foi liberado pelo administrador');
      return;
    }
    if (!version.services || version.services.length === 0) {
      toast.error('Versão não possui serviços');
      return;
    }

    try {
      const layoutSettings = await fetchLayoutSettings();
      await generateProposalPDF({
        budget,
        version,
        client,
        responsibleUser: profile ? { id: profile.id, name: profile.name, photo: profile.photo_url || '' } : null,
        layoutSettings,
        categoryLabels: serviceCategories.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {} as Record<string, string>),
        objectiveLabels: (() => { const map: Record<string, Record<string, string>> = {}; const objectives = getObjectivesForCategory ? serviceCategories.flatMap(c => (getObjectivesForCategory(c.key) || []).map(o => ({ ...o, categoryKey: c.key }))) : []; objectives.forEach(o => { if (!map[o.categoryKey]) map[o.categoryKey] = {}; map[o.categoryKey][o.value] = o.label; }); return map; })(),
      });
      toast.success(`PDF V${version.version} gerado com sucesso!`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const previewPDFForVersion = async (version: BudgetVersion) => {
    if (!canDownloadPDF) {
      toast.error('O PDF ainda não foi liberado pelo administrador');
      return;
    }
    if (!version.services || version.services.length === 0) {
      toast.error('Versão não possui serviços');
      return;
    }
    setPdfPreviewLoading(true);
    try {
      const layoutSettings = await fetchLayoutSettings();
      const doc = await generateProposalPDF({
        budget,
        version,
        client,
        responsibleUser: profile ? { id: profile.id, name: profile.name, photo: profile.photo_url || '' } : null,
        layoutSettings,
        categoryLabels: serviceCategories.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {} as Record<string, string>),
        objectiveLabels: (() => { const map: Record<string, Record<string, string>> = {}; const objectives = getObjectivesForCategory ? serviceCategories.flatMap(c => (getObjectivesForCategory(c.key) || []).map(o => ({ ...o, categoryKey: c.key }))) : []; objectives.forEach(o => { if (!map[o.categoryKey]) map[o.categoryKey] = {}; map[o.categoryKey][o.value] = o.label; }); return map; })(),
        skipSave: true,
      });
      const url = URL.createObjectURL(doc.output('blob'));
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPdfPreviewVersion(version);
      setPdfPreviewOpen(true);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      toast.error('Erro ao gerar pré-visualização');
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  const closePdfPreview = () => {
    setPdfPreviewOpen(false);
    setPdfPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPdfPreviewVersion(null);
  };

  const generatePDF = () => {
    if (!currentVersionData) {
      toast.error('Nenhuma versão encontrada');
      return;
    }
    generatePDFForVersion(currentVersionData);
  };


  const generateContract = async () => {
    if (!canDownloadPDF) {
      toast.error('O PDF ainda não foi liberado pelo administrador');
      return;
    }
    if (!currentVersionData || !client || !budget) {
      toast.error('Dados insuficientes para gerar minuta');
      return;
    }
    // Representante legal é opcional — a minuta pode ser gerada só com os dados da empresa.
    try {
      const { data: templateData } = await supabase
        .from('workspace_contract_template')
        .select('content')
        .eq('workspace_id', workspace?.id || '')
        .maybeSingle();

      if (!templateData?.content) {
        toast.error('Nenhum template de contrato configurado. Acesse Configurações > Minuta de Contrato.');
        return;
      }

      const layoutSettings = await fetchLayoutSettings();

      await generateContractPDF({
        template: templateData.content,
        budget,
        version: currentVersionData,
        client,
        layoutSettings,
        responsibleUser: profile ? { id: profile.id, name: profile.name, photo: profile.photo_url || '' } : null,
      });
      toast.success('Minuta gerada com sucesso!');
    } catch (err) {
      console.error('Error generating contract:', err);
      toast.error('Erro ao gerar minuta');
    }
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 40) return 'text-success';
    if (margin >= 25) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        title={`${budget.proposalId} - ${budget.projectName}`}
        subtitle="Detalhes do projeto"
      />

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(backTo)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant={budget.isRecurring ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const next = !budget.isRecurring;
                updateBudget(budget.id, { isRecurring: next });
                toast.success(next ? 'Marcado como recorrente' : 'Tag de recorrente removida');
              }}
              title={budget.isRecurring ? 'Remover tag de recorrente' : 'Marcar como recorrente'}
            >
              <Repeat className="w-4 h-4 mr-2" />
              {budget.isRecurring ? 'Recorrente' : 'Marcar recorrente'}
            </Button>
            {budget.status === 'aprovada' && (
              <Button
                size="sm"
                onClick={() => navigate(`/gestao-projetos?budget=${budget.id}`)}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Ir para Execução
              </Button>
            )}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Excluir Proposta</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja excluir a proposta "{budget.projectName}"? Esta ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      deleteBudget(budget.id);
                      toast.success('Proposta excluída com sucesso!');
                      navigate('/crm');
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Select value={budget.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...kanbanColumns].sort((a, b) => a.order - b.order).map((col) => (
                  <SelectItem key={col.key} value={col.key}>
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs for Budget vs Execution */}
        {budget.status === 'aprovada' && budget.execution && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="budget" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Orçamento
              </TabsTrigger>
              <TabsTrigger value="execution" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Execução
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {budget.status === 'nao_aprovada' && (budget.rejectionReason || budget.rejectionObservation) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base text-destructive">
                      Proposta reprovada
                    </CardTitle>
                    {budget.rejectionReason && (
                      <CardDescription className="text-destructive/80 font-medium mt-1">
                        {budget.rejectionReason}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              {budget.rejectionObservation && (
                <CardContent className="pt-0">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {budget.rejectionObservation}
                  </p>
                </CardContent>
              )}
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-foreground/5">
                        <FileText className="w-6 h-6 text-foreground" />
                      </div>
                      <div className="flex-1">
                        {isEditing ? (
                          <Input
                            value={editedProjectName}
                            onChange={(e) => setEditedProjectName(e.target.value)}
                            className="font-bold text-lg"
                            placeholder="Nome do projeto"
                          />
                        ) : (
                          <CardTitle>{budget.projectName}</CardTitle>
                        )}
                        <CardDescription>
                          {budget.proposalId} • Versão V{budget.currentVersion || 0}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={budget.status} />
                      {isEditingExecutionMonth ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="month"
                            value={editedExecutionMonth}
                            onChange={(e) => setEditedExecutionMonth(e.target.value)}
                            className="h-7 w-40 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={async () => {
                              await updateBudget(budget.id, { executionMonth: editedExecutionMonth || null });
                              setIsEditingExecutionMonth(false);
                              toast.success('Mês de execução atualizado!');
                            }}
                          >
                            <Save className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => {
                            setEditedExecutionMonth(budget.executionMonth || '');
                            setIsEditingExecutionMonth(true);
                          }}
                        >
                          {budget.executionMonth
                            ? `Execução: ${formatExecutionMonth(budget.executionMonth)}`
                            : '+ Mês de execução'}
                        </Badge>
                      )}
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditedPaymentTerms(budget.paymentTerms);
                            setEditedLocation(budget.location || '');
                            setEditedProjectName(budget.projectName);
                            setEditedProjectDescription(budget.projectDescription || '');
                            setEditedProposalId(budget.proposalId);
                            setEditedIncludesTax(budget.includesTax);
                            setEditedIncludesLogistics(budget.includesLogistics);
                            setEditedIncludesAccommodation(budget.includesAccommodation);
                            setEditedIncludesMeals(budget.includesMeals);
                            setEditedIncludesRawMaterial(budget.includesRawMaterial);
                            setEditedIncludesTechnicalVisit(budget.includesTechnicalVisit);
                            setEditedHasExecutionDate(budget.hasExecutionDate);
                            setEditedExecutionStartDate(budget.executionStartDate);
                            setEditedExecutionEndDate(budget.executionEndDate);
                            setIsEditing(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Identificador da Proposta + Google Drive */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Identificador da Proposta</p>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <Input
                            value={editedProposalId}
                            onChange={(e) => setEditedProposalId(e.target.value)}
                            placeholder="Ex: 850"
                            className="flex-1"
                          />
                        ) : (
                          <p className="font-medium">{budget.proposalId}</p>
                        )}
                        {/* Google Drive link */}
                        {budget.driveUrl ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => window.open(budget.driveUrl, '_blank')}
                            >
                              <HardDrive className="w-3 h-3" />
                              Drive Comercial
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                const newUrl = prompt('Editar link do Google Drive:', budget.driveUrl);
                                if (newUrl !== null) {
                                  updateBudget(budget.id, { driveUrl: newUrl });
                                  toast.success('Link do Drive atualizado!');
                                }
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={() => {
                              const url = prompt('Cole o link do Google Drive:');
                              if (url) {
                                updateBudget(budget.id, { driveUrl: url });
                                toast.success('Link do Drive adicionado!');
                              }
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            <HardDrive className="w-3 h-3" />
                            Drive Comercial
                          </Button>
                        )}
                        {/* Gerar Minuta button - only for approved */}
                        {budget.status === 'aprovada' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={generateContract}
                          >
                            <FileText className="w-3 h-3" />
                            Gerar Minuta
                          </Button>
                        )}
                        {/* Liberar PDF button - only for admin/owner */}
                        {isAdminOrOwner && budget.currentVersion > 0 && (
                          <Button
                            variant={budget.pdfReleased ? "outline" : "default"}
                            size="sm"
                            className={`h-7 gap-1 text-xs ${budget.pdfReleased ? 'border-success text-success' : ''}`}
                            onClick={async () => {
                              const newValue = !budget.pdfReleased;
                              await updateBudget(budget.id, { pdfReleased: newValue });
                              toast.success(newValue ? 'PDF liberado para download' : 'Liberação do PDF revogada');
                            }}
                          >
                            {budget.pdfReleased ? (
                              <><CheckCircle className="w-3 h-3" /> PDF Liberado</>
                            ) : (
                              <><LockKeyhole className="w-3 h-3" /> Liberar PDF</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Descrição Geral do Projeto */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Briefing do Projeto</p>
                      {isEditing ? (
                        <Textarea
                          value={editedProjectDescription}
                          onChange={(e) => setEditedProjectDescription(e.target.value)}
                          placeholder="Descrição geral do projeto..."
                          rows={3}
                        />
                      ) : (
                        <p className="font-medium whitespace-pre-wrap">{budget.projectDescription || 'Não definido'}</p>
                      )}
                    </div>
                    
                    {/* Condição de Pagamento */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Condição de Pagamento</p>
                      {isEditing ? (
                        availablePaymentTerms.length > 0 ? (
                          <Select
                            value={editedPaymentTerms}
                            onValueChange={(value) => setEditedPaymentTerms(value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma condição" />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePaymentTerms.map((term) => (
                                <SelectItem key={term.id} value={term.name}>
                                  {term.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={editedPaymentTerms}
                            onChange={(e) => setEditedPaymentTerms(e.target.value)}
                            placeholder="Ex: 50% entrada + 50% na entrega"
                          />
                        )
                      ) : (
                        <p className="font-medium">{budget.paymentTerms || 'Não definido'}</p>
                      )}
                    </div>

                    {/* Local */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Local</p>
                      {isEditing ? (
                        <Input
                          value={editedLocation}
                          onChange={(e) => setEditedLocation(e.target.value)}
                          placeholder="Ex: São Paulo - SP"
                        />
                      ) : (
                        <p className="font-medium">{budget.location || 'Não definido'}</p>
                      )}
                    </div>



                    {/* Data para Execução - always visible */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Data para Execução</p>
                      {(isEditing || isEditingExecDate) ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="editHasExecutionDate"
                                checked={editedHasExecutionDate}
                                onCheckedChange={(checked) => {
                                  setEditedHasExecutionDate(checked === true);
                                  if (!checked) {
                                    setEditedExecutionStartDate(null);
                                    setEditedExecutionEndDate(null);
                                  }
                                }}
                              />
                              <Label htmlFor="editHasExecutionDate" className="text-sm font-normal cursor-pointer">
                                Data definida
                              </Label>
                            </div>
                            <span className="text-xs text-muted-foreground">A definir</span>
                          </div>
                          {editedHasExecutionDate && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-xs h-8">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {editedExecutionStartDate
                                      ? format(new Date(editedExecutionStartDate), 'dd/MM/yyyy')
                                      : 'Início'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
                                    mode="single"
                                    selected={editedExecutionStartDate ? new Date(editedExecutionStartDate) : undefined}
                                    onSelect={(date) => {
                                      setEditedExecutionStartDate(date || null);
                                      if (date) setEditedExecutionMonth(format(date, 'yyyy-MM'));
                                    }}
                                    locale={ptBR}
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                              <span className="text-xs text-muted-foreground">até</span>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="text-xs h-8">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {editedExecutionEndDate
                                      ? format(new Date(editedExecutionEndDate), 'dd/MM/yyyy')
                                      : 'Fim (opcional)'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <CalendarComponent
                                    mode="single"
                                    selected={editedExecutionEndDate ? new Date(editedExecutionEndDate) : undefined}
                                    onSelect={(date) => setEditedExecutionEndDate(date || null)}
                                    locale={ptBR}
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                          {isEditingExecDate && !isEditing && (
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={async () => {
                                  await updateBudget(budget.id, {
                                    hasExecutionDate: editedHasExecutionDate,
                                    executionStartDate: editedHasExecutionDate ? editedExecutionStartDate : null,
                                    executionEndDate: editedHasExecutionDate ? editedExecutionEndDate : null,
                                    executionMonth: editedHasExecutionDate && editedExecutionStartDate ? format(new Date(editedExecutionStartDate), 'yyyy-MM') : (budget.executionMonth || null),
                                  });
                                  setIsEditingExecDate(false);
                                  toast.success('Datas de execução atualizadas!');
                                }}
                              >
                                <Check className="w-3 h-3 mr-1" /> Salvar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setIsEditingExecDate(false)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {budget.hasExecutionDate && budget.executionStartDate
                              ? `${format(new Date(budget.executionStartDate), 'dd/MM/yyyy')}${budget.executionEndDate ? ` — ${format(new Date(budget.executionEndDate), 'dd/MM/yyyy')}` : ''}`
                              : 'A definir'}
                          </p>
                          {budget.status === 'aprovada' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditedHasExecutionDate(budget.hasExecutionDate);
                                setEditedExecutionStartDate(budget.executionStartDate);
                                setEditedExecutionEndDate(budget.executionEndDate);
                                setIsEditingExecDate(true);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Material Bruto */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Material Bruto na Entrega</p>
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="editIncludesRawMaterial"
                            checked={editedIncludesRawMaterial}
                            onCheckedChange={(checked) => setEditedIncludesRawMaterial(checked === true)}
                          />
                          <Label htmlFor="editIncludesRawMaterial" className="text-sm font-normal cursor-pointer">
                            Material bruto incluso
                          </Label>
                        </div>
                      ) : (
                        <p className="font-medium">{budget.includesRawMaterial ? 'Incluso' : 'Não incluso'}</p>
                      )}
                    </div>

                    {/* Inclusões na proposta */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">O que está incluso na proposta</p>
                      {isEditing ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="editIncludesTax" checked={editedIncludesTax} onCheckedChange={(c) => setEditedIncludesTax(c === true)} />
                            <Label htmlFor="editIncludesTax" className="text-sm font-normal cursor-pointer">Imposto incluso</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="editIncludesLogistics" checked={editedIncludesLogistics} onCheckedChange={(c) => setEditedIncludesLogistics(c === true)} />
                            <Label htmlFor="editIncludesLogistics" className="text-sm font-normal cursor-pointer">Logística inclusa</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="editIncludesAccommodation" checked={editedIncludesAccommodation} onCheckedChange={(c) => setEditedIncludesAccommodation(c === true)} />
                            <Label htmlFor="editIncludesAccommodation" className="text-sm font-normal cursor-pointer">Hospedagem inclusa</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="editIncludesMeals" checked={editedIncludesMeals} onCheckedChange={(c) => setEditedIncludesMeals(c === true)} />
                            <Label htmlFor="editIncludesMeals" className="text-sm font-normal cursor-pointer">Alimentação da equipe inclusa</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="editIncludesTechnicalVisit" checked={editedIncludesTechnicalVisit} onCheckedChange={(c) => setEditedIncludesTechnicalVisit(c === true)} />
                            <Label htmlFor="editIncludesTechnicalVisit" className="text-sm font-normal cursor-pointer">Visita técnica inclusa</Label>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {budget.includesTax && <Badge variant="secondary" className="text-xs">Imposto</Badge>}
                          {budget.includesLogistics && <Badge variant="secondary" className="text-xs">Logística</Badge>}
                          {budget.includesAccommodation && <Badge variant="secondary" className="text-xs">Hospedagem</Badge>}
                          {budget.includesMeals && <Badge variant="secondary" className="text-xs">Alimentação</Badge>}
                          {budget.includesTechnicalVisit && <Badge variant="secondary" className="text-xs">Visita técnica</Badge>}
                          {!budget.includesTax && !budget.includesLogistics && !budget.includesAccommodation && !budget.includesMeals && !budget.includesTechnicalVisit && (
                            <span className="text-sm text-muted-foreground">Nenhuma inclusão</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {isEditing && (
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Save className="w-4 h-4 mr-2" />
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Budget View */}
            {activeTab === 'budget' && (
              <>
                {/* Edit Version Button */}
                {!isEditingVersion && (
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={startEditingVersion}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      {currentVersionData ? (budget.status === 'aprovada' ? 'Ajustar valores' : 'Editar versão atual') : 'Adicionar serviços'}
                    </Button>
                  </div>
                )}
                {isEditingVersion && (
                  <div className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <p className="text-sm font-medium text-warning">{currentVersionData ? `Editando V${currentVersionData.version} — alterações serão salvas na versão atual` : 'Criando primeira versão do orçamento'}</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveVersionEdit}>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingVersion(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                {/* Add Service Buttons (edit mode) */}
                {isEditingVersion && (
                  <Card className="card-elevated">
                    <CardContent className="pt-6 space-y-2">
                      <Label>Adicionar Serviço</Label>
                      <div className="flex gap-2 flex-wrap">
                        {[...serviceCategories].sort((a, b) => a.order - b.order).map((category) => {
                          const Icon = SERVICE_ICONS[category.key] || Film;
                          return (
                            <Button
                              key={category.key}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addEditService(category.key)}
                            >
                              <Icon className="w-4 h-4 mr-1" />
                              {category.label}
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {/* Services by Type */}
                {((isEditingVersion && editVersionServices.length > 0) || (currentVersionData && currentVersionData.services && currentVersionData.services.length > 0)) && (() => {
                  const displayServices = isEditingVersion ? editVersionServices : (currentVersionData?.services || []);
                  const opTotal = (isEditingVersion ? editVersionOperationalCosts : (currentVersionData?.operationalCosts || [])).reduce((sum, c) => sum + c.value, 0);
                  const totalProdCost = displayServices.reduce((sum, s) => sum + s.costs.reduce((s2, c) => s2 + c.value, 0), 0);
                  const displayNfPct = isEditingVersion ? editVersionNfPct : (currentVersionData?.nfCostPercentage ?? 13);
                  const displayMargin = isEditingVersion ? editVersionTargetMargin : (currentVersionData?.margin ?? 0);
                  const displayFullPrice = isEditingVersion ? editVersionTotals.totalProjectValue : (currentVersionData?.fullPrice ?? 0);
                  const projNfValue = displayFullPrice * (displayNfPct / 100);
                  const projMarginValue = displayFullPrice - totalProdCost - opTotal - projNfValue;

                  return (
                  <AnimatePresence mode="popLayout">
                    {displayServices.map((service, index) => {
                      const Icon = SERVICE_ICONS[service.serviceType] || Layers;
                      const objectives = getObjectivesForCategory(service.serviceType);
                      const objectiveLabel = objectives.find(o => o.value === service.objective)?.label || service.objective;
                      const calc = calculateServiceTotals(service);
                      const serviceWeight = totalProdCost > 0 ? calc.productionCost / totalProdCost : 0;
                      const serviceMarginValue = serviceWeight * projMarginValue;

                      return (
                        <motion.div
                          key={service.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * index }}
                        >
                          <Card className="card-elevated border-l-4 border-l-foreground">
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-3 rounded-xl bg-foreground text-background">
                                    <Icon className="w-6 h-6" />
                                  </div>
                                  <div className="flex-1">
                                    <CardTitle className="flex items-center gap-2">
                                      <span className="text-xs font-bold px-2 py-1 bg-foreground text-background rounded">
                                        {service.serviceType}
                                      </span>
                                      {isEditingVersion ? (
                                        <Select
                                          value={service.objective}
                                          onValueChange={(value) => updateEditService(service.id, { objective: value })}
                                        >
                                          <SelectTrigger className="h-8 w-48">
                                            <SelectValue placeholder="Objetivo..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {objectives.map((obj) => (
                                              <SelectItem key={obj.value} value={obj.value}>{obj.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        objectiveLabel
                                      )}
                                    </CardTitle>
                                    {!isEditingVersion && (
                                      <CardDescription className="whitespace-pre-wrap">
                                        {service.description || 'Sem descrição'}
                                      </CardDescription>
                                    )}
                                    {/* Prazo de Entrega */}
                                    {(() => {
                                      const editable = isEditingVersion || budget.status === 'aprovada';
                                      const onChange = (updates: Partial<ServiceItem>) => {
                                        if (isEditingVersion) updateEditService(service.id, updates);
                                        else updateApprovedServiceDelivery(service.id, updates);
                                      };
                                      if (editable) {
                                        return (
                                          <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <Select
                                              value={service.deliveryType || ''}
                                              onValueChange={(value) =>
                                                onChange({
                                                  deliveryType: value as DeliveryType,
                                                  deliveryDays: value === 'realtime' || value === 'data_especifica' ? undefined : (service.deliveryDays || 1),
                                                  deliveryDate: value === 'data_especifica' ? service.deliveryDate : undefined,
                                                })
                                              }
                                            >
                                              <SelectTrigger className="h-8 w-56">
                                                <SelectValue placeholder="Prazo de entrega..." />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {Object.entries(DELIVERY_TYPE_LABELS).map(([key, label]) => (
                                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                            {(service.deliveryType === 'dias_uteis' || service.deliveryType === 'dias_corridos') && (
                                              <Input
                                                type="number"
                                                min={1}
                                                className="h-8 w-20"
                                                value={service.deliveryDays || ''}
                                                onChange={(e) => onChange({ deliveryDays: parseInt(e.target.value) || 1 })}
                                                placeholder="Dias"
                                              />
                                            )}
                                            {service.deliveryType === 'data_especifica' && (
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button variant="outline" size="sm" className="h-8">
                                                    <Calendar className="w-3 h-3 mr-1" />
                                                    {service.deliveryDate
                                                      ? format(new Date(service.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy')
                                                      : 'Selecionar data'}
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                  <CalendarComponent
                                                    mode="single"
                                                    selected={service.deliveryDate ? new Date(service.deliveryDate + 'T12:00:00') : undefined}
                                                    onSelect={(d) => d && onChange({ deliveryDate: format(d, 'yyyy-MM-dd') })}
                                                    locale={ptBR}
                                                    initialFocus
                                                    className="p-3 pointer-events-auto"
                                                  />
                                                </PopoverContent>
                                              </Popover>
                                            )}
                                          </div>
                                        );
                                      }
                                      if (!service.deliveryType) return null;
                                      const label =
                                        service.deliveryType === 'realtime' ? 'Real time (mesmo dia)' :
                                        service.deliveryType === 'data_especifica'
                                          ? (service.deliveryDate ? format(new Date(service.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Data específica')
                                          : `${service.deliveryDays || ''} ${service.deliveryType === 'dias_uteis' ? 'dias úteis' : 'dias corridos'}`;
                                      return (
                                        <p className="text-xs text-muted-foreground mt-1">Prazo: {label}</p>
                                      );
                                    })()}
                                  </div>
                                </div>
                                {isEditingVersion && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveEditService(service.id, 'up')}
                                      disabled={index === 0}
                                      title="Mover para cima"
                                    >
                                      <ArrowUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => moveEditService(service.id, 'down')}
                                      disabled={index === displayServices.length - 1}
                                      title="Mover para baixo"
                                    >
                                      <ArrowDown className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeEditService(service.id)}
                                      title="Remover serviço"
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {isEditingVersion && (
                                <Textarea
                                  value={service.description}
                                  onChange={(e) => updateEditService(service.id, { description: e.target.value })}
                                  placeholder="Descrição do serviço..."
                                  rows={3}
                                  className="mt-3 w-full"
                                />
                              )}
                            </CardHeader>
                            <CardContent>
                              {/* Costs Table */}
                              <div className="rounded-lg border overflow-hidden mb-4">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/50">
                                      {isEditingVersion && <TableHead className="w-8"></TableHead>}
                                      <TableHead>Descrição</TableHead>
                                      <TableHead className="text-right w-[70px]">Qtd</TableHead>
                                      <TableHead className="text-right">V. Unit.</TableHead>
                                      <TableHead className="text-right">Total</TableHead>
                                      {isEditingVersion && <TableHead className="w-10"></TableHead>}
                                    </TableRow>
                                  </TableHeader>
                                  {isEditingVersion ? (
                                    <SortableTableBody
                                      items={service.costs}
                                      onReorder={(newCosts) => setEditVersionServices(prev => prev.map(s => s.id === service.id ? { ...s, costs: newCosts } : s))}
                                      renderRow={(cost, handle) => (
                                        <>
                                          <TableCell className="w-8">{handle}</TableCell>
                                          <TableCell>
                                            <Input
                                              value={cost.description}
                                              onChange={(e) => updateEditCost(service.id, cost.id, { description: e.target.value })}
                                              placeholder="Descrição do custo"
                                              className="h-8"
                                            />
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Input
                                              type="number"
                                              min={1}
                                              value={cost.quantity || 1}
                                              onChange={(e) => {
                                                const qty = parseInt(e.target.value) || 1;
                                                updateEditCost(service.id, cost.id, { quantity: qty, value: qty * (cost.unitValue || 0) });
                                              }}
                                              className="h-8 w-20 px-2 text-sm"
                                            />
                                          </TableCell>
                                          <TableCell className="text-right text-muted-foreground">
                                            <Input
                                              type="number"
                                              min={0}
                                              value={cost.unitValue || ''}
                                              onChange={(e) => {
                                                const uv = parseFloat(e.target.value) || 0;
                                                updateEditCost(service.id, cost.id, { unitValue: uv, value: (cost.quantity || 1) * uv });
                                              }}
                                              className="h-8 w-28"
                                            />
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            {formatCurrency(cost.value)}
                                          </TableCell>
                                          <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => removeEditCost(service.id, cost.id)}>
                                              <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                          </TableCell>
                                        </>
                                      )}
                                    />
                                  ) : (
                                    <TableBody>
                                      {service.costs.map((cost) => (
                                        <TableRow key={cost.id}>
                                          <TableCell>{cost.description}</TableCell>
                                          <TableCell className="text-right">{cost.quantity || 1}</TableCell>
                                          <TableCell className="text-right text-muted-foreground">
                                            {formatCurrency(cost.unitValue || cost.value)}
                                          </TableCell>
                                          <TableCell className="text-right font-medium">
                                            {formatCurrency(cost.value)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  )}
                                </Table>
                              </div>
                              {isEditingVersion && (
                                <div className="flex gap-2 mb-4">
                                  <Button variant="outline" size="sm" onClick={() => addEditCost(service.id)}>
                                    <Plus className="w-3 h-3 mr-1" />
                                    Adicionar item
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => openCatalogForEditService(service.id, service.serviceType)}>
                                    <Package className="w-3 h-3 mr-1" />
                                    Do catálogo
                                  </Button>
                                </div>
                              )}

                              {/* Service Calculations */}
                              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                                <div>
                                  <p className="text-xs text-muted-foreground">Custo de Produção</p>
                                  <p className="font-semibold text-orange-500">{formatCurrency(calc.productionCost)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Margem para este serviço</p>
                                  <p className={`font-semibold ${getMarginColor(calc.margin)}`}>{formatCurrency(serviceMarginValue)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Subtotal</p>
                                  <p className="font-bold text-lg text-blue-500">{formatCurrency(calc.productionCost + serviceMarginValue)}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  );
                })()}

                {/* Operational Costs in Budget View */}
                {(isEditingVersion || currentVersionData) && (() => {
                  const displayOpCosts = isEditingVersion ? editVersionOperationalCosts : (currentVersionData?.operationalCosts || []);
                  if (!isEditingVersion && displayOpCosts.length === 0) return null;
                  return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <Card className="card-elevated border-l-4 border-l-warning">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-warning/10">
                              <DollarSign className="w-6 h-6 text-warning" />
                            </div>
                            <div>
                              <CardTitle>Despesas Operacionais</CardTitle>
                              <CardDescription>Custos gerais do projeto</CardDescription>
                            </div>
                          </div>
                          {isEditingVersion && (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={addEditOperationalCost}>
                                <Plus className="w-3 h-3 mr-1" />
                                Adicionar
                              </Button>
                              <Button variant="outline" size="sm" onClick={openCatalogForEditOperational}>
                                <Package className="w-3 h-3 mr-1" />
                                Do catálogo
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-lg border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                {isEditingVersion && <TableHead className="w-8"></TableHead>}
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right w-[70px]">Qtd</TableHead>
                                <TableHead className="text-right">V. Unit.</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                {isEditingVersion && <TableHead className="w-10"></TableHead>}
                              </TableRow>
                            </TableHeader>
                            {isEditingVersion ? (
                              <SortableTableBody
                                items={displayOpCosts}
                                onReorder={(items) => setEditVersionOperationalCosts(items)}
                                renderRow={(cost, handle) => (
                                  <>
                                    <TableCell className="w-8">{handle}</TableCell>
                                    <TableCell>
                                      <Input
                                        value={cost.description}
                                        onChange={(e) => updateEditOperationalCost(cost.id, { description: e.target.value })}
                                        placeholder="Ex: Passagens, Hotel..."
                                        className="h-8"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        min={1}
                                        value={cost.quantity || 1}
                                        onChange={(e) => {
                                          const qty = parseInt(e.target.value) || 1;
                                          updateEditOperationalCost(cost.id, { quantity: qty, value: qty * (cost.unitValue || 0) });
                                        }}
                                        className="h-8 w-20 px-2 text-sm"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      <Input
                                        type="number"
                                        min={0}
                                        value={cost.unitValue || ''}
                                        onChange={(e) => {
                                          const uv = parseFloat(e.target.value) || 0;
                                          updateEditOperationalCost(cost.id, { unitValue: uv, value: (cost.quantity || 1) * uv });
                                        }}
                                        className="h-8 w-28"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatCurrency(cost.value)}
                                    </TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="sm" onClick={() => removeEditOperationalCost(cost.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </>
                                )}
                                footer={
                                  <TableRow className="bg-muted/30">
                                    <TableCell colSpan={5} className="font-semibold">
                                      Total Despesas Operacionais
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                      {formatCurrency(displayOpCosts.reduce((sum, c) => sum + c.value, 0))}
                                    </TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                }
                              />
                            ) : (
                              <TableBody>
                                {displayOpCosts.map((cost) => (
                                  <TableRow key={cost.id}>
                                    <TableCell>{cost.description}</TableCell>
                                    <TableCell className="text-right">{cost.quantity || 1}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      {formatCurrency(cost.unitValue || cost.value)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatCurrency(cost.value)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={3} className="font-semibold">
                                    Total Despesas Operacionais
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    {formatCurrency(displayOpCosts.reduce((sum, c) => sum + c.value, 0))}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            )}
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  );
                })()}

                {/* Composição do Investimento */}
                {currentVersionData && currentVersionData.services && currentVersionData.services.length > 0 && (() => {
                  const displayServices = isEditingVersion ? editVersionServices : currentVersionData.services;
                  const displayOpCosts = isEditingVersion ? editVersionOperationalCosts : (currentVersionData.operationalCosts || []);
                  const operationalTotal = displayOpCosts.reduce((sum, c) => sum + c.value, 0);
                  const totalProdCost = displayServices.reduce((sum, s) => sum + s.costs.reduce((s2, c) => s2 + c.value, 0), 0);
                  const displayNfPct = isEditingVersion ? editVersionNfPct : currentVersionData.nfCostPercentage;
                  const displayMarginPct = isEditingVersion ? editVersionTargetMargin : currentVersionData.margin;
                  const displayFullPrice = isEditingVersion ? editVersionTotals.totalProjectValue : currentVersionData.fullPrice;
                  const nfValue = displayFullPrice * (displayNfPct / 100);
                  const totalCosts = totalProdCost + operationalTotal;
                  const marginValue = displayFullPrice - totalCosts - nfValue;

                  const servicesSubtotals = displayServices.map(service => {
                    const prodCost = service.costs.reduce((sum, c) => sum + c.value, 0);
                    const weight = totalProdCost > 0 ? prodCost / totalProdCost : 0;
                    const svcMargin = weight * marginValue;
                    return { service, subtotal: prodCost + svcMargin };
                  });

                  const isApproved = budget.status === 'aprovada';
                  const bgClass = isApproved ? 'bg-success/10 border-success/30 dark:bg-success/10' : 'bg-warning/10 border-warning/30 dark:bg-warning/10';

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18 }}
                    >
                      <Card className={`card-elevated border ${bgClass}`}>
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-foreground/5">
                              <Calculator className="w-6 h-6 text-foreground" />
                            </div>
                            <div>
                              <CardTitle>Composição do Investimento</CardTitle>
                              <CardDescription>Resumo financeiro do projeto</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {servicesSubtotals.map((item, idx) => {
                              const objectives = getObjectivesForCategory(item.service.serviceType);
                              const objLabel = objectives.find(o => o.value === item.service.objective)?.label || item.service.objective;
                              return (
                                <div key={item.service.id} className="flex items-center justify-between">
                                  <span className="text-sm">
                                    {idx + 1}. <span className="font-medium">{item.service.serviceType}</span>
                                    {objLabel ? ` — ${objLabel}` : ''}
                                  </span>
                                  <span className="font-medium text-sm">{formatCurrency(item.subtotal)}</span>
                                </div>
                              );
                            })}

                            {operationalTotal > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm">Despesas Operacionais</span>
                                <span className="font-medium text-sm">{formatCurrency(operationalTotal)}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <span className="text-sm">
                                Nota Fiscal ({isEditingVersion ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editVersionNfPct}
                                    onChange={(e) => setEditVersionNfPct(parseFloat(e.target.value) || 0)}
                                    className="inline-block h-6 w-16 text-xs px-1"
                                  />
                                ) : displayNfPct}%)
                              </span>
                              <span className="font-medium text-sm">{formatCurrency(nfValue)}</span>
                            </div>

                            {isEditingVersion && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm">
                                  Margem alvo: <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editVersionTargetMargin}
                                    onChange={(e) => setEditVersionTargetMargin(parseFloat(e.target.value) || 0)}
                                    className="inline-block h-6 w-16 text-xs px-1"
                                  />%
                                </span>
                              </div>
                            )}

                            <div className="border-t pt-3 mt-3">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-base">INVESTIMENTO TOTAL</span>
                                <span className="font-bold text-lg">{formatCurrency(displayFullPrice)}</span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-sm text-muted-foreground">Margem total projetada</span>
                                <span className={`font-semibold text-sm ${getMarginColor(displayMarginPct)}`}>
                                  {formatCurrency(marginValue)} ({displayMarginPct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })()}

                {/* Save bar at bottom when editing version */}
                {isEditingVersion && (
                  <div className="flex items-center justify-end gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <Button size="sm" variant="outline" onClick={() => setIsEditingVersion(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSaveVersionEdit}>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar alterações
                    </Button>
                  </div>
                )}

                {/* Version History */}
                {budget.versions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Card className="card-elevated">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-muted">
                              <Calculator className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                              <CardTitle>Histórico de Versões</CardTitle>
                              <CardDescription>
                                {budget.versions.length} versão(ões)
                              </CardDescription>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {budget.status !== 'aprovada' && (
                              <>
                                <Dialog open={newVersionOpen} onOpenChange={(open) => {
                                  setNewVersionOpen(open);
                                  if (open) {
                                    initNewVersionServices();
                                  }
                                }}>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Copy className="w-4 h-4 mr-2" />
                                      Nova Versão
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Criar Nova Versão V{budget.currentVersion + 1}</DialogTitle>
                                      <DialogDescription>
                                        Edite os serviços, custos e margens antes de salvar a nova versão
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-6 py-4">
                                      {/* Reason */}
                                      <div className="space-y-2">
                                        <Label>Motivo da nova versão *</Label>
                                        <Textarea
                                          value={newVersionReason}
                                          onChange={(e) => setNewVersionReason(e.target.value)}
                                          placeholder="Ex: Cliente solicitou ajuste no escopo..."
                                        />
                                      </div>

                                      {/* Add Service Buttons */}
                                      <div className="space-y-2">
                                        <Label>Adicionar Serviço</Label>
                                        <div className="flex gap-2 flex-wrap">
                                          {[...serviceCategories].sort((a, b) => a.order - b.order).map((category) => {
                                            const Icon = SERVICE_ICONS[category.key] || Film;
                                            return (
                                              <Button
                                                key={category.key}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addServiceToNewVersion(category.key)}
                                              >
                                                <Icon className="w-4 h-4 mr-1" />
                                                {category.label}
                                              </Button>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      {/* Services */}
                                      {newVersionServices.map((service, serviceIndex) => {
                                        const Icon = SERVICE_ICONS[service.serviceType] || Layers;
                                        const objectives = getObjectivesForCategory(service.serviceType);
                                        const calc = calculateServiceTotals(service);

                                        return (
                                          <Card key={service.id} className="border-l-4 border-l-foreground">
                                            <CardHeader className="pb-3">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <Icon className="w-5 h-5" />
                                                  <span className="font-bold">{service.serviceType}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => moveNewVersionService(service.id, 'up')}
                                                    disabled={serviceIndex === 0}
                                                    title="Mover para cima"
                                                  >
                                                    <ArrowUp className="w-4 h-4" />
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => moveNewVersionService(service.id, 'down')}
                                                    disabled={serviceIndex === newVersionServices.length - 1}
                                                    title="Mover para baixo"
                                                  >
                                                    <ArrowDown className="w-4 h-4" />
                                                  </Button>
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeServiceFromNewVersion(service.id)}
                                                  >
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                  </Button>
                                                </div>
                                              </div>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                              {/* Objective, Description & Percentages */}
                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                  <Label>Objetivo</Label>
                                                  <Select
                                                    value={service.objective}
                                                    onValueChange={(value) =>
                                                      updateNewVersionService(service.id, { objective: value })
                                                    }
                                                  >
                                                    <SelectTrigger>
                                                      <SelectValue placeholder="Selecionar..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {objectives.map((obj) => (
                                                        <SelectItem key={obj.value} value={obj.value}>
                                                          {obj.label}
                                                        </SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                                <div className="space-y-2">
                                                  <Label>Descrição</Label>
                                                  <Textarea
                                                    value={service.description}
                                                    onChange={(e) =>
                                                      updateNewVersionService(service.id, { description: e.target.value })
                                                    }
                                                    placeholder="Descreva o serviço..."
                                                    rows={2}
                                                  />
                                                </div>
                                              </div>

                                              {/* Prazo de Entrega */}
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                  <Label>Prazo de Entrega</Label>
                                                  <Select
                                                    value={service.deliveryType || ''}
                                                    onValueChange={(value) =>
                                                      updateNewVersionService(service.id, { 
                                                        deliveryType: value as DeliveryType,
                                                        deliveryDays: value === 'realtime' || value === 'data_especifica' ? undefined : (service.deliveryDays || 1),
                                                        deliveryDate: value === 'data_especifica' ? service.deliveryDate : undefined,
                                                      })
                                                    }
                                                  >
                                                    <SelectTrigger>
                                                      <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {Object.entries(DELIVERY_TYPE_LABELS).map(([key, label]) => (
                                                        <SelectItem key={key} value={key}>
                                                          {label}
                                                        </SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                                {(service.deliveryType === 'dias_uteis' || service.deliveryType === 'dias_corridos') && (
                                                  <div className="space-y-2">
                                                    <Label>Quantidade de dias</Label>
                                                    <Input
                                                      type="number"
                                                      min={1}
                                                      value={service.deliveryDays || ''}
                                                      onChange={(e) =>
                                                        updateNewVersionService(service.id, { deliveryDays: parseInt(e.target.value) || 1 })
                                                      }
                                                      placeholder="Ex: 15"
                                                    />
                                                  </div>
                                                )}
                                                {service.deliveryType === 'data_especifica' && (
                                                  <div className="space-y-2">
                                                    <Label>Data de entrega</Label>
                                                    <Popover>
                                                      <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start">
                                                          <Calendar className="w-4 h-4 mr-2" />
                                                          {service.deliveryDate
                                                            ? format(new Date(service.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy')
                                                            : 'Selecionar data'}
                                                        </Button>
                                                      </PopoverTrigger>
                                                      <PopoverContent className="w-auto p-0" align="start">
                                                        <CalendarComponent
                                                          mode="single"
                                                          selected={service.deliveryDate ? new Date(service.deliveryDate + 'T12:00:00') : undefined}
                                                          onSelect={(d) => d && updateNewVersionService(service.id, { deliveryDate: format(d, 'yyyy-MM-dd') })}
                                                          locale={ptBR}
                                                          initialFocus
                                                          className="p-3 pointer-events-auto"
                                                        />
                                                      </PopoverContent>
                                                    </Popover>
                                                  </div>
                                                )}
                                              </div>

                                              {/* Costs Table */}
                                              <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <Label>Custos</Label>
                                                  <div className="flex gap-2">
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => addCostToNewVersionService(service.id)}
                                                    >
                                                      <Plus className="w-3 h-3 mr-1" />
                                                      Item
                                                    </Button>
                                                    <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => openCatalogForNewVersionService(service.id, service.serviceType)}
                                                    >
                                                      <Package className="w-3 h-3 mr-1" />
                                                      Do catálogo
                                                    </Button>
                                                  </div>
                                                </div>
                                                {service.costs.length > 0 && (
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead className="w-8"></TableHead>
                                                        <TableHead>Descrição</TableHead>
                                                        <TableHead className="w-16">Qtd</TableHead>
                                                        <TableHead className="w-28">V. Unit.</TableHead>
                                                        <TableHead className="w-24">Total</TableHead>
                                                        <TableHead className="w-12"></TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <SortableTableBody
                                                      items={service.costs}
                                                      onReorder={(newCosts) => setNewVersionServices(prev => prev.map(s => s.id === service.id ? { ...s, costs: newCosts } : s))}
                                                      renderRow={(cost, handle) => (
                                                        <>
                                                          <TableCell className="w-8">{handle}</TableCell>
                                                          <TableCell>
                                                            <Input
                                                              value={cost.description}
                                                              onChange={(e) =>
                                                                updateNewVersionCost(service.id, cost.id, {
                                                                  description: e.target.value,
                                                                })
                                                              }
                                                              placeholder="Descrição do custo"
                                                            />
                                                          </TableCell>
                                                          <TableCell>
                                                            <Input
                                                              type="number"
                                                              min={1}
                                                              value={cost.quantity || 1}
                                                              onChange={(e) => {
                                                                const qty = parseInt(e.target.value) || 1;
                                                                updateNewVersionCost(service.id, cost.id, {
                                                                  quantity: qty,
                                                                  value: qty * (cost.unitValue || 0),
                                                                });
                                                              }}
                                                              className="h-8 w-20 px-2 text-sm"
                                                            />

                                                          </TableCell>
                                                          <TableCell>
                                                            <Input
                                                              type="number"
                                                              min={0}
                                                              value={cost.unitValue || ''}
                                                              onChange={(e) => {
                                                                const uv = parseFloat(e.target.value) || 0;
                                                                updateNewVersionCost(service.id, cost.id, {
                                                                  unitValue: uv,
                                                                  value: (cost.quantity || 1) * uv,
                                                                });
                                                              }}
                                                            />
                                                          </TableCell>
                                                          <TableCell>
                                                            <span className="text-sm font-medium">
                                                              {formatCurrency(cost.value || 0)}
                                                            </span>
                                                          </TableCell>
                                                          <TableCell>
                                                            <Button
                                                              type="button"
                                                              variant="ghost"
                                                              size="sm"
                                                              onClick={() => removeNewVersionCost(service.id, cost.id)}
                                                            >
                                                              <Trash2 className="w-4 h-4 text-destructive" />
                                                            </Button>
                                                          </TableCell>
                                                        </>
                                                      )}
                                                    />
                                                  </Table>
                                                )}
                                              </div>

                                              {/* Service Summary */}
                                              <div className="p-3 bg-muted rounded-lg text-sm">
                                                <p className="text-muted-foreground">Custo de Produção</p>
                                                <p className="font-semibold">{formatCurrency(calc.productionCost)}</p>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        );
                                      })}

                                      {/* Operational Costs in New Version */}
                                      <Card className="border-l-4 border-l-warning">
                                        <CardHeader className="pb-3">
                                          <div className="flex items-center justify-between">
                                            <CardTitle className="text-base flex items-center gap-2">
                                              <DollarSign className="w-4 h-4 text-warning" />
                                              Despesas Operacionais
                                            </CardTitle>
                                            <div className="flex gap-2">
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  setNewVersionOperationalCosts(prev => [...prev, {
                                                    id: uuidv4(),
                                                    description: '',
                                                    quantity: 1,
                                                    unitValue: 0,
                                                    value: 0,
                                                    paymentStatus: 'pendente' as PaymentStatus,
                                                    paymentDate: null,
                                                  }]);
                                                }}
                                              >
                                                <Plus className="w-3 h-3 mr-1" />
                                                Adicionar
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={openCatalogForNewVersionOperational}
                                              >
                                                <Package className="w-3 h-3 mr-1" />
                                                Do catálogo
                                              </Button>
                                            </div>
                                          </div>
                                        </CardHeader>
                                        <CardContent>
                                          {newVersionOperationalCosts.length > 0 ? (
                                            <Table>
                                              <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                  <TableHead className="w-8"></TableHead>
                                                  <TableHead>Descrição</TableHead>
                                                  <TableHead className="w-[70px]">Qtd</TableHead>
                                                  <TableHead>V. Unit.</TableHead>
                                                  <TableHead>Total</TableHead>
                                                  <TableHead className="w-10"></TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <SortableTableBody
                                                items={newVersionOperationalCosts}
                                                onReorder={(items) => setNewVersionOperationalCosts(items)}
                                                renderRow={(cost, handle) => (
                                                  <>
                                                    <TableCell className="w-8">{handle}</TableCell>
                                                    <TableCell>
                                                      <Input
                                                        value={cost.description}
                                                        onChange={(e) =>
                                                          setNewVersionOperationalCosts(prev => prev.map(c =>
                                                            c.id === cost.id ? { ...c, description: e.target.value } : c
                                                          ))
                                                        }
                                                        placeholder="Ex: Passagens, Hotel..."
                                                        className="h-8"
                                                      />
                                                    </TableCell>
                                                    <TableCell>
                                                      <Input
                                                        type="number"
                                                        min="1"
                                                        value={cost.quantity || 1}
                                                        onChange={(e) => {
                                                          const qty = parseInt(e.target.value) || 1;
                                                          setNewVersionOperationalCosts(prev => prev.map(c =>
                                                            c.id === cost.id ? { ...c, quantity: qty, value: qty * (c.unitValue || 0) } : c
                                                          ));
                                                        }}
                                                        className="h-8 w-20 px-2 text-sm"
                                                      />
                                                    </TableCell>
                                                    <TableCell>
                                                      <Input
                                                        type="number"
                                                        value={cost.unitValue || ''}
                                                        onChange={(e) => {
                                                          const uv = parseFloat(e.target.value) || 0;
                                                          setNewVersionOperationalCosts(prev => prev.map(c =>
                                                            c.id === cost.id ? { ...c, unitValue: uv, value: (c.quantity || 1) * uv } : c
                                                          ));
                                                        }}
                                                        placeholder="0,00"
                                                        className="h-8 w-28"
                                                      />
                                                    </TableCell>
                                                    <TableCell>
                                                      <span className="text-sm font-medium">
                                                        {formatCurrency(cost.value || 0)}
                                                      </span>
                                                    </TableCell>
                                                    <TableCell>
                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setNewVersionOperationalCosts(prev => prev.filter(c => c.id !== cost.id))}
                                                      >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                      </Button>
                                                    </TableCell>
                                                  </>
                                                )}
                                                footer={
                                                  <TableRow className="bg-muted/30">
                                                    <TableCell colSpan={4} className="font-semibold">Total</TableCell>
                                                    <TableCell className="font-bold">{formatCurrency(newVersionOperationalTotal)}</TableCell>
                                                    <TableCell />
                                                  </TableRow>
                                                }
                                              />
                                            </Table>
                                          ) : (
                                            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa operacional</p>
                                          )}
                                        </CardContent>
                                      </Card>

                                      {/* Composição do Investimento */}
                                      {newVersionServices.length > 0 && (
                                        <Card className="border-l-4 border-l-primary">
                                          <CardHeader className="pb-3">
                                            <CardTitle className="text-base flex items-center gap-2">
                                              <Calculator className="w-4 h-4 text-primary" />
                                              Composição do Investimento
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="space-y-2">
                                                <Label>Nota Fiscal (%)</Label>
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  value={newVersionNfPct}
                                                  onChange={(e) => setNewVersionNfPct(parseFloat(e.target.value) || 0)}
                                                />
                                              </div>
                                              <div className="space-y-2">
                                                <Label>Margem Desejada (%)</Label>
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  max={99}
                                                  value={newVersionTargetMargin}
                                                  onChange={(e) => setNewVersionTargetMargin(parseFloat(e.target.value) || 0)}
                                                />
                                              </div>
                                            </div>

                                            <div className="space-y-2 p-4 bg-muted rounded-lg text-sm">
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Custo de Produção</span>
                                                <span className="font-medium">{formatCurrency(newVersionTotals.productionCost)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Despesas Operacionais</span>
                                                <span className="font-medium">{formatCurrency(newVersionTotals.operationalTotal)}</span>
                                              </div>
                                              <div className="flex justify-between border-t pt-2">
                                                <span className="font-semibold">Total dos Custos</span>
                                                <span className="font-semibold">{formatCurrency(newVersionTotals.totalCosts)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Margem ({newVersionTargetMargin}%)</span>
                                                <span className="font-medium">{formatCurrency(newVersionTotals.marginValue)}</span>
                                              </div>
                                              <div className="flex justify-between">
                                                <span className="text-muted-foreground">Nota Fiscal ({newVersionNfPct}%)</span>
                                                <span className="font-medium">{formatCurrency(newVersionTotals.nfValue)}</span>
                                              </div>
                                              <div className="flex justify-between border-t pt-2">
                                                <span className="font-bold text-base">Valor Total do Projeto</span>
                                                <span className="font-bold text-base text-primary">{formatCurrency(newVersionTotals.totalProjectValue)}</span>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      )}
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setNewVersionOpen(false)}>
                                        Cancelar
                                      </Button>
                                      <Button onClick={handleCreateNewVersion}>
                                        <Save className="w-4 h-4 mr-2" />
                                        Salvar V{budget.currentVersion + 1}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                                  <DialogTrigger asChild>
                                    <Button size="sm" className="bg-success hover:bg-success/90">
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Aprovar
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Aprovar Orçamento</DialogTitle>
                                      <DialogDescription>
                                        Confirma a aprovação da versão V{budget.currentVersion}?
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4 space-y-4">
                                      <div>
                                        <p className="text-sm">
                                          Valor final:{' '}
                                          <span className="font-bold">
                                            {formatCurrency(currentVersionData?.fullPrice || 0)}
                                          </span>
                                        </p>
                                      </div>

                                      <div>
                                        <Label htmlFor="execution-month">Mês de Execução</Label>
                                        <Input
                                          id="execution-month"
                                          type="month"
                                          value={approveExecutionMonth}
                                          onChange={(e) => setApproveExecutionMonth(e.target.value)}
                                          className="mt-1"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Mês previsto para execução do projeto (opcional)
                                        </p>
                                      </div>

                                      <p className="text-xs text-muted-foreground">
                                        Uma planilha de execução será criada automaticamente para acompanhar os custos reais.
                                      </p>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setApproveOpen(false)}>
                                        Cancelar
                                      </Button>
                                      <Button className="bg-success hover:bg-success/90" onClick={handleApprove}>
                                        Confirmar Aprovação
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}

                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {budget.versions.map((version) => {
                            const isSelected = version.version === budget.currentVersion;
                            const hasMultiple = budget.versions.length > 1;
                            return (
                            <div
                              key={version.id}
                              onClick={() => {
                                if (!hasMultiple || isSelected || isEditingVersion) return;
                                updateBudget(budget.id, { currentVersion: version.version });
                                toast.success(`Exibindo V${version.version}`);
                              }}
                              className={`p-4 rounded-lg border transition-colors ${
                                hasMultiple && !isSelected && !isEditingVersion ? 'cursor-pointer hover:border-primary/60 hover:bg-muted/30' : ''
                              } ${
                                version.version === budget.approvedVersion
                                  ? 'border-success bg-success/5'
                                  : version.isRejected
                                  ? 'border-destructive/30 bg-destructive/5'
                                  : isSelected
                                  ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
                                  : 'border-muted'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">V{version.version}</span>
                                  {isSelected && (
                                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                      Exibindo
                                    </span>
                                  )}
                                  {version.version === budget.approvedVersion && (
                                    <span className="text-xs bg-success text-success-foreground px-2 py-0.5 rounded">
                                      Aprovada
                                    </span>
                                  )}
                                  {version.isRejected && (
                                    <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded">
                                      Recusada
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{formatCurrency(version.fullPrice)}</span>
                                  {!version.isRejected && budget.status !== 'aprovada' && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRejectingVersionId(version.id);
                                        setRejectDialogOpen(true);
                                      }}

                                      title="Marcar como recusada"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {version.version > 1 && version.version === Math.max(...budget.versions.map(v => v.version)) && budget.status !== 'aprovada' && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Tem certeza que deseja excluir a versão V${version.version}?`)) {
                                          await deleteLastVersion(budget.id);
                                        }
                                      }}

                                      title={`Excluir V${version.version}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {canDownloadPDF && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); generatePDFForVersion(version); }}
                                      title={`Gerar PDF V${version.version}`}
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{version.reason}</p>
                              {version.isRejected && version.rejectionReason && (
                                <div className="mt-2 p-2 bg-destructive/10 rounded text-sm">
                                  <p className="text-xs text-destructive font-medium mb-1">Motivo da recusa:</p>
                                  <p className="text-destructive/80">{version.rejectionReason}</p>
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(version.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            );
                          })}

                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Ocultar NF/Despesas no PDF */}
                {isAdminOrOwner && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
                  >
                    {/* Box 1: Nota Fiscal */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col gap-3">
                      <h4 className="text-sm font-semibold text-foreground">Nota Fiscal</h4>
                      <button
                        type="button"
                        onClick={async () => {
                          const newValue = !budget.hideNfInPdf;
                          await updateBudget(budget.id, { hideNfInPdf: newValue });
                          toast.success(newValue ? 'NF será ocultada no PDF (diluída nos serviços)' : 'NF voltará a aparecer no PDF');
                        }}
                        className="flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                        title="Quando ativo, o valor da NF é diluído proporcionalmente nos serviços e não aparece como linha separada no PDF"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${budget.hideNfInPdf ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                          {budget.hideNfInPdf && <CheckCircle className="w-3 h-3" />}
                        </span>
                        Ocultar Nota Fiscal no PDF (diluir valor nos serviços)
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const newValue = !budget.hideNfObservationInPdf;
                          await updateBudget(budget.id, { hideNfObservationInPdf: newValue });
                          toast.success(newValue ? 'Observação sobre NF será ocultada no PDF' : 'Observação sobre NF voltará a aparecer no PDF');
                        }}
                        className="flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                        title="Quando ativo, o quadro de observação sobre emissão de Nota Fiscal não aparece no PDF"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${budget.hideNfObservationInPdf ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                          {budget.hideNfObservationInPdf && <CheckCircle className="w-3 h-3" />}
                        </span>
                        Ocultar observação sobre faturamento (Nota Fiscal) no PDF
                      </button>
                    </div>

                    {/* Box 2: Despesas Operacionais */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4 flex flex-col gap-3">
                      <h4 className="text-sm font-semibold text-foreground">Despesas Operacionais</h4>
                      <button
                        type="button"
                        onClick={async () => {
                          const newValue = !budget.hideOperationalInPdf;
                          await updateBudget(budget.id, { hideOperationalInPdf: newValue });
                          toast.success(newValue ? 'Despesas Operacionais serão ocultadas no PDF (diluídas nos serviços)' : 'Despesas Operacionais voltarão a aparecer no PDF');
                        }}
                        className="flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                        title="Quando ativo, o valor das despesas operacionais é diluído proporcionalmente nos serviços e não aparece como bloco separado no PDF"
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${budget.hideOperationalInPdf ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                          {budget.hideOperationalInPdf && <CheckCircle className="w-3 h-3" />}
                        </span>
                        Ocultar Despesas Operacionais no PDF (diluir valor nos serviços)
                      </button>
                    </div>
                  </motion.div>
                )}

              </>
            )}

            {/* Execution View */}
            {activeTab === 'execution' && budget.execution && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="card-elevated border-2 border-success/30">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-success/10">
                        <BarChart3 className="w-6 h-6 text-success" />
                      </div>
                      <div className="flex-1">
                        <CardTitle>Planilha de Execução</CardTitle>
                        <CardDescription>
                          Acompanhe os custos reais vs. orçados
                        </CardDescription>
                      </div>
                      {(() => {
                        const hdInfo = getHDForBudget(budget.id);
                        return hdInfo ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 gap-1.5 px-3 py-1">
                            <HardDrive className="w-3.5 h-3.5" />
                            {hdInfo.hdLabel}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                  </CardHeader>
                  <CardContent>


                    {/* Services Execution */}
                    {budget.execution.services.map((service) => {
                      const Icon = SERVICE_ICONS[service.serviceType] || Layers;
                      const objectives = getObjectivesForCategory(service.serviceType);
                      const objectiveLabel = objectives.find(o => o.value === service.objective)?.label || service.objective;
                      const extraCosts = service.extraCosts || [];

                      return (
                        <div key={service.id} className="mb-6 last:mb-0">
                          {/* Service Header */}
                          <div className="flex items-center mb-3 p-3 bg-foreground/5 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-foreground text-background rounded-lg">
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{service.serviceType}</span>
                                  <span className="text-muted-foreground">-</span>
                                  <span>{objectiveLabel}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Main Costs Table */}
                          <div className="rounded-lg border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead>Descrição</TableHead>
                                  <TableHead className="text-right">Orçado</TableHead>
                                  <TableHead className="text-right">Real</TableHead>
                                  <TableHead>Equipe</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Data Pgto</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {service.costs.map((cost) => (
                                  <TableRow key={cost.id}>
                                    <TableCell>{cost.description}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      {formatCurrency(cost.budgetedValue)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        value={cost.realValue}
                                        onChange={(e) => handleUpdateExecutionCost(
                                          service.id,
                                          cost.id,
                                          parseFloat(e.target.value) || 0,
                                          false
                                        )}
                                        className="w-28 text-right h-8"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <TeamMemberSelect
                                        value={cost.supplier || ''}
                                        onChange={(v) => handleUpdateExecutionSupplier(service.id, cost.id, v)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={cost.paymentStatus}
                                        onValueChange={(value) => handleUpdateExecutionPayment(
                                          service.id,
                                          cost.id,
                                          value as PaymentStatusType,
                                          value === 'pago' ? new Date() : null,
                                          false
                                        )}
                                      >
                                        <SelectTrigger className="w-28 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                              {label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {cost.paymentDate
                                        ? new Date(cost.paymentDate).toLocaleDateString('pt-BR')
                                        : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Extra Costs Section */}
                          {extraCosts.length > 0 && (
                            <div className="mt-3 rounded-lg border border-warning/30 overflow-hidden">
                              <div className="bg-warning/10 px-4 py-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-warning">Gastos Extras (não previstos)</span>
                              </div>
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-warning/5">
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead>Equipe</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Data Pgto</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {extraCosts.map((cost) => (
                                    <TableRow key={cost.id}>
                                      <TableCell>{cost.description}</TableCell>
                                      <TableCell className="text-right">
                                        <Input
                                          type="number"
                                          value={cost.realValue}
                                          onChange={(e) => handleUpdateExecutionCost(
                                            service.id,
                                            cost.id,
                                            parseFloat(e.target.value) || 0,
                                            true
                                          )}
                                          className="w-28 text-right h-8"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <TeamMemberSelect
                                          value={cost.supplier || ''}
                                          onChange={(v) => handleUpdateExtraCostSupplier(service.id, cost.id, v)}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={cost.paymentStatus}
                                          onValueChange={(value) => handleUpdateExecutionPayment(
                                            service.id,
                                            cost.id,
                                            value as PaymentStatusType,
                                            value === 'pago' ? new Date() : null,
                                            true
                                          )}
                                        >
                                          <SelectTrigger className="w-28 h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                                              <SelectItem key={value} value={value}>
                                                {label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {cost.paymentDate
                                          ? new Date(cost.paymentDate).toLocaleDateString('pt-BR')
                                          : '-'}
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRemoveExtraCost(service.id, cost.id)}
                                        >
                                          <Trash2 className="w-3 h-3 text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}

                          {/* Add Extra Cost Button */}
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedServiceForExtraCost(service.id);
                                setExtraCostDialogOpen(true);
                              }}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Adicionar gasto extra
                            </Button>
                          </div>

                          {/* Resumo por Entrega */}
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Resumo por Entrega</h4>
                             <div className="grid grid-cols-3 gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-lg text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">Custo de Produção</p>
                                <p className="font-semibold text-orange-500">{formatCurrency(service.realTotal)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Margem para este serviço</p>
                                {(() => {
                                  const realSubtotal = service.budgetedFinalValue || service.finalValue;
                                  const realMargin = realSubtotal - service.realTotal;
                                  const realMarginPct = realSubtotal > 0 ? (realMargin / realSubtotal) * 100 : 0;
                                  const marginColor = realMargin >= 0 ? 'text-success' : 'text-destructive';
                                  return (
                                    <p className={`font-semibold ${marginColor}`}>
                                      {formatCurrency(realMargin)} <span className="text-xs font-normal">({realMarginPct.toFixed(1)}%)</span>
                                    </p>
                                  );
                                })()}
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Subtotal</p>
                                <p className="font-semibold text-blue-500">{formatCurrency(service.budgetedFinalValue || service.finalValue)}</p>
                              </div>
                             </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Operational Costs in Execution */}
                    {(() => {
                      const opCosts = budget.execution.operationalCosts || [];
                      const extraOpCosts = budget.execution.extraOperationalCosts || [];
                      if (opCosts.length === 0 && extraOpCosts.length === 0) return null;
                      const opTotal = opCosts.reduce((sum, c) => sum + c.realValue, 0) + extraOpCosts.reduce((sum, c) => sum + c.realValue, 0);
                      const opBudgeted = opCosts.reduce((sum, c) => sum + c.budgetedValue, 0);
                      
                      return (
                        <div className="mb-6">
                          <div className="flex items-center mb-3 p-3 bg-warning/5 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-warning/20 text-warning rounded-lg">
                                <DollarSign className="w-4 h-4" />
                              </div>
                              <span className="font-bold">Despesas Operacionais</span>
                            </div>
                          </div>
                          
                          <div className="rounded-lg border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead>Descrição</TableHead>
                                  <TableHead className="text-right">Orçado</TableHead>
                                  <TableHead className="text-right">Real</TableHead>
                                  <TableHead>Equipe</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Data Pgto</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {opCosts.map((cost) => (
                                  <TableRow key={cost.id}>
                                    <TableCell>{cost.description}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      {formatCurrency(cost.budgetedValue)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        value={cost.realValue}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          updateExecution(budget.id, {
                                            operationalCosts: (budget.execution?.operationalCosts || []).map(c =>
                                              c.id === cost.id ? { ...c, realValue: val } : c
                                            ),
                                          });
                                        }}
                                        className="w-28 text-right h-8"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <TeamMemberSelect
                                        value={cost.supplier || ''}
                                        onChange={(v) => {
                                          updateExecution(budget.id, {
                                            operationalCosts: (budget.execution?.operationalCosts || []).map(c =>
                                              c.id === cost.id ? { ...c, supplier: v } : c
                                            ),
                                          });
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={cost.paymentStatus}
                                        onValueChange={(value) => {
                                          updateExecution(budget.id, {
                                            operationalCosts: (budget.execution?.operationalCosts || []).map(c =>
                                              c.id === cost.id ? { ...c, paymentStatus: value as PaymentStatusType, paymentDate: value === 'pago' ? new Date() : null } : c
                                            ),
                                          });
                                        }}
                                      >
                                        <SelectTrigger className="w-28 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                              {label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {cost.paymentDate
                                        ? new Date(cost.paymentDate).toLocaleDateString('pt-BR')
                                        : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          
                          <div className="mt-3 grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Orçado</p>
                              <p className="font-semibold text-orange-500">{formatCurrency(opBudgeted)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Real</p>
                              <p className="font-semibold text-destructive">{formatCurrency(opTotal)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Consolidação Final do Projeto */}
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          Consolidação final do projeto
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const layoutSettings = await fetchLayoutSettings();
                              await generateFinancialReportPDF({
                                budget,
                                client,
                                userName: profile?.name || '',
                                layoutSettings,
                                categoryLabels: serviceCategories.reduce((acc, c) => { acc[c.key] = c.label; return acc; }, {} as Record<string, string>),
                                objectiveLabels: (() => { const map: Record<string, Record<string, string>> = {}; serviceCategories.forEach(c => { (getObjectivesForCategory(c.key) || []).forEach(o => { if (!map[c.key]) map[c.key] = {}; map[c.key][o.value] = o.label; }); }); return map; })(),
                              });
                              toast.success('Relatório financeiro gerado!');
                            } catch (err) {
                              console.error(err);
                              toast.error('Erro ao gerar relatório');
                            }
                          }}
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Exportar Relatório
                        </Button>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        {/* Investimento Total */}
                        <div className="flex justify-between items-center py-1">
                          <span className="text-sm font-medium">Investimento Total</span>
                          <span className="font-bold text-lg">{formatCurrency(budget.finalValue || 0)}</span>
                        </div>

                        <Separator />

                        {/* Custo Real por entrega */}
                        {budget.execution?.services?.map((svc, idx) => {
                          const svcRealTotal = svc.costs?.reduce((sum: number, c: any) => sum + (c.realValue || 0), 0) || 0;
                          const extraCostsTotal = svc.extraCosts?.reduce((sum: number, c: any) => sum + (c.realValue || 0), 0) || 0;
                          const objLabel = svc.objective || '';
                          return (
                            <div key={svc.id || idx} className="flex justify-between items-center py-1">
                              <span className="text-sm text-muted-foreground">
                                {idx + 1}. {getCategoryLabel(svc.serviceType)}{objLabel ? ` — ${objLabel}` : ''} (Custo Real)
                              </span>
                              <span className="font-semibold text-destructive">{formatCurrency(svcRealTotal + extraCostsTotal)}</span>
                            </div>
                          );
                        })}

                        {/* Despesas Operacionais Reais */}
                        {(() => {
                          const opReal = budget.execution?.operationalCosts?.reduce((sum: number, c: any) => sum + (c.realValue || 0), 0) || 0;
                          const extraOpReal = budget.execution?.extraOperationalCosts?.reduce((sum: number, c: any) => sum + (c.realValue || 0), 0) || 0;
                          const totalOpReal = opReal + extraOpReal;
                          if (totalOpReal > 0) {
                            return (
                              <div className="flex justify-between items-center py-1">
                                <span className="text-sm text-muted-foreground">Despesas Operacionais (Real)</span>
                                <span className="font-semibold text-destructive">{formatCurrency(totalOpReal)}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Imposto NF */}
                        <div className="flex justify-between items-center py-1">
                          <span className="text-sm text-muted-foreground">Imposto NF</span>
                          {isEditingNf ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={executionNfValue}
                                onChange={(e) => setExecutionNfValue(parseFloat(e.target.value) || 0)}
                                className="w-24 h-8"
                              />
                              <Button size="sm" variant="ghost" onClick={handleSaveNfValue}>
                                <Save className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="font-semibold cursor-pointer hover:text-primary flex items-center gap-1"
                              onClick={() => {
                                setExecutionNfValue(budget.execution?.nfTaxValue || 0);
                                setIsEditingNf(true);
                              }}
                            >
                              {formatCurrency(budget.execution?.nfTaxValue || 0)}
                              <Edit2 className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        <Separator />

                        {/* Margem Real */}
                        {(() => {
                          const investimento = budget.finalValue || 0;
                          const custoRealTotal = (budget.execution?.realTotal || 0) + (budget.execution?.nfTaxValue || 0);
                          const margemReais = investimento - custoRealTotal;
                          const margemPercent = investimento > 0 
                            ? ((margemReais) / investimento) * 100 
                            : 0;
                          return (
                            <div className="flex justify-between items-center py-1">
                              <span className="text-sm font-medium">Margem Real</span>
                              <span className={`font-bold text-lg ${getMarginColor(margemPercent)}`}>
                                {formatCurrency(margemReais)} ({margemPercent.toFixed(1)}%)
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Finalization Section */}
                    <div className="mt-8 pt-6 border-t">
                      {budget.execution.isFinalized ? (
                        <div className="p-4 bg-success/10 border border-success/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Flag className="w-5 h-5 text-success" />
                            <span className="font-semibold text-success">Execução Finalizada</span>
                          </div>
                          {budget.execution.finalizedAt && (
                            <p className="text-sm text-muted-foreground mb-2">
                              Finalizado em {new Date(budget.execution.finalizedAt).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                          {budget.execution.finalReport && (
                            <div className="mt-3 p-3 bg-background/50 rounded">
                              <p className="text-xs text-muted-foreground mb-1">Relatório Final:</p>
                              <p className="text-sm">{budget.execution.finalReport}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <h3 className="font-semibold">Finalizar Execução</h3>
                            <p className="text-sm text-muted-foreground">
                              Consolide a operação e gere um relatório final
                            </p>
                          </div>
                          <Button onClick={() => setFinalizeDialogOpen(true)}>
                            <Flag className="w-4 h-4 mr-2" />
                            Finalizar Execução
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* If Approved - Show approval info */}
            {budget.status === 'aprovada' && activeTab === 'budget' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="card-elevated border-success/30 bg-success/5">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-success/10">
                        <CheckCircle className="w-6 h-6 text-success" />
                      </div>
                      <div>
                        <CardTitle className="text-success">Projeto Aprovado</CardTitle>
                        <CardDescription>
                          {budget.approvalDate &&
                            `Aprovado em ${new Date(budget.approvalDate).toLocaleDateString('pt-BR')}`}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Versão Aprovada</p>
                        <p className="font-bold text-lg">V{budget.approvedVersion}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Valor Final</p>
                        <p className="font-bold text-lg text-success">
                          {formatCurrency(budget.finalValue || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        {/* Contract */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Contrato</p>
                          {budget.contractUrl ? (
                            <div className="flex gap-2">
                              <Button variant="outline" className="flex-1" onClick={() => handleViewDoc(budget.contractUrl!)}>
                                <Eye className="w-4 h-4 mr-2" /> Visualizar
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => handleRemoveDoc('contract')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <label className="block">
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleDocUpload('contract', e.target.files[0])}
                              />
                              <Button variant="outline" className="w-full" asChild disabled={uploadingDoc === 'contract'}>
                                <span>
                                  {uploadingDoc === 'contract' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                  Upload Contrato (PDF)
                                </span>
                              </Button>
                            </label>
                          )}
                        </div>

                        {/* NF */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Nota Fiscal</p>
                          {budget.nfUrl ? (
                            <div className="flex gap-2">
                              <Button variant="outline" className="flex-1" onClick={() => handleViewDoc(budget.nfUrl!)}>
                                <Eye className="w-4 h-4 mr-2" /> Visualizar
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => handleRemoveDoc('nf')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <label className="block">
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleDocUpload('nf', e.target.files[0])}
                              />
                              <Button variant="outline" className="w-full" asChild disabled={uploadingDoc === 'nf'}>
                                <span>
                                  {uploadingDoc === 'nf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                  Upload Nota Fiscal (PDF)
                                </span>
                              </Button>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Right Column - Client Info & Stats */}
          <div className="space-y-6">
            {/* Client Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Cliente</CardTitle>
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={client.score} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 gap-1 text-xs"
                        onClick={() => navigate(`/clientes/${client.id}`)}
                        title="Ver perfil do cliente"
                      >
                        Ver perfil
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{client.companyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCNPJ(client.cnpj)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{client.responsiblePerson}</p>
                      <p className="text-xs text-muted-foreground">Responsável</p>
                    </div>
                  </div>

                  <a
                    href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-success/10 hover:bg-success/20 transition-colors"
                  >
                    <Phone className="w-4 h-4 text-success" />
                    <div>
                      <p className="font-medium text-success">
                        {formatPhone(client.phone)}
                      </p>
                      <p className="text-xs text-success/80">WhatsApp</p>
                    </div>
                  </a>
                </CardContent>
              </Card>
            </motion.div>


            {/* Timeline */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-base">Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-foreground" />
                      <div>
                        <p className="text-sm font-medium">Orçamento Criado</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(budget.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    {budget.versions.map((version) => (
                      <div key={version.id} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Versão V{version.version}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(version.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}

                    {budget.approvalDate && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <div>
                          <p className="text-sm font-medium text-success">Aprovado</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(budget.approvalDate).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {budget.execution?.isFinalized && budget.execution.finalizedAt && (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div>
                          <p className="text-sm font-medium text-primary">Execução Finalizada</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(budget.execution.finalizedAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Extra Cost Dialog */}
      <Dialog open={extraCostDialogOpen} onOpenChange={setExtraCostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Gasto Extra</DialogTitle>
            <DialogDescription>
              Adicione um gasto que não estava previsto no orçamento original
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={newExtraCostDescription}
                onChange={(e) => setNewExtraCostDescription(e.target.value)}
                placeholder="Ex: Transporte adicional, Equipamento extra..."
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                value={newExtraCostValue}
                onChange={(e) => setNewExtraCostValue(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Equipe</Label>
              <TeamMemberSelect
                value={newExtraCostSupplier}
                onChange={setNewExtraCostSupplier}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtraCostDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddExtraCost}>
              Adicionar Gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Proposta como Recusada</DialogTitle>
            <DialogDescription>
              Informe o motivo pelo qual o cliente recusou esta proposta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo da recusa *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Cliente optou por outra proposta, valor acima do orçamento..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRejectDialogOpen(false);
              setRejectingVersionId(null);
              setRejectionReason('');
            }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejectVersion}>
              <XCircle className="w-4 h-4 mr-2" />
              Marcar como Recusada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Execution Dialog */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Execução</DialogTitle>
            <DialogDescription>
              Consolide a operação. Você ainda poderá editar os dados após finalizar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Relatório Final (opcional)</Label>
              <Textarea
                value={finalReport}
                onChange={(e) => setFinalReport(e.target.value)}
                placeholder="Observações finais, aprendizados, feedback do cliente..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setFinalizeDialogOpen(false);
              setFinalReport('');
            }}>
              Cancelar
            </Button>
            <Button onClick={handleFinalizeExecution}>
              <Flag className="w-4 h-4 mr-2" />
              Finalizar Execução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServiceItemSelector
        open={catalogSelector.open}
        onOpenChange={(open) => setCatalogSelector(prev => ({ ...prev, open }))}
        categoryKey={catalogSelector.categoryKey}
        onSelect={catalogSelector.onPick}
      />
    </div>
  );
}
