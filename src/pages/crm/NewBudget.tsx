import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePaymentTerms } from '@/hooks/usePaymentTerms';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { ServiceItemSelector } from '@/components/crm/ServiceItemSelector';
import { SortableTableBody } from '@/components/crm/SortableTableBody';
import { ContactSelect } from '@/components/crm/ContactSelect';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { Header } from '@/components/layout/Header';
import { useCRM } from '@/contexts/CRMContext';
import {
  CRMStatus,
  ServiceType,
  CostItem,
  PaymentStatus,
  PAYMENT_STATUS_LABELS,
  formatCurrency,
  DeliveryType,
  DELIVERY_TYPE_LABELS,
} from '@/types/crm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Save,
  FileText,
  Plus,
  Trash2,
  Calculator,
  DollarSign,
  Percent,
  Check,
  ChevronsUpDown,
  Film,
  Camera,
  Smartphone,
  CalendarIcon,
  Download,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

const SERVICE_ICONS: Record<string, typeof Film> = {
  CINE: Film,
  FOTO: Camera,
  MOBILE: Smartphone,
};

// Tipo para serviço individual
interface ServiceItem {
  id: string;
  serviceType: ServiceType;
  objective: string;
  description: string;
  costs: CostItem[];
  fixedCostPercentage: number;
  nfCostPercentage: number;
  targetMargin: number;
  deliveryType?: DeliveryType;
  deliveryDays?: number;
  deliveryDate?: string;
}

export function NewBudget() {
  const { clients, addBudget, addBudgetVersion, kanbanColumns, serviceCategories, getObjectivesForCategory, getCategoryLabel, budgets, isLoading: crmLoading } = useCRM();
  const { workspace, role } = useAuth();
  const navigate = useNavigate();

  // Auto-generate next proposalId starting from 900
  const nextProposalId = useMemo(() => {
    const numericIds = budgets
      .map(b => parseInt(b.proposalId, 10))
      .filter(n => !isNaN(n));
    const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 899;
    return String(Math.max(maxId + 1, 900));
  }, [budgets]);

  const [formData, setFormData] = useState({
    status: 'oportunidade_mapeada' as CRMStatus,
    proposalId: nextProposalId,
    projectName: '',
    projectDescription: '',
    clientId: '',
    contactId: null as string | null,
    paymentTerms: '',
    includesTax: true,
    includesLogistics: false,
    includesAccommodation: false,
    includesMeals: false,
    includesRawMaterial: false,
    includesTechnicalVisit: false,
    hasExecutionDate: false,
    executionStartDate: null as Date | null,
    executionEndDate: null as Date | null,
    location: '',
    fixedCostPercentage: 0, // deprecated, always 0
    nfCostPercentage: 0,
    targetMargin: 0,
  });

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [operationalCosts, setOperationalCosts] = useState<CostItem[]>([]);
  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [selectorServiceId, setSelectorServiceId] = useState<string | null>(null);
  const [opCostSelectorOpen, setOpCostSelectorOpen] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Payment terms from commercial rules
  const availablePaymentTerms = usePaymentTerms(workspace?.id);

  // Sincronizar proposalId quando budgets carregam
  useEffect(() => {
    setFormData(prev => ({ ...prev, proposalId: nextProposalId }));
  }, [nextProposalId]);

  // Load commercial rules (workspace settings + payment terms)
  useEffect(() => {
    if (!workspace?.id) return;
    
    // Load cost settings
    supabase
      .from('workspace_settings')
      .select('*')
      .eq('workspace_id', workspace.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
           setFormData(prev => ({
            ...prev,
            fixedCostPercentage: 0, // deprecated, always 0
            nfCostPercentage: Number(data.default_nf_percentage),
            targetMargin: Number(data.default_target_margin_percentage),
          }));
        }
      });

  }, [workspace?.id]);

  // Filtrar clientes pela busca
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    return clients.filter(client =>
      client.companyName.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clients, clientSearch]);

  // Cliente selecionado
  const selectedClient = clients.find(c => c.id === formData.clientId);

  // Cálculos por serviço (apenas custo de produção)
  const calculateService = (service: ServiceItem) => {
    const productionCost = service.costs.reduce((sum, cost) => sum + cost.value, 0);
    return {
      productionCost,
      totalCost: productionCost,
    };
  };

  // Total geral
  const operationalCostsTotal = useMemo(() => {
    return operationalCosts.reduce((sum, cost) => sum + cost.value, 0);
  }, [operationalCosts]);

  const totals = useMemo(() => {
    // Custo de Produção = soma de todos os serviços
    const productionCost = services.reduce((sum, service) => {
      return sum + service.costs.reduce((s, cost) => s + cost.value, 0);
    }, 0);

    // Total dos Custos = Produção + Operacionais
    const totalCosts = productionCost + operationalCostsTotal;

    // Margem e NF
    const marginPct = formData.targetMargin;
    const nfPct = formData.nfCostPercentage;
    const divisor = 1 - (marginPct / 100) - (nfPct / 100);

    // Valor Total do Projeto
    const totalProjectValue = divisor > 0 ? totalCosts / divisor : totalCosts;
    const nfValue = totalProjectValue * (nfPct / 100);
    const marginValue = totalProjectValue - totalCosts - nfValue;

    return { productionCost, operationalCosts: operationalCostsTotal, totalCosts, totalProjectValue, nfValue, marginValue, marginPct };
  }, [services, operationalCostsTotal, formData.nfCostPercentage, formData.targetMargin]);

  // Adicionar serviço
  const addService = (serviceType: ServiceType) => {
    setServices([
      ...services,
      {
        id: uuidv4(),
        serviceType,
        objective: '',
        description: '',
        costs: [],
        fixedCostPercentage: 0, // kept for type compat, not used
        nfCostPercentage: 0, // kept for type compat, not used
        targetMargin: 0,
      },
    ]);
  };

  // Remover serviço
  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  // Reordenar serviço (mover para cima ou para baixo)
  const moveService = (id: string, direction: 'up' | 'down') => {
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  // Atualizar serviço
  const updateService = (id: string, updates: Partial<ServiceItem>) => {
    setServices(services.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  // Adicionar item de custo
  const addCostItem = (serviceId: string) => {
    setServices(services.map(s => {
      if (s.id === serviceId) {
        return {
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
        };
      }
      return s;
    }));
  };

  // Atualizar item de custo
  const updateCostItem = (serviceId: string, costId: string, updates: Partial<CostItem>) => {
    setServices(services.map(s => {
      if (s.id === serviceId) {
        return {
          ...s,
          costs: s.costs.map(c =>
            c.id === costId ? { ...c, ...updates } : c
          ),
        };
      }
      return s;
    }));
  };

  // Remover item de custo
  const removeCostItem = (serviceId: string, costId: string) => {
    setServices(services.map(s => {
      if (s.id === serviceId) {
        return {
          ...s,
          costs: s.costs.filter(c => c.id !== costId),
        };
      }
      return s;
    }));
  };

  const validateForm = (): Record<string, string> | null => {
    const newErrors: Record<string, string> = {};

    if (!formData.projectName.trim()) {
      newErrors.projectName = 'Nome do projeto é obrigatório';
    }

    if (!formData.clientId) {
      newErrors.clientId = 'Cliente é obrigatório';
    }

    if (services.length === 0) {
      newErrors.services = 'Adicione pelo menos um serviço';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 ? null : newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || submittingRef.current) {
      console.warn('[NewBudget] Submit bloqueado - já em andamento');
      return;
    }

    const validationErrors = validateForm();
    if (validationErrors) {
      const errorMessages = Object.values(validationErrors);
      toast.error('Preencha os campos obrigatórios', {
        description: errorMessages.join(', '),
      });
      const firstErrorKey = Object.keys(validationErrors)[0];
      const el = document.getElementById(firstErrorKey);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    // Timeout de segurança: se demorar mais de 30s, libera o botão
    const safetyTimeout = setTimeout(() => {
      console.error('[NewBudget] Timeout de segurança atingido (30s)');
      setIsSubmitting(false);
      submittingRef.current = false;
      toast.error('O salvamento demorou demais. Tente novamente.');
    }, 30000);

    try {

      // Step 1: Create budget
      const newBudget = await addBudget({
        proposalId: formData.proposalId.trim(),
        projectName: formData.projectName,
        projectDescription: formData.projectDescription,
        clientId: formData.clientId,
        contactId: formData.contactId,
        serviceType: services[0]?.serviceType || '',
        objective: services[0]?.objective as any || '',
        description: services.map(s => `[${s.serviceType}] ${s.description}`).join('\n\n'),
        paymentTerms: formData.paymentTerms,
        includesTax: formData.includesTax,
        includesLogistics: formData.includesLogistics,
        includesAccommodation: formData.includesAccommodation,
        includesMeals: formData.includesMeals,
        includesRawMaterial: formData.includesRawMaterial,
        includesTechnicalVisit: formData.includesTechnicalVisit,
        hasExecutionDate: formData.hasExecutionDate,
        executionStartDate: formData.executionStartDate,
        executionEndDate: formData.executionEndDate,
        location: formData.location,
        driveUrl: (formData as any).driveUrl || '',
        executionMonth: formData.hasExecutionDate && formData.executionStartDate ? format(formData.executionStartDate, 'yyyy-MM') : null,
        status: formData.status,
        rejectionReason: '',
        rejectionObservation: '',
        pdfReleased: false,
        hideNfInPdf: false,
        hideOperationalInPdf: false,
        hideNfObservationInPdf: false,
      });

      if (!newBudget) {
        console.error('[NewBudget] addBudget retornou null');
        clearTimeout(safetyTimeout);
        setIsSubmitting(false);
        submittingRef.current = false;
        toast.error('Erro ao salvar orçamento. Verifique sua conexão e tente novamente.');
        return;
      }


      // Step 2: Create budget version
      await addBudgetVersion(newBudget.id, {
        services: services.map(s => ({
          id: s.id,
          serviceType: s.serviceType,
          objective: s.objective,
          description: s.description,
          costs: s.costs,
          fixedCostPercentage: formData.fixedCostPercentage,
          nfCostPercentage: formData.nfCostPercentage,
          targetMargin: s.targetMargin,
        })),
        operationalCosts: operationalCosts,
        costs: [],
        productionCost: totals.productionCost,
        fixedCostPercentage: formData.fixedCostPercentage,
        nfCostPercentage: formData.nfCostPercentage,
        totalCost: totals.totalCosts,
        fullPrice: totals.totalProjectValue,
        discount4Price: totals.totalProjectValue * 0.96,
        discount5Price: totals.totalProjectValue * 0.95,
        margin: formData.targetMargin,
        reason: 'Versão inicial',
      });

      clearTimeout(safetyTimeout);
      toast.success('Orçamento criado com sucesso!');
      navigate('/crm');
    } catch (error: any) {
      console.error('[NewBudget] Erro no salvamento:', error);
      clearTimeout(safetyTimeout);
      toast.error('Erro ao salvar orçamento: ' + (error?.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  // Gerar PDF
  const generatePDF = () => {
    if (role === 'vendedor') {
      toast.error('Vendedores só podem baixar propostas aprovadas');
      return;
    }
    if (!selectedClient || services.length === 0) {
      toast.error('Preencha os dados do orçamento primeiro');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('HERO', 20, yPos);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Proposta Comercial', 20, yPos + 8);

    // Linha separadora
    yPos += 20;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);

    // Dados do projeto
    yPos += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Projeto', 20, yPos);
    
    yPos += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(formData.projectName || 'Nome do Projeto', 20, yPos);

    yPos += 12;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente', 20, yPos);
    
    yPos += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedClient.companyName, 20, yPos);

    // Serviços
    yPos += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Escopo do Serviço', 20, yPos);

    services.forEach((service, index) => {
      yPos += 10;
      const objectives = getObjectivesForCategory(service.serviceType);
      const objectiveLabel = objectives.find(o => o.value === service.objective)?.label || service.objective;
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${service.serviceType} - ${objectiveLabel}`, 20, yPos);
      
      if (service.description) {
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(service.description, pageWidth - 40);
        doc.text(lines, 20, yPos);
        yPos += lines.length * 5;
      }
    });

    // Observações
    yPos += 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', 20, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const observacoes = [
      '• Logística inclusa',
      '• Impostos inclusos',
      '• Nota Fiscal obrigatória',
      '',
      'O que não está incluso:',
      '• Itens não especificados nesta proposta',
    ];
    observacoes.forEach(obs => {
      doc.text(obs, 20, yPos);
      yPos += 5;
    });

    // Valor Final
    yPos += 10;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);

    yPos += 12;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Valor Final', 20, yPos);
    doc.text(formatCurrency(totals.totalProjectValue), pageWidth - 20, yPos, { align: 'right' });

    // Condição de Pagamento
    if (formData.paymentTerms) {
      yPos += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Condição de Pagamento: ${formData.paymentTerms}`, 20, yPos);
    }

    // Versão
    yPos += 15;
    doc.setFontSize(9);
    doc.setTextColor(128);
    doc.text(`Proposta V1 - ${new Date().toLocaleDateString('pt-BR')}`, 20, yPos);

    // Salvar
    doc.save(`proposta_${formData.projectName.replace(/\s+/g, '_') || 'orcamento'}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 40) return 'text-success';
    if (margin >= 25) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Novo Orçamento"
        subtitle="Crie uma nova proposta comercial"
      />

      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/crm')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* General Data */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="card-elevated">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-foreground/5">
                    <FileText className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <CardTitle>Dados do Orçamento</CardTitle>
                    <CardDescription>
                      Informações gerais do projeto
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status */}
                  <div className="space-y-2">
                    <Label htmlFor="status">Status do Orçamento</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value as CRMStatus })
                      }
                    >
                      <SelectTrigger>
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

                  {/* Client Search */}
                  <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <Popover open={clientOpen} onOpenChange={setClientOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={clientOpen}
                          className={cn(
                            "w-full justify-between",
                            errors.clientId && "border-destructive"
                          )}
                        >
                          {selectedClient
                            ? selectedClient.companyName
                            : "Buscar cliente..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Digite o nome do cliente..." 
                            value={clientSearch}
                            onValueChange={setClientSearch}
                          />
                          <CommandList>
                            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                            <CommandGroup>
                              {filteredClients.map((client) => (
                                <CommandItem
                                  key={client.id}
                                  value={client.companyName}
                                  onSelect={() => {
                                    setFormData({ ...formData, clientId: client.id, contactId: null });
                                    setClientOpen(false);
                                    setClientSearch('');
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.clientId === client.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{client.companyName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      Score: {client.score}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {errors.clientId && (
                      <p className="text-sm text-destructive">{errors.clientId}</p>
                    )}
                  </div>

                  {formData.clientId && (
                    <ContactSelect
                      clientId={formData.clientId}
                      value={formData.contactId}
                      onChange={(cid) => setFormData((f) => ({ ...f, contactId: cid }))}
                    />
                  )}

                  {/* Proposal ID */}
                  <div className="space-y-2">
                    <Label htmlFor="proposalId">Identificador da Proposta</Label>
                    <Input
                      id="proposalId"
                      value={formData.proposalId}
                      onChange={(e) =>
                        setFormData({ ...formData, proposalId: e.target.value })
                      }
                      placeholder="Ex: 900"
                    />
                    <p className="text-xs text-muted-foreground">Sugestão automática: {nextProposalId}</p>
                  </div>

                  {/* Project Name */}
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Nome do Projeto *</Label>
                    <Input
                      id="projectName"
                      placeholder="Ex: Vídeo Institucional 2024"
                      value={formData.projectName}
                      onChange={(e) =>
                        setFormData({ ...formData, projectName: e.target.value })
                      }
                      className={errors.projectName ? 'border-destructive' : ''}
                    />
                    {errors.projectName && (
                      <p className="text-sm text-destructive">
                        {errors.projectName}
                      </p>
                    )}
                  </div>

                  {/* Project Description */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="projectDescription">Briefing do Projeto</Label>
                    <Textarea
                      id="projectDescription"
                      placeholder="Descreva o projeto de forma geral..."
                      value={formData.projectDescription}
                      onChange={(e) =>
                        setFormData({ ...formData, projectDescription: e.target.value })
                      }
                      rows={3}
                    />
                  </div>

                  {/* Payment Terms */}
                  <div className="space-y-2">
                    <Label htmlFor="paymentTerms">Condição de Pagamento</Label>
                    {availablePaymentTerms.length > 0 ? (
                      <Select
                        value={formData.paymentTerms}
                        onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
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
                        id="paymentTerms"
                        placeholder="Ex: 50% entrada + 50% na entrega"
                        value={formData.paymentTerms}
                        onChange={(e) =>
                          setFormData({ ...formData, paymentTerms: e.target.value })
                        }
                      />
                    )}
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <Label htmlFor="location">Local</Label>
                    <Input
                      id="location"
                      placeholder="Ex: São Paulo - SP"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </div>

                  {/* Execution Date */}
                  <div className="space-y-2 md:col-span-2">
                    <Label>Data para Execução</Label>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="hasExecutionDate"
                          checked={formData.hasExecutionDate}
                          onCheckedChange={(checked) =>
                            setFormData({ 
                              ...formData, 
                              hasExecutionDate: checked === true,
                              executionStartDate: checked === true ? formData.executionStartDate : null,
                              executionEndDate: checked === true ? formData.executionEndDate : null
                            })
                          }
                        />
                        <Label htmlFor="hasExecutionDate" className="text-sm font-normal cursor-pointer">
                          Data definida
                        </Label>
                      </div>
                      {formData.hasExecutionDate ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-[150px] justify-start text-left font-normal",
                                  !formData.executionStartDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formData.executionStartDate ? (
                                  format(formData.executionStartDate, "dd/MM/yyyy")
                                ) : (
                                  <span>Início</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={formData.executionStartDate || undefined}
                                onSelect={(date) =>
                                  setFormData({ ...formData, executionStartDate: date || null })
                                }
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <span className="text-muted-foreground">até</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-[150px] justify-start text-left font-normal",
                                  !formData.executionEndDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formData.executionEndDate ? (
                                  format(formData.executionEndDate, "dd/MM/yyyy")
                                ) : (
                                  <span>Fim (opcional)</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={formData.executionEndDate || undefined}
                                onSelect={(date) =>
                                  setFormData({ ...formData, executionEndDate: date || null })
                                }
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">A definir</span>
                      )}
                    </div>
                  </div>

                   {/* Cost Configuration - Project Level */}
                  <div className="space-y-3 md:col-span-2">
                    <Label className="flex items-center gap-1 font-semibold">
                      <Calculator className="w-4 h-4" />
                      Configurações de Custo (gerais do projeto)
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Custo NF (%)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={formData.nfCostPercentage}
                            onChange={(e) =>
                              setFormData({ ...formData, nfCostPercentage: parseFloat(e.target.value) || 0 })
                            }
                            className="w-24"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Add Service Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="card-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-foreground/5">
                      <Plus className="w-6 h-6 text-foreground" />
                    </div>
                    <div>
                      <CardTitle>Adicionar Serviço</CardTitle>
                      <CardDescription>
                        Cada serviço tem sua própria planilha de custos
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {Array.from(new Map(serviceCategories.map(c => [c.key, c])).values()).sort((a, b) => a.order - b.order).map((category) => {
                    const Icon = SERVICE_ICONS[category.key] || Layers;
                    return (
                      <Button
                        key={category.key}
                        type="button"
                        variant="outline"
                        onClick={() => addService(category.key)}
                        className="flex items-center gap-2"
                      >
                        <Icon className="w-4 h-4" />
                        {category.label}
                      </Button>
                    );
                  })}
                </div>
                {errors.services && (
                  <p className="text-sm text-destructive mt-2">{errors.services}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Services List */}
          <AnimatePresence mode="popLayout">
            {services.map((service, index) => {
              const calc = calculateService(service);
              const Icon = SERVICE_ICONS[service.serviceType] || Layers;
              const objectives = getObjectivesForCategory(service.serviceType);

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Card className="card-elevated border-l-4 border-l-foreground">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-xl bg-foreground text-background">
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <span className="service-badge service-badge-cine">
                                {service.serviceType}
                              </span>
                              Planilha de Custos
                            </CardTitle>
                            <CardDescription>
                              Serviço #{index + 1}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveService(service.id, 'up')}
                            disabled={index === 0}
                            title="Mover para cima"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => moveService(service.id, 'down')}
                            disabled={index === services.length - 1}
                            title="Mover para baixo"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(service.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Objetivo e Descrição */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Objetivo</Label>
                          <Select
                            value={service.objective}
                            onValueChange={(value) =>
                              updateService(service.id, { objective: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o objetivo" />
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
                          <Label>Descrição do Serviço</Label>
                          <Textarea
                            placeholder="Descreva os detalhes deste serviço..."
                            value={service.description}
                            onChange={(e) =>
                              updateService(service.id, { description: e.target.value })
                            }
                            rows={4}
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
                              updateService(service.id, { 
                                deliveryType: value as DeliveryType,
                                deliveryDays: value === 'realtime' || value === 'data_especifica' ? undefined : (service.deliveryDays || 1),
                                deliveryDate: value === 'data_especifica' ? service.deliveryDate : undefined,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo de entrega" />
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
                                updateService(service.id, { deliveryDays: parseInt(e.target.value) || 1 })
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
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {service.deliveryDate
                                    ? format(new Date(service.deliveryDate + 'T12:00:00'), 'dd/MM/yyyy')
                                    : 'Selecionar data'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={service.deliveryDate ? new Date(service.deliveryDate + 'T12:00:00') : undefined}
                                  onSelect={(d) => d && updateService(service.id, { deliveryDate: format(d, 'yyyy-MM-dd') })}
                                  initialFocus
                                  className="p-3 pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>

                      {/* Costs Table */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Label className="flex items-center gap-2">
                            <Calculator className="w-4 h-4" />
                            Itens de Custo
                          </Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectorServiceId(service.id)}
                            >
                              <Layers className="w-4 h-4 mr-1" />
                              Catálogo
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addCostItem(service.id)}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Manual
                            </Button>
                          </div>
                        </div>

                        {service.costs.length > 0 ? (
                          <div className="rounded-lg border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="w-8"></TableHead>
                                  <TableHead className="w-[40%]">Descrição</TableHead>
                                  <TableHead className="w-[80px]">Qtd</TableHead>
                                  <TableHead>Valor Unit.</TableHead>
                                  <TableHead>Total</TableHead>
                                  <TableHead className="w-12"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <SortableTableBody
                                items={service.costs}
                                onReorder={(newCosts) =>
                                  setServices(services.map(s =>
                                    s.id === service.id ? { ...s, costs: newCosts } : s
                                  ))
                                }
                                renderRow={(cost, handle) => (
                                  <>
                                    <TableCell className="w-8">{handle}</TableCell>
                                    <TableCell>
                                      <Input
                                        value={cost.description}
                                        onChange={(e) =>
                                          updateCostItem(service.id, cost.id, { description: e.target.value })
                                        }
                                        placeholder="Ex: Direção, Equipamentos..."
                                        className="border-0 p-0 h-8 focus:ring-0"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={cost.quantity || 1}
                                        onChange={(e) => {
                                          const qty = parseInt(e.target.value) || 1;
                                          updateCostItem(service.id, cost.id, { quantity: qty, value: qty * (cost.unitValue || 0) });
                                        }}
                                        className="border-0 p-0 h-8 w-16 focus:ring-0"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        value={cost.unitValue || ''}
                                        onChange={(e) => {
                                          const uv = parseFloat(e.target.value) || 0;
                                          updateCostItem(service.id, cost.id, { unitValue: uv, value: (cost.quantity || 1) * uv });
                                        }}
                                        placeholder="0,00"
                                        className="border-0 p-0 h-8 w-28 focus:ring-0"
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
                                        size="icon"
                                        onClick={() => removeCostItem(service.id, cost.id)}
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </>
                                )}
                              />

                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground border rounded-lg">
                            Clique em "Adicionar" para incluir itens de custo
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Custo de Produção
                          </p>
                          <p className="font-semibold">
                            {formatCurrency(calc.productionCost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            Total
                          </p>
                          <p className="font-bold">
                            {formatCurrency(calc.totalCost)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Operational Costs */}
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
                      <CardDescription>
                        Custos gerais do projeto (logística, hospedagem, alimentação, etc.)
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setOpCostSelectorOpen(true)}
                    >
                      <Layers className="w-4 h-4 mr-1" />
                      Catálogo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setOperationalCosts([
                          ...operationalCosts,
                          {
                            id: uuidv4(),
                            description: '',
                            quantity: 1,
                            unitValue: 0,
                            value: 0,
                            paymentStatus: 'pendente' as PaymentStatus,
                            paymentDate: null,
                          },
                        ]);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Manual
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {operationalCosts.length > 0 ? (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-8"></TableHead>
                          <TableHead className="w-[40%]">Descrição</TableHead>
                          <TableHead className="w-[80px]">Qtd</TableHead>
                          <TableHead>Valor Unit.</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <SortableTableBody
                        items={operationalCosts}
                        onReorder={setOperationalCosts}
                        renderRow={(cost, handle) => (
                          <>
                            <TableCell className="w-8">{handle}</TableCell>
                            <TableCell>
                              <Input
                                value={cost.description}
                                onChange={(e) =>
                                  setOperationalCosts(operationalCosts.map(c =>
                                    c.id === cost.id ? { ...c, description: e.target.value } : c
                                  ))
                                }
                                placeholder="Ex: Passagens aéreas, Hotel..."
                                className="border-0 p-0 h-8 focus:ring-0"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={cost.quantity || 1}
                                onChange={(e) => {
                                  const qty = parseInt(e.target.value) || 1;
                                  setOperationalCosts(operationalCosts.map(c =>
                                    c.id === cost.id ? { ...c, quantity: qty, value: qty * (c.unitValue || 0) } : c
                                  ));
                                }}
                                className="border-0 p-0 h-8 w-16 focus:ring-0"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={cost.unitValue || ''}
                                onChange={(e) => {
                                  const uv = parseFloat(e.target.value) || 0;
                                  setOperationalCosts(operationalCosts.map(c =>
                                    c.id === cost.id ? { ...c, unitValue: uv, value: (c.quantity || 1) * uv } : c
                                  ));
                                }}
                                placeholder="0,00"
                                className="border-0 p-0 h-8 w-28 focus:ring-0"
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
                                size="icon"
                                onClick={() => setOperationalCosts(operationalCosts.filter(c => c.id !== cost.id))}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </>
                        )}
                        footer={
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={4} className="font-semibold">
                              Total Despesas Operacionais
                            </TableCell>
                            <TableCell className="font-bold">
                              {formatCurrency(operationalCostsTotal)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        }
                      />

                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg">
                    Clique em "Adicionar" para incluir despesas operacionais
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Grand Total - Composição do Investimento */}
          {services.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="card-elevated bg-foreground text-background">
                <CardContent className="py-6 space-y-4">
                  <h3 className="text-lg font-bold mb-4">Composição do Investimento</h3>
                  
                  {/* Custos breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-background/70">Custo de Produção</span>
                      <span className="font-semibold">{formatCurrency(totals.productionCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-background/70">Despesas Operacionais</span>
                      <span className="font-semibold">{formatCurrency(totals.operationalCosts)}</span>
                    </div>
                    <div className="flex justify-between border-t border-background/20 pt-2">
                      <span className="font-bold">Total dos Custos</span>
                      <span className="font-bold">{formatCurrency(totals.totalCosts)}</span>
                    </div>
                  </div>

                  {/* Margem Desejada input */}
                  <div className="flex items-center justify-between border-t border-background/20 pt-4">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-background/70" />
                      <span className="text-background/70">Margem Desejada</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={formData.targetMargin}
                        onChange={(e) =>
                          setFormData({ ...formData, targetMargin: parseFloat(e.target.value) || 0 })
                        }
                        className="w-20 bg-background/10 border-background/20 text-background text-right"
                      />
                      <span className="text-background/70">%</span>
                      <span className="ml-4 font-semibold">{formatCurrency(totals.marginValue)}</span>
                    </div>
                  </div>

                  {/* NF */}
                  <div className="flex justify-between">
                    <span className="text-background/70">NF ({formData.nfCostPercentage}%)</span>
                    <span className="font-semibold">{formatCurrency(totals.nfValue)}</span>
                  </div>

                  {/* Valor Total */}
                  <div className="flex justify-between border-t border-background/20 pt-4">
                    <span className="text-xl font-bold">Valor Total do Projeto</span>
                    <span className="text-3xl font-bold">{formatCurrency(totals.totalProjectValue)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/crm')}
            >
              Cancelar
            </Button>
            {(
              <Button
                type="button"
                variant="secondary"
                onClick={async (e) => {
                  e.preventDefault();
                  if (isSubmitting || submittingRef.current) return;
                  if (!formData.clientId || !formData.projectDescription.trim()) {
                    toast.error('Preencha o cliente e o briefing para salvar como rascunho');
                    return;
                  }
                  submittingRef.current = true;
                  setIsSubmitting(true);
                  try {
                    const newBudget = await addBudget({
                      proposalId: formData.proposalId.trim(),
                      projectName: formData.projectName || 'Rascunho',
                      projectDescription: formData.projectDescription,
                      clientId: formData.clientId,
                      contactId: formData.contactId,
                      serviceType: services[0]?.serviceType || '',
                      objective: services[0]?.objective as any || '',
                      description: services.map(s => `[${s.serviceType}] ${s.description}`).join('\n\n'),
                      paymentTerms: formData.paymentTerms,
                      includesTax: formData.includesTax,
                      includesLogistics: formData.includesLogistics,
                      includesAccommodation: formData.includesAccommodation,
                      includesMeals: formData.includesMeals,
                      includesRawMaterial: formData.includesRawMaterial,
                      includesTechnicalVisit: formData.includesTechnicalVisit,
                      hasExecutionDate: formData.hasExecutionDate,
                      executionStartDate: formData.executionStartDate,
                      executionEndDate: formData.executionEndDate,
                      location: formData.location,
                      driveUrl: (formData as any).driveUrl || '',
                      executionMonth: formData.hasExecutionDate && formData.executionStartDate ? format(formData.executionStartDate, 'yyyy-MM') : null,
                      status: formData.status,
                      rejectionReason: '',
                      rejectionObservation: '',
                      pdfReleased: false,
                      hideNfInPdf: false,
                      hideOperationalInPdf: false,
                      hideNfObservationInPdf: false,
                    });
                    if (!newBudget) {
                      toast.error('Erro ao salvar rascunho');
                      return;
                    }
                    if (services.length > 0) {
                      await addBudgetVersion(newBudget.id, {
                        services: services.map(s => ({
                          id: s.id,
                          serviceType: s.serviceType,
                          objective: s.objective,
                          description: s.description,
                          costs: s.costs,
                          fixedCostPercentage: formData.fixedCostPercentage,
                          nfCostPercentage: formData.nfCostPercentage,
                          targetMargin: s.targetMargin,
                        })),
                        operationalCosts: operationalCosts,
                        costs: [],
                        productionCost: totals.productionCost,
                        fixedCostPercentage: formData.fixedCostPercentage,
                        nfCostPercentage: formData.nfCostPercentage,
                        totalCost: totals.totalCosts,
                        fullPrice: totals.totalProjectValue,
                        discount4Price: totals.totalProjectValue * 0.96,
                        discount5Price: totals.totalProjectValue * 0.95,
                        margin: formData.targetMargin,
                        reason: 'Rascunho inicial',
                      });
                    }
                    toast.success('Rascunho salvo com sucesso!');
                    navigate('/crm');
                  } catch (error: any) {
                    toast.error('Erro ao salvar rascunho: ' + (error?.message || 'Erro desconhecido'));
                  } finally {
                    setIsSubmitting(false);
                    submittingRef.current = false;
                  }
                }}
                disabled={isSubmitting}
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Rascunho
              </Button>
            )}
            {role !== 'vendedor' && (
              <Button
                type="button"
                variant="outline"
                onClick={generatePDF}
                disabled={services.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Gerar PDF
              </Button>
            )}
            <Button type="submit" className="flex-1 btn-hero" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Salvando...' : 'Salvar Orçamento'}
            </Button>
          </div>
        </form>

        {/* Service Item Selector */}
        {selectorServiceId && (() => {
          const svc = services.find(s => s.id === selectorServiceId);
          if (!svc) return null;
          return (
            <ServiceItemSelector
              open={!!selectorServiceId}
              onOpenChange={(open) => { if (!open) setSelectorServiceId(null); }}
              categoryKey={svc.serviceType}
              onSelect={(item) => {
                setServices(services.map(s => {
                  if (s.id === selectorServiceId) {
                    return {
                      ...s,
                      costs: [
                        ...s.costs,
                        {
                          id: uuidv4(),
                          description: item.description,
                          quantity: 1,
                          unitValue: item.unitValue,
                          value: item.unitValue,
                          paymentStatus: 'pendente' as any,
                          paymentDate: null,
                        },
                      ],
                    };
                  }
                  return s;
                }));
                setSelectorServiceId(null);
              }}
            />
          );
        })()}

        {/* Operational Costs Selector */}
        <ServiceItemSelector
          open={opCostSelectorOpen}
          onOpenChange={setOpCostSelectorOpen}
          categoryKey="despesas_operacionais"
          onSelect={(item) => {
            setOperationalCosts([
              ...operationalCosts,
              {
                id: uuidv4(),
                description: item.description,
                quantity: 1,
                unitValue: item.unitValue,
                value: item.unitValue,
                paymentStatus: 'pendente' as PaymentStatus,
                paymentDate: null,
              },
            ]);
            setOpCostSelectorOpen(false);
          }}
        />
      </div>
    </div>
  );
}
