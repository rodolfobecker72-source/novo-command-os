ALTER TABLE public.cashflow_entries ADD COLUMN IF NOT EXISTS execution_cost_id text;
CREATE INDEX IF NOT EXISTS idx_cashflow_execution_cost ON public.cashflow_entries(workspace_id, execution_cost_id);