import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/types/crm';
import { toast } from 'sonner';

export interface PayItem {
  costId: string;
  budgetId: string;
  description: string;
  value: number;
}

type OnConfirm = (date: Date) => Promise<void> | void;

/**
 * Marca custos de execução como pagos e lança cada um como despesa no fluxo de caixa,
 * debitando da conta escolhida. Desfazer o "pago" remove o lançamento correspondente.
 */
export function useCashflowPayment() {
  const { workspace } = useAuth();
  const [accounts, setAccounts] = useState<{ id: string; name: string; saldo: number }[]>([]);
  const [pending, setPending] = useState<{ items: PayItem[]; onConfirm: OnConfirm } | null>(null);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pending || !workspace?.id) return;
    const ids = new Set(pending.items.map((i) => i.costId));
    (async () => {
      const [{ data: accs }, { data: entries }] = await Promise.all([
        supabase.from('financial_accounts').select('id, name').eq('workspace_id', workspace.id).eq('is_active', true).order('name'),
        supabase.from('cashflow_entries').select('account_id, type, value, is_future_payment, is_paid, execution_cost_id').eq('workspace_id', workspace.id).not('account_id', 'is', null).limit(10000),
      ]);
      const list = (accs || []).map((a) => {
        let saldo = 0;
        (entries || []).forEach((e: any) => {
          if (e.account_id !== a.id) return;
          if (e.is_future_payment && !e.is_paid) return;
          if (e.execution_cost_id && ids.has(e.execution_cost_id)) return; // será substituído
          saldo += (e.type === 'receita' ? 1 : -1) * Number(e.value);
        });
        return { ...a, saldo };
      });
      setAccounts(list);
      if (list.length === 1) setAccountId(list[0].id);
    })();
  }, [pending, workspace?.id]);

  const requestPay = (items: PayItem[], onConfirm: OnConfirm) => {
    if (items.length === 0) return;
    setDate(new Date().toISOString().slice(0, 10));
    setPending({ items, onConfirm });
  };

  const unpay = async (costIds: string[]) => {
    if (!workspace?.id || costIds.length === 0) return;
    await supabase
      .from('cashflow_entries')
      .delete()
      .eq('workspace_id', workspace.id)
      .in('execution_cost_id', costIds);
  };

  const total = pending?.items.reduce((s, i) => s + i.value, 0) || 0;
  const selectedAcc = accounts.find((a) => a.id === accountId);
  const insufficient = !!selectedAcc && selectedAcc.saldo < total;

  const confirm = async () => {
    if (!pending || !workspace?.id) return;
    if (!accountId) {
      toast.error('Escolha a conta de onde o valor sai');
      return;
    }
    const acc = accounts.find((a) => a.id === accountId);
    if (acc && acc.saldo < total) {
      toast.error(`Saldo insuficiente em ${acc.name}: ${formatCurrency(acc.saldo)} disponível`);
      return;
    }
    setSaving(true);
    try {
      const ids = pending.items.map((i) => i.costId);
      await unpay(ids); // evita duplicar
      const paidAt = new Date(date + 'T12:00:00');
      const { error } = await supabase.from('cashflow_entries').insert(
        pending.items.map((i) => ({
          workspace_id: workspace.id,
          type: 'despesa',
          description: i.description,
          value: i.value,
          date,
          account_id: accountId,
          budget_id: i.budgetId,
          execution_cost_id: i.costId,
          notes: '',
          is_future_payment: false,
          is_paid: true,
          paid_at: paidAt.toISOString(),
        })),
      );
      if (error) throw error;
      await pending.onConfirm(paidAt);
      toast.success(
        pending.items.length > 1
          ? `${pending.items.length} pagamentos lançados no fluxo de caixa`
          : 'Pagamento lançado no fluxo de caixa',
      );
      setPending(null);
    } catch (e: any) {
      toast.error('Não foi possível lançar o pagamento: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const dialog = (
    <Dialog open={!!pending} onOpenChange={(o) => !o && !saving && setPending(null)}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 min-w-0">
          <div className="max-h-60 overflow-y-auto rounded-md border divide-y text-sm">
            {pending?.items.map((i) => (
              <div key={i.costId} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 break-words leading-snug">{i.description}</span>
                <span className="font-medium shrink-0">{formatCurrency(i.value)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Debitar da conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={accounts.length ? 'Selecione a conta' : 'Nenhuma conta cadastrada'} />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — <span className={a.saldo < total ? 'text-destructive' : 'text-muted-foreground'}>{formatCurrency(a.saldo)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAcc && (
              <p className={`text-xs ${insufficient ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                Saldo disponível: {formatCurrency(selectedAcc.saldo)}
                {insufficient && ' — saldo insuficiente para este pagamento'}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Data do pagamento</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPending(null)} disabled={saving}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || !date || insufficient}>
            {saving ? 'Lançando...' : 'Confirmar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestPay, unpay, dialog };
}
