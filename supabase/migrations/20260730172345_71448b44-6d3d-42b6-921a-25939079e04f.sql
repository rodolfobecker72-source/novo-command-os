ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;

UPDATE public.budgets b
SET is_recurring = true
WHERE EXISTS (
  SELECT 1 FROM public.budget_versions v
  WHERE v.budget_id = b.id AND v.reason LIKE 'Duplicado de #%'
);