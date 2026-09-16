import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';

import { DollarSign, TrendingUp, TrendingDown, Plus, Pencil, Trash2, ExternalLink, Landmark, CalendarIcon, Settings, ArrowUpCircle, ArrowDownCircle, CircleDollarSign, Wallet, CreditCard as CreditCardIcon, Check, Clock, ArrowLeftRight, Repeat, ChevronDown, ChevronUp, Eye, FileCheck2, FileX2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

interface BudgetWithVersions {
  id: string;
  proposal_id: string;
  project_name: string;
  client_id: string;
  execution_month: string | null;
  final_value: number | null;
  approved_version: number | null;
  status: string;
  execution: any;
  nf_url: string | null;
}

interface FinancialAccount {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  bank: string;
  agency: string;
  account_number: string;
  is_active: boolean;
}

interface CashflowEntry {
  id: string;
  workspace_id: string;
  type: string;
  description: string;
  value: number;
  date: string;
  account_id: string | null;
  budget_id: string | null;
  revenue_center_id: string | null;
  cost_center_id: string | null;
  notes: string;
  is_future_payment: boolean;
  is_paid: boolean;
}

interface CenterItem {
  id: string;
  workspace_id: string;
  name: string;
  is_active: boolean;
}

interface CreditCard {
  id: string;
  workspace_id: string;
  account_id: string | null;
  name: string;
  last_digits: string;
  brand: string;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  is_active: boolean;
}

const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro'];

const ACCOUNT_TYPES = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'carteira_digital', label: 'Carteira Digital' },
  { value: 'outro', label: 'Outro' },
];

const currencyFmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function FinancialPage() {
  const { workspace } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, 'yyyy-MM'));
  
  const [budgets, setBudgets] = useState<BudgetWithVersions[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({});
  const [objectiveLabels, setObjectiveLabels] = useState<Record<string, Record<string, string>>>({});
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // Account form state
  const [accountDialog, setAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountForm, setAccountForm] = useState({ name: '', type: 'corrente', bank: '', agency: '', account_number: '' });

  // Cashflow state
  const [cashflowEntries, setCashflowEntries] = useState<CashflowEntry[]>([]);
  const [cashflowMonth, setCashflowMonth] = useState(format(now, 'yyyy-MM'));
  const [cashflowAccountFilter, setCashflowAccountFilter] = useState<string>('all');
  const [cashflowDialog, setCashflowDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashflowEntry | null>(null);
  const [entryForm, setEntryForm] = useState({
    type: 'receita' as 'receita' | 'despesa',
    description: '',
    value: '',
    date: new Date(),
    account_id: '',
    budget_id: '',
    revenue_center_id: '',
    cost_center_id: '',
    notes: '',
    is_future_payment: false,
    payment_due_date: null as Date | null,
    is_credit_card: false,
    credit_card_id: '',
    installment_value: '',
    installments: '1',
    is_recurring: false,
    recurring_end_month: '',
  });

  // Centers state
  const [revenueCenters, setRevenueCenters] = useState<CenterItem[]>([]);
  const [costCenters, setCostCenters] = useState<CenterItem[]>([]);
  const [newRevenueCenterName, setNewRevenueCenterName] = useState('');
  const [newCostCenterName, setNewCostCenterName] = useState('');

  // Credit cards state
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [cardDialog, setCardDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardForm, setCardForm] = useState({ name: '', last_digits: '', brand: 'Visa', credit_limit: '', closing_day: '1', due_day: '10', account_id: '' });
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentProject, setPaymentProject] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    value: '',
    date: new Date(),
    account_id: '',
    type: 'total' as 'total' | 'parcial',
    notes: '',
  });

  useEffect(() => {
    if (workspace?.id) loadData();
  }, [workspace?.id]);

  useRealtimeSync({
    workspaceId: workspace?.id,
    tables: [
      'cashflow_entries','financial_accounts','credit_cards',
      'cost_centers','revenue_centers','monthly_goals','budgets','budget_versions',
    ],
    onChange: () => { if (workspace?.id) loadData(); },
    debounceMs: 500,
  });


  async function loadData() {
    setLoading(true);
    const wid = workspace!.id;

    const [bRes, vRes, cRes, aRes, gRes, cfRes, rcRes, ccRes, crRes, scRes, soRes] = await Promise.all([
      supabase.from('budgets').select('*').eq('workspace_id', wid).in('status', ['aprovada', 'em_execucao', 'concluido']),
      supabase.from('budget_versions').select('*').eq('workspace_id', wid),
      supabase.from('clients').select('id, company_name').eq('workspace_id', wid),
      supabase.from('financial_accounts').select('*').eq('workspace_id', wid).order('name'),
      supabase.from('monthly_goals').select('*').eq('workspace_id', wid),
      supabase.from('cashflow_entries').select('*').eq('workspace_id', wid).order('date', { ascending: false }),
      supabase.from('revenue_centers').select('*').eq('workspace_id', wid).order('name'),
      supabase.from('cost_centers').select('*').eq('workspace_id', wid).order('name'),
      supabase.from('credit_cards').select('*').eq('workspace_id', wid).order('name'),
      supabase.from('service_categories').select('*').eq('workspace_id', wid),
      supabase.from('service_objectives').select('*').eq('workspace_id', wid),
    ]);

    if (bRes.data) setBudgets(bRes.data as any);
    if (vRes.data) setVersions(vRes.data);
    if (cRes.data) {
      const map: Record<string, string> = {};
      cRes.data.forEach((c: any) => { map[c.id] = c.company_name; });
      setClients(map);
    }
    if (aRes.data) setAccounts(aRes.data as any);
    if (gRes.data) {
      const gmap: Record<string, number> = {};
      gRes.data.forEach((g: any) => { gmap[g.month] = Number(g.value); });
      setGoals(gmap);
    }
    if (cfRes.data) setCashflowEntries(cfRes.data as any);
    if (rcRes.data) setRevenueCenters(rcRes.data as any);
    if (ccRes.data) setCostCenters(ccRes.data as any);
    if (crRes.data) setCreditCards(crRes.data as any);
    if (scRes.data) {
      const catMap: Record<string, string> = {};
      scRes.data.forEach((c: any) => { catMap[c.key] = c.label; });
      setCategoryLabels(catMap);
    }
    if (soRes.data) {
      const objMap: Record<string, Record<string, string>> = {};
      soRes.data.forEach((o: any) => {
        if (!objMap[o.category_key]) objMap[o.category_key] = {};
        objMap[o.category_key][o.key] = o.label;
      });
      setObjectiveLabels(objMap);
    }
    setLoading(false);
  }

  // ======== Credit Card CRUD ========
  function openNewCard() { setEditingCard(null); setCardForm({ name: '', last_digits: '', brand: 'Visa', credit_limit: '', closing_day: '1', due_day: '10', account_id: '' }); setCardDialog(true); }
  function openEditCard(card: CreditCard) { setEditingCard(card); setCardForm({ name: card.name, last_digits: card.last_digits, brand: card.brand, credit_limit: String(card.credit_limit), closing_day: String(card.closing_day), due_day: String(card.due_day), account_id: card.account_id || '' }); setCardDialog(true); }
  async function saveCard() {
    if (!workspace?.id || !cardForm.name) return;
    const payload = { workspace_id: workspace.id, name: cardForm.name, last_digits: cardForm.last_digits, brand: cardForm.brand, credit_limit: Number(cardForm.credit_limit) || 0, closing_day: Number(cardForm.closing_day) || 1, due_day: Number(cardForm.due_day) || 10, account_id: cardForm.account_id || null };
    if (editingCard) {
      const { error } = await supabase.from('credit_cards').update(payload).eq('id', editingCard.id);
      if (error) { toast.error('Erro ao atualizar cartão'); return; }
      toast.success('Cartão atualizado');
    } else {
      const { error } = await supabase.from('credit_cards').insert(payload);
      if (error) { toast.error('Erro ao criar cartão'); return; }
      toast.success('Cartão cadastrado');
    }
    setCardDialog(false);
    loadData();
  }
  async function deleteCard(id: string) {
    if (!confirm('Excluir este cartão?')) return;
    await supabase.from('credit_cards').delete().eq('id', id);
    toast.success('Cartão excluído');
    loadData();
  }
  async function toggleCard(id: string, currentActive: boolean) {
    await supabase.from('credit_cards').update({ is_active: !currentActive }).eq('id', id);
    loadData();
  }

  // ======== Helper: get payment status for a project ========
  function getProjectPaymentInfo(projectId: string, projectValue: number) {
    const payments = cashflowEntries.filter(
      e => e.type === 'receita' && e.budget_id === projectId
    );
    const totalPaid = payments.reduce((s, e) => s + Number(e.value), 0);
    
    if (totalPaid <= 0) return { status: 'nao_pago' as const, totalPaid, remaining: projectValue };
    if (totalPaid >= projectValue * 0.99) return { status: 'pago' as const, totalPaid, remaining: 0 };
    return { status: 'parcial' as const, totalPaid, remaining: projectValue - totalPaid };
  }

  // ======== Monthly projects (existing logic) ========
  const monthlyProjects = useMemo(() => {
    return budgets
      .filter(b => b.execution_month === selectedMonth)
      .map(b => {
        const approvedVer = b.approved_version != null
          ? versions.find(v => v.budget_id === b.id && v.version === b.approved_version)
          : versions.filter(v => v.budget_id === b.id).sort((a, c) => c.version - a.version)[0];

        const services: any[] = approvedVer?.services || [];
        const executionData = b.execution as any;
        const executionServices: any[] = executionData?.services || [];
        const nfCost = Number(executionData?.nfTaxValue ?? executionData?.nfCost ?? 0);

        let totalValue = 0;
        let totalRealCost = 0;
        const serviceDetails = services.map((s: any, idx: number) => {
          const costSum = (s.costs || []).reduce((sum: number, c: any) => sum + Number(c.value || 0), 0);
          const nfPct = Number(s.nfCostPercentage || 0) / 100;
          const marginPct = Number(s.targetMargin || 0) / 100;
          const divisor = 1 - marginPct - nfPct;
          const sValue = divisor > 0 ? costSum / divisor : costSum;

          const execService = executionServices.find((es: any) => es.id === s.id);
          const sRealCost = execService ? Number(execService.realTotal || 0) : 0;

          totalValue += sValue;
          totalRealCost += sRealCost;
          return {
            id: s.id || `svc-${idx}`,
            name: (objectiveLabels[s.serviceType]?.[s.objective] || s.objective || s.description?.substring(0, 40) || 'Serviço'),
            categoryLabel: categoryLabels[s.serviceType] || s.serviceType || '',
            value: sValue,
            realCost: sRealCost,
            margin: sValue - sRealCost,
            marginPercent: sValue > 0 ? ((sValue - sRealCost) / sValue) * 100 : 0,
          };
        });

        const finalValue = b.final_value || totalValue;
        const margin = finalValue - totalRealCost - nfCost;

        return {
          id: b.id,
          proposalId: b.proposal_id,
          projectName: b.project_name,
          clientName: clients[b.client_id] || '—',
          services: serviceDetails,
          totalValue: finalValue,
          totalRealCost,
          nfCost,
          margin,
          marginPercent: finalValue > 0 ? (margin / finalValue) * 100 : 0,
          status: b.status,
          nfUrl: b.nf_url,
        };
      })
      .sort((a, c) => {
        const na = parseInt(String(a.proposalId || '').replace(/\D/g, ''), 10);
        const nb = parseInt(String(c.proposalId || '').replace(/\D/g, ''), 10);
        if (isNaN(na) && isNaN(nb)) return String(a.proposalId || '').localeCompare(String(c.proposalId || ''));
        if (isNaN(na)) return 1;
        if (isNaN(nb)) return -1;
        return na - nb;
      });
  }, [budgets, versions, clients, selectedMonth, categoryLabels, objectiveLabels]);

  // Transfer state
  const [transferDialog, setTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({ from_account_id: '', to_account_id: '', value: '', date: new Date(), description: '' });

  // ======== Cashflow logic ========
  const filteredCashflow = useMemo(() => {
    return cashflowEntries.filter(e => {
      const entryMonth = e.date?.substring(0, 7);
      if (entryMonth !== cashflowMonth) return false;
      if (cashflowAccountFilter !== 'all' && e.account_id !== cashflowAccountFilter) return false;
      return true;
    });
  }, [cashflowEntries, cashflowMonth, cashflowAccountFilter]);

  const cashflowSummary = useMemo(() => {
    const totalReceitas = filteredCashflow.filter(e => e.type === 'receita').reduce((s, e) => s + Number(e.value), 0);
    const despesasEfetivadas = filteredCashflow.filter(e => e.type === 'despesa' && (!e.is_future_payment || e.is_paid)).reduce((s, e) => s + Number(e.value), 0);
    const despesasProgramadas = filteredCashflow.filter(e => e.type === 'despesa' && e.is_future_payment && !e.is_paid).reduce((s, e) => s + Number(e.value), 0);
    return { totalReceitas, totalDespesas: despesasEfetivadas, despesasProgramadas, saldo: totalReceitas - despesasEfetivadas };
  }, [filteredCashflow]);

  // ======== Painel Financeiro data ========
  const painelData = useMemo(() => {
    // Account balances: sum all cashflow entries per account
    const accountBalances = accounts.filter(a => a.is_active).map(acc => {
      const entries = cashflowEntries.filter(e => e.account_id === acc.id && !((e as any).is_future_payment && !(e as any).is_paid));
      const receitas = entries.filter(e => e.type === 'receita').reduce((s, e) => s + Number(e.value), 0);
      const despesas = entries.filter(e => e.type === 'despesa').reduce((s, e) => s + Number(e.value), 0);
      return { ...acc, saldo: receitas - despesas };
    });

    // Receivables by month: approved budgets - payments received
    const receivablesByMonth: { month: string; label: string; totalValue: number; totalPaid: number; remaining: number }[] = [];
    const monthsSet = new Set<string>();
    budgets.forEach(b => { if (b.execution_month) monthsSet.add(b.execution_month); });
    const sortedMonths = Array.from(monthsSet).sort();

    sortedMonths.forEach(m => {
      const monthBudgets = budgets.filter(b => b.execution_month === m);
      let totalValue = 0;
      let totalPaid = 0;

      monthBudgets.forEach(b => {
        const approvedVer = b.approved_version != null
          ? versions.find(v => v.budget_id === b.id && v.version === b.approved_version)
          : versions.filter(v => v.budget_id === b.id).sort((a, c) => c.version - a.version)[0];
        const fv = b.final_value || Number(approvedVer?.full_price || 0);
        totalValue += fv;
        const payments = cashflowEntries.filter(e => e.type === 'receita' && e.budget_id === b.id);
        totalPaid += payments.reduce((s, e) => s + Number(e.value), 0);
      });

      receivablesByMonth.push({
        month: m,
        label: format(new Date(m + '-01T12:00:00'), 'MMM/yy', { locale: ptBR }),
        totalValue,
        totalPaid,
        remaining: totalValue - totalPaid,
      });
    });

    // Project costs by month (budgeted cost, replaced by the real value when informed)
    const projectCostByMonth = new Map<string, number>();
    const costOf = (c: any) => {
      const real = Number(c?.realValue ?? 0);
      if (real > 0) return real;
      const budgeted = Number(c?.budgetedValue ?? c?.value ?? 0);
      return isNaN(budgeted) ? 0 : budgeted;
    };
    budgets.forEach(b => {
      const month = b.execution_month;
      if (!month) return;
      const exec = b.execution as any;
      let cost = 0;
      if (exec) {
        (exec.services || []).forEach((s: any) => {
          (s.costs || []).forEach((c: any) => { cost += costOf(c); });
          (s.extraCosts || []).forEach((c: any) => { cost += costOf(c); });
        });
        (exec.operationalCosts || []).forEach((c: any) => { cost += costOf(c); });
        (exec.extraOperationalCosts || []).forEach((c: any) => { cost += costOf(c); });
      } else {
        const ver = b.approved_version != null
          ? versions.find(v => v.budget_id === b.id && v.version === b.approved_version)
          : versions.filter(v => v.budget_id === b.id).sort((a, c) => c.version - a.version)[0];
        ((ver?.services as any[]) || []).forEach((s: any) => {
          (s.costs || []).forEach((c: any) => { cost += Number(c?.value || 0); });
        });
        ((ver?.operational_costs as any[]) || []).forEach((c: any) => { cost += Number(c?.value || 0); });
      }
      if (cost > 0) projectCostByMonth.set(month, (projectCostByMonth.get(month) || 0) + cost);
    });

    // Future expenses by month (pending payments) + project costs
    const futureExpensesByMonth: { month: string; label: string; totalValue: number; totalPaid: number; pending: number }[] = [];
    const futureExpenses = cashflowEntries.filter(e => e.type === 'despesa' && !(e as any).is_paid);
    const expMonthsSet = new Set<string>();
    futureExpenses.forEach(e => {
      const dueDate = (e as any).payment_due_date || e.date;
      if (dueDate) expMonthsSet.add(dueDate.substring(0, 7));
    });
    projectCostByMonth.forEach((_v, m) => expMonthsSet.add(m));
    Array.from(expMonthsSet).sort().forEach(m => {
      const monthEntries = futureExpenses.filter(e => ((e as any).payment_due_date || e.date)?.substring(0, 7) === m);
      const total = monthEntries.reduce((s, e) => s + Number(e.value), 0) + (projectCostByMonth.get(m) || 0);
      futureExpensesByMonth.push({
        month: m,
        label: format(new Date(m + '-01T12:00:00'), 'MMM/yy', { locale: ptBR }),
        totalValue: total,
        totalPaid: 0,
        pending: total,
      });
    });
    const totalDespesasPrevistas = futureExpensesByMonth.reduce((s, r) => s + r.pending, 0);

    const totalSaldo = accountBalances.reduce((s, a) => s + a.saldo, 0);
    const totalRecebiveis = receivablesByMonth.reduce((s, r) => s + Math.max(0, r.remaining), 0);

    return { accountBalances, receivablesByMonth, totalSaldo, totalRecebiveis, futureExpensesByMonth, totalDespesasPrevistas };
  }, [accounts, cashflowEntries, budgets, versions]);

  // Invoice payment state
  const [invoicePayDialog, setInvoicePayDialog] = useState(false);
  const [invoicePayTarget, setInvoicePayTarget] = useState<{ cardId: string; month: string; entries: CashflowEntry[]; total: number } | null>(null);
  const [invoicePayForm, setInvoicePayForm] = useState({ account_id: '', date: new Date() });
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Credit card invoices for Painel
  const cardInvoices = useMemo(() => {
    const cardEntries = cashflowEntries.filter(e => e.type === 'despesa' && (e as any).credit_card_id);
    const grouped: Record<string, Record<string, { entries: CashflowEntry[]; total: number; paid: number; pending: number }>> = {};
    
    cardEntries.forEach(e => {
      const cardId = (e as any).credit_card_id as string;
      const dueDate = (e as any).payment_due_date || e.date;
      const month = dueDate?.substring(0, 7) || 'sem-data';
      
      if (!grouped[cardId]) grouped[cardId] = {};
      if (!grouped[cardId][month]) grouped[cardId][month] = { entries: [], total: 0, paid: 0, pending: 0 };
      
      grouped[cardId][month].entries.push(e);
      const val = Number(e.value);
      grouped[cardId][month].total += val;
      if ((e as any).is_paid) {
        grouped[cardId][month].paid += val;
      } else {
        grouped[cardId][month].pending += val;
      }
    });
    
    return grouped;
  }, [cashflowEntries]);

  async function payCardInvoice() {
    if (!invoicePayTarget || !workspace) return;
    if (!invoicePayForm.account_id) { toast.error('Selecione uma conta financeira'); return; }
    
    const pendingEntries = invoicePayTarget.entries.filter(e => !(e as any).is_paid);
    if (pendingEntries.length === 0) { toast.error('Nenhuma parcela pendente'); return; }
    
    const ids = pendingEntries.map(e => e.id);
    const { error } = await supabase
      .from('cashflow_entries')
      .update({ is_paid: true, paid_at: new Date().toISOString(), account_id: invoicePayForm.account_id })
      .in('id', ids);
    
    if (error) { toast.error('Erro ao pagar fatura'); return; }
    toast.success(`Fatura paga! ${pendingEntries.length} item(ns) confirmado(s)`);
    setInvoicePayDialog(false);
    setInvoicePayTarget(null);
    loadData();
  }

  const defaultEntryForm = { type: 'receita' as 'receita' | 'despesa', description: '', value: '', date: new Date(), account_id: '', budget_id: '', revenue_center_id: '', cost_center_id: '', notes: '', is_future_payment: false, payment_due_date: null as Date | null, is_credit_card: false, credit_card_id: '', installment_value: '', installments: '1', is_recurring: false, recurring_end_month: '' };

  function openNewEntry(tipo: 'receita' | 'despesa' = 'receita') {
    setEditingEntry(null);
    setEntryForm({ ...defaultEntryForm, type: tipo });
    setCashflowDialog(true);
  }

  function openEditEntry(e: CashflowEntry) {
    setEditingEntry(e);
    const entry = e as any;
    setEntryForm({
      ...defaultEntryForm,
      type: e.type as any,
      description: e.description,
      value: String(e.value),
      date: new Date(e.date + 'T12:00:00'),
      account_id: e.account_id || '',
      budget_id: e.budget_id || '',
      revenue_center_id: e.revenue_center_id || '',
      cost_center_id: e.cost_center_id || '',
      notes: e.notes,
      is_future_payment: entry.is_future_payment || false,
      payment_due_date: entry.payment_due_date ? new Date(entry.payment_due_date + 'T12:00:00') : null,
    });
    setCashflowDialog(true);
  }

  async function saveEntry() {
    const wid = workspace!.id;
    if (!entryForm.description.trim()) { toast.error('Descrição é obrigatória'); return; }

    // Credit card: create multiple installment entries
    if (entryForm.is_credit_card && entryForm.type === 'despesa') {
      const parcVal = Number(entryForm.installment_value);
      const parcQty = Number(entryForm.installments) || 1;
      if (parcVal <= 0) { toast.error('Valor da parcela deve ser maior que zero'); return; }

      const selectedCard = creditCards.find(c => c.id === entryForm.credit_card_id);
      const entries = [];
      for (let i = 0; i < parcQty; i++) {
        const dueDate = new Date(entryForm.date);
        dueDate.setMonth(dueDate.getMonth() + i);
        entries.push({
          workspace_id: wid,
          type: 'despesa',
          description: `${entryForm.description} (${i + 1}/${parcQty})`,
          value: parcVal,
          date: format(dueDate, 'yyyy-MM-dd'),
          account_id: selectedCard?.account_id || entryForm.account_id || null,
          budget_id: null,
          revenue_center_id: null,
          cost_center_id: entryForm.cost_center_id || null,
          notes: entryForm.notes ? `${entryForm.notes} | Cartão: ${selectedCard?.name || ''}` : `Cartão: ${selectedCard?.name || ''}`,
          is_future_payment: true,
          payment_due_date: format(dueDate, 'yyyy-MM-dd'),
          is_paid: false,
          paid_at: null,
          credit_card_id: entryForm.credit_card_id || null,
        });
      }
      const { error } = await supabase.from('cashflow_entries').insert(entries);
      if (error) { toast.error('Erro ao criar parcelas'); return; }
      toast.success(`${parcQty} parcela(s) criada(s)`);
      setCashflowDialog(false);
      loadData();
      return;
    }

    // Recurring expense: create one entry per month from start to end
    if (entryForm.is_recurring && entryForm.type === 'despesa' && !entryForm.is_credit_card) {
      const val = Number(entryForm.value);
      if (!val || val <= 0) { toast.error('Valor deve ser maior que zero'); return; }
      if (!entryForm.recurring_end_month) { toast.error('Selecione o mês de término'); return; }

      const startDate = new Date(entryForm.date);
      const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const [endY, endM] = entryForm.recurring_end_month.split('-').map(Number);
      const endMonth = new Date(endY, endM - 1, 1);

      if (endMonth < startMonth) { toast.error('Mês de término deve ser igual ou posterior ao mês de início'); return; }

      const entries: any[] = [];
      const current = new Date(startMonth);

      while (current <= endMonth) {
        const dayInMonth = Math.min(startDate.getDate(), new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate());
        const entryDate = new Date(current.getFullYear(), current.getMonth(), dayInMonth);
        const dueDate = entryForm.payment_due_date
          ? new Date(current.getFullYear(), current.getMonth(), Math.min(entryForm.payment_due_date.getDate(), new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()))
          : entryDate;

        entries.push({
          workspace_id: wid,
          type: 'despesa',
          description: entryForm.description,
          value: val,
          date: format(entryDate, 'yyyy-MM-dd'),
          account_id: entryForm.account_id || null,
          budget_id: null,
          revenue_center_id: null,
          cost_center_id: entryForm.cost_center_id || null,
          notes: [entryForm.notes, 'Despesa contínua'].filter(Boolean).join(' | '),
          is_future_payment: true,
          payment_due_date: format(dueDate, 'yyyy-MM-dd'),
          is_paid: false,
          paid_at: null,
        });
        current.setMonth(current.getMonth() + 1);
      }

      const { error } = await supabase.from('cashflow_entries').insert(entries);
      if (error) { toast.error('Erro ao criar despesas contínuas'); return; }
      toast.success(`${entries.length} lançamento(s) contínuo(s) criado(s)`);
      setCashflowDialog(false);
      loadData();
      return;
    }

    if (!entryForm.value || Number(entryForm.value) <= 0) { toast.error('Valor deve ser maior que zero'); return; }

    const data: any = {
      workspace_id: wid,
      type: entryForm.type,
      description: entryForm.description,
      value: Number(entryForm.value),
      date: format(entryForm.date, 'yyyy-MM-dd'),
      account_id: entryForm.account_id || null,
      budget_id: entryForm.budget_id || null,
      revenue_center_id: entryForm.type === 'receita' ? (entryForm.revenue_center_id || null) : null,
      cost_center_id: entryForm.type === 'despesa' ? (entryForm.cost_center_id || null) : null,
      notes: entryForm.notes,
      is_future_payment: entryForm.is_future_payment,
      payment_due_date: entryForm.is_future_payment && entryForm.payment_due_date ? format(entryForm.payment_due_date, 'yyyy-MM-dd') : null,
      is_paid: entryForm.is_future_payment ? false : true,
      paid_at: entryForm.is_future_payment ? null : new Date().toISOString(),
    };

    if (editingEntry) {
      const { error } = await supabase.from('cashflow_entries').update(data).eq('id', editingEntry.id);
      if (error) { toast.error('Erro ao atualizar lançamento'); return; }
      toast.success('Lançamento atualizado');
    } else {
      const { error } = await supabase.from('cashflow_entries').insert(data);
      if (error) { toast.error('Erro ao criar lançamento'); return; }
      toast.success('Lançamento criado');
    }
    setCashflowDialog(false);
    loadData();
  }

  async function markEntryAsPaid(id: string) {
    await supabase.from('cashflow_entries').update({ is_paid: true, paid_at: new Date().toISOString() }).eq('id', id);
    toast.success('Pagamento confirmado');
    loadData();
  }

  async function deleteEntry(id: string) {
    if (!confirm('Excluir este lançamento?')) return;
    await supabase.from('cashflow_entries').delete().eq('id', id);
    toast.success('Lançamento excluído');
    loadData();
  }

  // ======== Payment dialog ========
  function openPaymentDialog(project: any) {
    setPaymentProject(project);
    const paymentInfo = getProjectPaymentInfo(project.id, project.totalValue);
    setPaymentForm({
      value: paymentInfo.remaining > 0 ? String(paymentInfo.remaining.toFixed(2)) : String(project.totalValue.toFixed(2)),
      date: new Date(),
      account_id: '',
      type: 'total',
      notes: '',
    });
    setPaymentDialog(true);
  }

  async function savePayment() {
    if (!paymentProject || !workspace) return;
    const val = Number(paymentForm.value);
    if (!val || val <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    if (!paymentForm.account_id) { toast.error('Selecione uma conta financeira'); return; }

    const { error } = await supabase.from('cashflow_entries').insert({
      workspace_id: workspace.id,
      type: 'receita',
      description: `Pgto ${paymentForm.type === 'total' ? 'total' : 'parcial'} - ${paymentProject.proposalId} - ${paymentProject.projectName}`,
      value: val,
      date: format(paymentForm.date, 'yyyy-MM-dd'),
      account_id: paymentForm.account_id,
      budget_id: paymentProject.id,
      notes: paymentForm.notes,
    });

    if (error) { toast.error('Erro ao registrar pagamento'); return; }
    toast.success('Pagamento registrado no fluxo de caixa');
    setPaymentDialog(false);
    loadData();
  }

  // ======== Account CRUD (existing) ========
  async function saveAccount() {
    const wid = workspace!.id;
    if (!accountForm.name.trim()) { toast.error('Nome da conta é obrigatório'); return; }

    if (editingAccount) {
      const { error } = await supabase.from('financial_accounts').update({
        name: accountForm.name, type: accountForm.type, bank: accountForm.bank,
        agency: accountForm.agency, account_number: accountForm.account_number,
      }).eq('id', editingAccount.id);
      if (error) { toast.error('Erro ao atualizar conta'); return; }
      toast.success('Conta atualizada');
    } else {
      const { error } = await supabase.from('financial_accounts').insert({
        workspace_id: wid, name: accountForm.name, type: accountForm.type,
        bank: accountForm.bank, agency: accountForm.agency, account_number: accountForm.account_number,
      });
      if (error) { toast.error('Erro ao criar conta'); return; }
      toast.success('Conta criada');
    }
    setAccountDialog(false);
    setEditingAccount(null);
    setAccountForm({ name: '', type: 'corrente', bank: '', agency: '', account_number: '' });
    loadData();
  }

  async function deleteAccount(id: string) {
    if (!confirm('Excluir esta conta?')) return;
    await supabase.from('financial_accounts').delete().eq('id', id);
    toast.success('Conta excluída');
    loadData();
  }

  function openEditAccount(acc: FinancialAccount) {
    setEditingAccount(acc);
    setAccountForm({ name: acc.name, type: acc.type, bank: acc.bank, agency: acc.agency, account_number: acc.account_number });
    setAccountDialog(true);
  }

  function openNewAccount() {
    setEditingAccount(null);
    setAccountForm({ name: '', type: 'corrente', bank: '', agency: '', account_number: '' });
    setAccountDialog(true);
  }

  // ======== Centers CRUD ========
  async function addRevenueCenter() {
    if (!newRevenueCenterName.trim()) return;
    console.log('addRevenueCenter called, workspace:', workspace?.id, 'name:', newRevenueCenterName.trim());
    const { error } = await supabase.from('revenue_centers').insert({ workspace_id: workspace!.id, name: newRevenueCenterName.trim() });
    if (error) { console.error('Erro revenue_center insert:', error); toast.error('Erro ao criar centro de receita: ' + error.message); return; }
    toast.success('Centro de receita criado');
    setNewRevenueCenterName('');
    loadData();
  }

  async function toggleRevenueCenter(id: string, is_active: boolean) {
    await supabase.from('revenue_centers').update({ is_active: !is_active }).eq('id', id);
    loadData();
  }

  async function deleteRevenueCenter(id: string) {
    if (!confirm('Excluir este centro de receita?')) return;
    await supabase.from('revenue_centers').delete().eq('id', id);
    toast.success('Centro excluído');
    loadData();
  }

  async function addCostCenter() {
    if (!newCostCenterName.trim()) return;
    console.log('addCostCenter called, workspace:', workspace?.id, 'name:', newCostCenterName.trim());
    const { error } = await supabase.from('cost_centers').insert({ workspace_id: workspace!.id, name: newCostCenterName.trim() });
    if (error) { console.error('Erro cost_center insert:', error); toast.error('Erro ao criar centro de custo: ' + error.message); return; }
    toast.success('Centro de custo criado');
    setNewCostCenterName('');
    loadData();
  }

  async function toggleCostCenter(id: string, is_active: boolean) {
    await supabase.from('cost_centers').update({ is_active: !is_active }).eq('id', id);
    loadData();
  }

  async function deleteCostCenter(id: string) {
    if (!confirm('Excluir este centro de custo?')) return;
    await supabase.from('cost_centers').delete().eq('id', id);
    toast.success('Centro excluído');
    loadData();
  }

  // Month options
  const monthOptions = useMemo(() => {
    const months: string[] = [];
    for (let i = -6; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(format(d, 'yyyy-MM'));
    }
    return months;
  }, []);

  async function saveTransfer() {
    const wid = workspace!.id;
    if (!transferForm.from_account_id || !transferForm.to_account_id) { toast.error('Selecione as contas'); return; }
    if (transferForm.from_account_id === transferForm.to_account_id) { toast.error('Contas devem ser diferentes'); return; }
    const val = Number(transferForm.value);
    if (!val || val <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    
    // Check balance
    const fromAcc = painelData.accountBalances.find(a => a.id === transferForm.from_account_id);
    if (fromAcc && val > fromAcc.saldo) {
      toast.error(`Saldo insuficiente. Disponível: ${currencyFmt(fromAcc.saldo)}`);
      return;
    }

    const dateStr = format(transferForm.date, 'yyyy-MM-dd');
    const desc = transferForm.description.trim() || 'Transferência entre contas';
    const fromName = accounts.find(a => a.id === transferForm.from_account_id)?.name || '';
    const toName = accounts.find(a => a.id === transferForm.to_account_id)?.name || '';

    const { error } = await supabase.from('cashflow_entries').insert([
      { workspace_id: wid, type: 'despesa', description: `${desc} → ${toName}`, value: val, date: dateStr, account_id: transferForm.from_account_id, notes: 'Transferência entre contas' },
      { workspace_id: wid, type: 'receita', description: `${desc} ← ${fromName}`, value: val, date: dateStr, account_id: transferForm.to_account_id, notes: 'Transferência entre contas' },
    ]);
    if (error) { toast.error('Erro ao transferir'); return; }
    toast.success('Transferência realizada!');
    setTransferDialog(false);
    setTransferForm({ from_account_id: '', to_account_id: '', value: '', date: new Date(), description: '' });
    loadData();
  }



  // Helper: get name lookups
  const accountName = (id: string | null) => accounts.find(a => a.id === id)?.name || '—';
  const budgetLabel = (id: string | null) => {
    if (!id) return null;
    const b = budgets.find(b => b.id === id);
    return b ? `${b.proposal_id} - ${b.project_name}` : null;
  };
  const revenueCenterName = (id: string | null) => revenueCenters.find(r => r.id === id)?.name || null;
  const costCenterName = (id: string | null) => costCenters.find(c => c.id === id)?.name || null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <Header title="Financeiro" subtitle="Gestão financeira" />
      <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6 w-full">

      <Tabs defaultValue={searchParams.get('tab') || 'painel'}>
        <TabsList className="grid grid-cols-2 sm:inline-flex sm:w-auto w-full gap-1 h-auto">
          <TabsTrigger value="painel" className="text-xs sm:text-sm whitespace-nowrap">Painel Financeiro</TabsTrigger>
          <TabsTrigger value="fluxo" className="text-xs sm:text-sm whitespace-nowrap">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="projetos" className="text-xs sm:text-sm whitespace-nowrap">Projetos/Mês</TabsTrigger>
          
          <TabsTrigger value="config" className="text-xs sm:text-sm whitespace-nowrap">Configurações</TabsTrigger>
        </TabsList>

        {/* ===================== FLUXO DE CAIXA ===================== */}
        <TabsContent value="fluxo" className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap text-sm">Mês</Label>
                <Select value={cashflowMonth} onValueChange={setCashflowMonth}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={m} value={m}>{format(new Date(m + '-01T12:00:00'), 'MMMM yyyy', { locale: ptBR })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap text-sm">Conta</Label>
                <Select value={cashflowAccountFilter} onValueChange={setCashflowAccountFilter}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as contas</SelectItem>
                    {accounts.filter(a => a.is_active).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => openNewEntry('receita')} size="sm" className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white">
                <ArrowUpCircle className="w-4 h-4 mr-1" /> + Receita
              </Button>
              <Button onClick={() => openNewEntry('despesa')} size="sm" className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white">
                <ArrowDownCircle className="w-4 h-4 mr-1" /> - Despesa
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><ArrowUpCircle className="w-4 h-4 text-green-600" /> Receitas</div>
                <p className="text-xl font-bold text-green-600">{currencyFmt(cashflowSummary.totalReceitas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><ArrowDownCircle className="w-4 h-4 text-destructive" /> Despesas</div>
                <p className="text-xl font-bold text-destructive">{currencyFmt(cashflowSummary.totalDespesas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Clock className="w-4 h-4 text-yellow-600" /> Pagamentos Programados</div>
                <p className="text-xl font-bold text-yellow-600">{currencyFmt(cashflowSummary.despesasProgramadas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><DollarSign className="w-4 h-4" /> Saldo</div>
                <p className={cn("text-xl font-bold", cashflowSummary.saldo >= 0 ? 'text-green-600' : 'text-destructive')}>{currencyFmt(cashflowSummary.saldo)}</p>
              </CardContent>
            </Card>
          </div>

          {filteredCashflow.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum lançamento neste período.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                     <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Projeto / Centro</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCashflow.map(e => {
                      const entry = e as any;
                      const isFuture = entry.is_future_payment;
                      const isPaid = entry.is_paid;
                      return (
                      <TableRow key={e.id} className={cn(isFuture && !isPaid && 'bg-muted/40')}>
                        <TableCell>{e.date ? format(new Date(e.date + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</TableCell>
                        <TableCell>
                          <Badge variant={e.type === 'receita' ? 'default' : 'destructive'} className="text-xs">
                            {e.type === 'receita' ? 'Receita' : 'Despesa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {e.description}
                          {isFuture && entry.payment_due_date && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              Pgto: {format(new Date(entry.payment_due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {budgetLabel(e.budget_id) || revenueCenterName(e.revenue_center_id) || costCenterName(e.cost_center_id) || '—'}
                        </TableCell>
                        <TableCell>{accountName(e.account_id)}</TableCell>
                        <TableCell>
                          {isFuture ? (
                            isPaid ? (
                              <Badge variant="default" className="text-xs bg-green-600"><Check className="w-3 h-3 mr-1" />Pago</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-400"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-right font-medium", e.type === 'receita' ? 'text-green-600' : 'text-destructive')}>
                          {e.type === 'despesa' ? '- ' : ''}{currencyFmt(Number(e.value))}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            {isFuture && !isPaid && (
                              <Button size="sm" variant="ghost" className="text-green-600" title="Confirmar pagamento" onClick={() => markEntryAsPaid(e.id)}><Check className="w-4 h-4" /></Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => openEditEntry(e)}><Pencil className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteEntry(e.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );})}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Cashflow Entry Dialog */}
          <Dialog open={cashflowDialog} onOpenChange={setCashflowDialog}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingEntry ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant={entryForm.type === 'receita' ? 'default' : 'outline'} className="flex-1" onClick={() => setEntryForm(f => ({ ...f, type: 'receita', cost_center_id: '', budget_id: '', revenue_center_id: '' }))}>
                    <ArrowUpCircle className="w-4 h-4 mr-1" /> Receita
                  </Button>
                  <Button variant={entryForm.type === 'despesa' ? 'destructive' : 'outline'} className="flex-1" onClick={() => setEntryForm(f => ({ ...f, type: 'despesa', budget_id: '', revenue_center_id: '', cost_center_id: '' }))}>
                    <ArrowDownCircle className="w-4 h-4 mr-1" /> Despesa
                  </Button>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição do lançamento" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input type="number" min="0" step="0.01" value={entryForm.value} onChange={e => setEntryForm(f => ({ ...f, value: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !entryForm.date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {entryForm.date ? format(entryForm.date, 'dd/MM/yyyy') : 'Selecionar'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={entryForm.date} onSelect={d => d && setEntryForm(f => ({ ...f, date: d }))} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div>
                  <Label>Conta Financeira</Label>
                  <Select value={entryForm.account_id} onValueChange={v => setEntryForm(f => ({ ...f, account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.is_active).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {entryForm.type === 'receita' && (
                  <div>
                    <Label>Centro de Receita</Label>
                    <Select value={entryForm.revenue_center_id || 'none'} onValueChange={v => setEntryForm(f => ({ ...f, revenue_center_id: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {revenueCenters.filter(r => r.is_active).map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {entryForm.type === 'despesa' && (
                  <div>
                    <Label>Centro de Custo</Label>
                    <Select value={entryForm.cost_center_id || 'none'} onValueChange={v => setEntryForm(f => ({ ...f, cost_center_id: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {costCenters.filter(c => c.is_active).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}


                {entryForm.type === 'despesa' && (
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-muted-foreground" />
                      <Label htmlFor="recurring-toggle" className="cursor-pointer">Despesa Contínua (mensal)</Label>
                    </div>
                    <Switch id="recurring-toggle" checked={entryForm.is_recurring} onCheckedChange={v => setEntryForm(f => ({ ...f, is_recurring: v }))} />
                  </div>
                )}

                {entryForm.is_recurring && entryForm.type === 'despesa' && (
                  <div className="space-y-3 p-3 rounded-md border bg-muted/30">
                    <p className="text-sm text-muted-foreground">Um lançamento será criado para cada mês, da data de início até o mês de término selecionado.</p>
                    <div>
                      <Label>Mês de Término</Label>
                      <Select value={entryForm.recurring_end_month} onValueChange={v => setEntryForm(f => ({ ...f, recurring_end_month: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar mês de término" /></SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const options: { value: string; label: string }[] = [];
                            const start = new Date(entryForm.date);
                            for (let i = 0; i < 24; i++) {
                              const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
                              options.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: ptBR }) });
                            }
                            return options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>);
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    {entryForm.recurring_end_month && Number(entryForm.value) > 0 && (() => {
                      const startMonth = new Date(entryForm.date.getFullYear(), entryForm.date.getMonth(), 1);
                      const [ey, em] = entryForm.recurring_end_month.split('-').map(Number);
                      const endMonth = new Date(ey, em - 1, 1);
                      const months = (endMonth.getFullYear() - startMonth.getFullYear()) * 12 + endMonth.getMonth() - startMonth.getMonth() + 1;
                      return months > 0 ? (
                        <p className="text-sm font-medium">
                          {months} lançamento(s) de {currencyFmt(Number(entryForm.value))} = Total: {currencyFmt(months * Number(entryForm.value))}
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}

                {entryForm.type === 'despesa' && !entryForm.is_recurring && (
                  <div className="flex items-center justify-between p-3 rounded-md border">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <Label htmlFor="future-payment" className="cursor-pointer">Pagamento futuro</Label>
                    </div>
                    <Switch id="future-payment" checked={entryForm.is_future_payment} onCheckedChange={v => setEntryForm(f => ({ ...f, is_future_payment: v }))} />
                  </div>
                )}

                {entryForm.is_future_payment && (
                  <div>
                    <Label>Data de Pagamento</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !entryForm.payment_due_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {entryForm.payment_due_date ? format(entryForm.payment_due_date, 'dd/MM/yyyy') : 'Selecionar data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={entryForm.payment_due_date || undefined} onSelect={d => d && setEntryForm(f => ({ ...f, payment_due_date: d }))} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div>
                  <Label>Observações</Label>
                  <Textarea value={entryForm.notes} onChange={e => setEntryForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                </div>
                <Button onClick={saveEntry} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===================== PROJETOS DO MÊS ===================== */}
        <TabsContent value="projetos" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Mês</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(m => (
                  <SelectItem key={m} value={m}>{format(new Date(m + '-01T12:00:00'), 'MMMM yyyy', { locale: ptBR })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1"><DollarSign className="w-4 h-4 shrink-0" /> Faturamento</div><p className="text-lg sm:text-xl font-bold">{currencyFmt(monthlyProjects.reduce((s, p) => s + p.totalValue, 0))}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1"><TrendingDown className="w-4 h-4 shrink-0" /> Custo Real</div><p className="text-lg sm:text-xl font-bold">{currencyFmt(monthlyProjects.reduce((s, p) => s + p.totalRealCost, 0))}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1"><DollarSign className="w-4 h-4 shrink-0" /> Imposto NF</div><p className="text-lg sm:text-xl font-bold">{currencyFmt(monthlyProjects.reduce((s, p) => s + p.nfCost, 0))}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1"><TrendingUp className="w-4 h-4 shrink-0" /> Margem Real</div><p className="text-lg sm:text-xl font-bold">{currencyFmt(monthlyProjects.reduce((s, p) => s + p.margin, 0))}</p></CardContent></Card>
          </div>

          {monthlyProjects.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum projeto aprovado para este mês.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">NF</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyProjects.map(p => {
                      const paymentInfo = getProjectPaymentInfo(p.id, p.totalValue);
                      const paymentIconColor = paymentInfo.status === 'pago'
                        ? 'text-green-600'
                        : paymentInfo.status === 'parcial'
                          ? 'text-yellow-500'
                          : 'text-orange-400';
                      const paymentTooltip = paymentInfo.status === 'pago'
                        ? 'Pagamento concluído'
                        : paymentInfo.status === 'parcial'
                          ? `Parcial: ${currencyFmt(paymentInfo.totalPaid)} recebido, falta ${currencyFmt(paymentInfo.remaining)}`
                          : 'Nenhum pagamento registrado';

                      return (
                        <React.Fragment key={p.id}>
                          <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedProject(expandedProject === p.id ? null : p.id)}>
                            <TableCell className="text-muted-foreground">{p.proposalId}</TableCell>
                            <TableCell className="font-medium text-primary">{p.projectName}</TableCell>
                            <TableCell>{p.clientName}</TableCell>
                            <TableCell className="text-center">
                              {p.nfUrl ? (
                                <a
                                  href={p.nfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Visualizar NF emitida"
                                >
                                  <Badge variant="outline" className="text-[10px] gap-1 border-success/30 bg-success/10 text-success cursor-pointer hover:bg-success/20">
                                    <FileCheck2 className="w-3 h-3" /> Emitida
                                  </Badge>
                                </a>
                              ) : (
                                <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                                  <FileX2 className="w-3 h-3" /> Pendente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {currencyFmt(p.totalValue)}
                              <span className={cn("ml-2 text-xs font-medium", p.marginPercent >= 0 ? 'text-green-600' : 'text-destructive')}>
                                ({p.marginPercent.toFixed(1)}%)
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title={paymentTooltip}
                                  onClick={(e) => { e.stopPropagation(); openPaymentDialog(p); }}
                                >
                                  <CircleDollarSign className={cn("w-5 h-5", paymentIconColor)} />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/crm/orcamento/${p.id}?tab=execution&from=financeiro`); }} title="Abrir Execução"><ExternalLink className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedProject === p.id && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30 p-0">
                                <div className="p-4 space-y-3">
                                  <h4 className="text-sm font-semibold">Composição do Investimento</h4>
                                  <Table>
                                    <TableHeader><TableRow><TableHead>Serviço</TableHead><TableHead className="text-right">Valor Proposta</TableHead><TableHead className="text-right">Custo Real</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                      {p.services.map((s, i) => (
                                        <TableRow key={i}>
                                          <TableCell className="font-medium"><div className="flex items-center gap-2">{s.categoryLabel && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold uppercase">{s.categoryLabel}</Badge>}<span>{s.name}</span></div></TableCell>
                                          <TableCell className="text-right">{currencyFmt(s.value)}</TableCell>
                                          <TableCell className="text-right">{currencyFmt(s.realCost)}</TableCell>
                                          <TableCell className="text-right"><span className={s.margin >= 0 ? 'text-green-600' : 'text-destructive'}>{currencyFmt(s.margin)} ({s.marginPercent.toFixed(1)}%)</span></TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow><TableCell className="font-medium">Imposto NF</TableCell><TableCell className="text-right">—</TableCell><TableCell className="text-right">{currencyFmt(p.nfCost)}</TableCell><TableCell className="text-right">—</TableCell></TableRow>
                                      <TableRow className="font-bold border-t-2">
                                        <TableCell>Total</TableCell>
                                        <TableCell className="text-right">{currencyFmt(p.totalValue)}</TableCell>
                                        <TableCell className="text-right">{currencyFmt(p.totalRealCost + p.nfCost)}</TableCell>
                                        <TableCell className="text-right"><span className={p.margin >= 0 ? 'text-green-600' : 'text-destructive'}>{currencyFmt(p.margin)} ({p.marginPercent.toFixed(1)}%)</span></TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>

                                  {(() => {
                                    const projectPayments = cashflowEntries.filter(e => e.type === 'receita' && e.budget_id === p.id);
                                    const totalPaid = projectPayments.reduce((s, e) => s + Number(e.value), 0);
                                    return (
                                      <div className="mt-4">
                                        <h4 className="text-sm font-semibold mb-2">Histórico de Recebimentos</h4>
                                        {projectPayments.length === 0 ? (
                                          <p className="text-sm text-muted-foreground italic">Nenhum pagamento registrado para este projeto.</p>
                                        ) : (
                                          <Table>
                                            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                              {projectPayments.map(pay => (
                                                <TableRow key={pay.id}>
                                                  <TableCell>{pay.date ? format(new Date(pay.date + 'T12:00:00'), 'dd/MM/yyyy') : '—'}</TableCell>
                                                  <TableCell>{pay.description}</TableCell>
                                                  <TableCell>{accountName(pay.account_id)}</TableCell>
                                                  <TableCell className="text-right text-green-600 font-medium">{currencyFmt(Number(pay.value))}</TableCell>
                                                </TableRow>
                                              ))}
                                              <TableRow className="font-bold border-t">
                                                <TableCell colSpan={3}>Total Recebido</TableCell>
                                                <TableCell className="text-right text-green-600">{currencyFmt(totalPaid)}</TableCell>
                                              </TableRow>
                                              <TableRow>
                                                <TableCell colSpan={3} className="font-medium">Saldo Restante</TableCell>
                                                <TableCell className="text-right font-medium text-orange-500">{currencyFmt(p.totalValue - totalPaid)}</TableCell>
                                              </TableRow>
                                            </TableBody>
                                          </Table>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                  <span className="font-medium">{monthlyProjects.length} projetos</span>
                  <span className="font-bold">Total: {currencyFmt(monthlyProjects.reduce((s, p) => s + p.totalValue, 0))}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Dialog */}
          <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CircleDollarSign className="w-5 h-5" />
                  Registrar Pagamento
                </DialogTitle>
              </DialogHeader>
              {paymentProject && (
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                    <p className="font-medium">{paymentProject.proposalId} - {paymentProject.projectName}</p>
                    <p className="text-muted-foreground">Valor do projeto: {currencyFmt(paymentProject.totalValue)}</p>
                    {(() => {
                      const info = getProjectPaymentInfo(paymentProject.id, paymentProject.totalValue);
                      return info.totalPaid > 0 ? (
                        <p className="text-muted-foreground">Já recebido: <span className="text-green-600 font-medium">{currencyFmt(info.totalPaid)}</span> — Falta: <span className="text-orange-500 font-medium">{currencyFmt(info.remaining)}</span></p>
                      ) : null;
                    })()}
                  </div>

                  <div className="flex gap-2">
                    <Button variant={paymentForm.type === 'total' ? 'default' : 'outline'} className="flex-1" onClick={() => {
                      const info = getProjectPaymentInfo(paymentProject.id, paymentProject.totalValue);
                      setPaymentForm(f => ({ ...f, type: 'total', value: String(info.remaining.toFixed(2)) }));
                    }}>
                      Pagamento Total
                    </Button>
                    <Button variant={paymentForm.type === 'parcial' ? 'default' : 'outline'} className="flex-1" onClick={() => setPaymentForm(f => ({ ...f, type: 'parcial' }))}>
                      Pagamento Parcial
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Valor (R$)</Label>
                      <Input type="number" min="0" step="0.01" value={paymentForm.value} onChange={e => setPaymentForm(f => ({ ...f, value: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Data</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(paymentForm.date, 'dd/MM/yyyy')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={paymentForm.date} onSelect={d => d && setPaymentForm(f => ({ ...f, date: d }))} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <Label>Conta Financeira *</Label>
                    <Select value={paymentForm.account_id} onValueChange={v => setPaymentForm(f => ({ ...f, account_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                      <SelectContent>
                        {accounts.filter(a => a.is_active).map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Observações sobre o pagamento" />
                  </div>

                  <Button onClick={savePayment} className="w-full">Registrar Pagamento</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===================== PAINEL FINANCEIRO ===================== */}
        <TabsContent value="painel" className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Wallet className="w-4 h-4" /> Saldo Total (Contas)</div>
                <p className={cn("text-2xl font-bold", painelData.totalSaldo >= 0 ? 'text-green-600' : 'text-destructive')}>{currencyFmt(painelData.totalSaldo)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Account balances */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Saldo por Conta</CardTitle>
              {painelData.accountBalances.length >= 2 && (
                <Button variant="outline" size="sm" onClick={() => { setTransferForm({ from_account_id: '', to_account_id: '', value: '', date: new Date(), description: '' }); setTransferDialog(true); }}>
                  <ArrowLeftRight className="h-4 w-4 mr-1" /> Transferir
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {painelData.accountBalances.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta financeira cadastrada.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {painelData.accountBalances.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">{acc.bank || acc.type}</p>
                      </div>
                      <p className={cn("font-bold", acc.saldo >= 0 ? 'text-green-600' : 'text-destructive')}>{currencyFmt(acc.saldo)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transfer Dialog */}
          <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Transferência entre Contas</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Conta de Origem</Label>
                  <Select value={transferForm.from_account_id} onValueChange={v => setTransferForm(f => ({ ...f, from_account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta de origem" /></SelectTrigger>
                    <SelectContent>
                      {painelData.accountBalances.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({currencyFmt(a.saldo)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Conta de Destino</Label>
                  <Select value={transferForm.to_account_id} onValueChange={v => setTransferForm(f => ({ ...f, to_account_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta de destino" /></SelectTrigger>
                    <SelectContent>
                      {painelData.accountBalances.filter(a => a.id !== transferForm.from_account_id).map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({currencyFmt(a.saldo)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={transferForm.value} onChange={e => setTransferForm(f => ({ ...f, value: e.target.value }))} />
                  {transferForm.from_account_id && (() => {
                    const acc = painelData.accountBalances.find(a => a.id === transferForm.from_account_id);
                    return acc ? <p className="text-xs text-muted-foreground mt-1">Saldo disponível: {currencyFmt(acc.saldo)}</p> : null;
                  })()}
                </div>
                <div>
                  <Label>Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(transferForm.date, 'dd/MM/yyyy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={transferForm.date} onSelect={d => d && setTransferForm(f => ({ ...f, date: d }))} /></PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Input placeholder="Transferência entre contas" value={transferForm.description} onChange={e => setTransferForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={saveTransfer}>
                  <ArrowLeftRight className="h-4 w-4 mr-2" /> Confirmar Transferência
                </Button>
              </div>
            </DialogContent>
          </Dialog>



          <Card>
            <CardHeader><CardTitle className="text-base">Resumo Mensal — Receita x Despesa Prevista</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const allMonths = new Set<string>();
                painelData.receivablesByMonth.forEach(r => { if (r.remaining > 0) allMonths.add(r.month); });
                painelData.futureExpensesByMonth.forEach(r => allMonths.add(r.month));
                const sorted = Array.from(allMonths).sort();
                if (sorted.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma previsão pendente.</p>;
                const recMap: Record<string, typeof painelData.receivablesByMonth[0]> = {};
                painelData.receivablesByMonth.forEach(r => { recMap[r.month] = r; });
                const despMap: Record<string, typeof painelData.futureExpensesByMonth[0]> = {};
                painelData.futureExpensesByMonth.forEach(r => { despMap[r.month] = r; });
                let totalRec = 0, totalDesp = 0;
                const rows = sorted.map(m => {
                  const rec = recMap[m]?.remaining && recMap[m].remaining > 0 ? recMap[m].remaining : 0;
                  const desp = despMap[m]?.pending || 0;
                  totalRec += rec;
                  totalDesp += desp;
                  return { month: m, label: format(new Date(m + '-01T12:00:00'), 'MMM/yy', { locale: ptBR }), rec, desp, saldo: rec - desp };
                });
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Receita Prevista</TableHead>
                        <TableHead className="text-right">Despesa Prevista</TableHead>
                        <TableHead className="text-right">Saldo Previsto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(r => (
                        <TableRow key={r.month}>
                          <TableCell className="font-medium">{r.label}</TableCell>
                          <TableCell className="text-right text-green-600">{currencyFmt(r.rec)}</TableCell>
                          <TableCell className="text-right text-destructive">{currencyFmt(r.desp)}</TableCell>
                          <TableCell className={cn("text-right font-medium", r.saldo >= 0 ? 'text-green-600' : 'text-destructive')}>{currencyFmt(r.saldo)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right text-green-600">{currencyFmt(totalRec)}</TableCell>
                        <TableCell className="text-right text-destructive">{currencyFmt(totalDesp)}</TableCell>
                        <TableCell className={cn("text-right", (totalRec - totalDesp) >= 0 ? 'text-green-600' : 'text-destructive')}>{currencyFmt(totalRec - totalDesp)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                );
              })()}
            </CardContent>
          </Card>

        </TabsContent>




        {/* ===================== CONFIGURAÇÕES ===================== */}
        <TabsContent value="config" className="space-y-6">
          {/* Contas Financeiras */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Contas Financeiras</h2>
              <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
                <DialogTrigger asChild>
                  <Button onClick={openNewAccount} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova Conta</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Nome da Conta</Label><Input value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Banco do Brasil" /></div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={accountForm.type} onValueChange={v => setAccountForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Banco</Label><Input value={accountForm.bank} onChange={e => setAccountForm(f => ({ ...f, bank: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Agência</Label><Input value={accountForm.agency} onChange={e => setAccountForm(f => ({ ...f, agency: e.target.value }))} /></div>
                      <div><Label>Número da Conta</Label><Input value={accountForm.account_number} onChange={e => setAccountForm(f => ({ ...f, account_number: e.target.value }))} /></div>
                    </div>
                    <Button onClick={saveAccount} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {accounts.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground"><Landmark className="w-10 h-10 mx-auto mb-2 opacity-50" />Nenhuma conta cadastrada.</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Banco</TableHead><TableHead className="hidden sm:table-cell">Agência</TableHead><TableHead className="hidden sm:table-cell">Conta</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {accounts.map(acc => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.name}</TableCell>
                          <TableCell>{ACCOUNT_TYPES.find(t => t.value === acc.type)?.label || acc.type}</TableCell>
                          <TableCell>{acc.bank || '—'}</TableCell>
                          <TableCell>{acc.agency || '—'}</TableCell>
                          <TableCell>{acc.account_number || '—'}</TableCell>
                          <TableCell><Badge variant={acc.is_active ? 'default' : 'secondary'}>{acc.is_active ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEditAccount(acc)}><Pencil className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAccount(acc.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>


          {/* Centros de Receita e Custo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Centers */}
            <Card>
              <CardHeader><CardTitle className="text-base">Centros de Receita</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Nome do centro de receita" value={newRevenueCenterName} onChange={e => setNewRevenueCenterName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRevenueCenter()} />
                  <Button size="sm" onClick={addRevenueCenter}><Plus className="w-4 h-4" /></Button>
                </div>
                {revenueCenters.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum centro cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {revenueCenters.map(rc => (
                      <div key={rc.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="flex items-center gap-2">
                          <Badge variant={rc.is_active ? 'default' : 'secondary'} className="text-xs">{rc.is_active ? 'Ativo' : 'Inativo'}</Badge>
                          <span className="text-sm font-medium">{rc.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleRevenueCenter(rc.id, rc.is_active)}>{rc.is_active ? 'Desativar' : 'Ativar'}</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteRevenueCenter(rc.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost Centers */}
            <Card>
              <CardHeader><CardTitle className="text-base">Centros de Custo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Nome do centro de custo" value={newCostCenterName} onChange={e => setNewCostCenterName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCostCenter()} />
                  <Button size="sm" onClick={addCostCenter}><Plus className="w-4 h-4" /></Button>
                </div>
                {costCenters.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum centro cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {costCenters.map(cc => (
                      <div key={cc.id} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="flex items-center gap-2">
                          <Badge variant={cc.is_active ? 'default' : 'secondary'} className="text-xs">{cc.is_active ? 'Ativo' : 'Inativo'}</Badge>
                          <span className="text-sm font-medium">{cc.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleCostCenter(cc.id, cc.is_active)}>{cc.is_active ? 'Desativar' : 'Ativar'}</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCostCenter(cc.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}