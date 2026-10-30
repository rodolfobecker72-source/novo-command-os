-- Fase 2 da auditoria (docs/AUDITORIA.md): itens 1 e 2. Permissões por papel no banco.
--
--   Proprietário e Administrador (gestores): tudo que já podiam.
--   Vendedor: lê, cria e edita clientes, leads e orçamentos; não apaga clientes,
--             leads nem orçamentos; não vê o financeiro (já era só gestores).
--   Time Operacional: nada do comercial (clientes, leads, orçamentos, valores,
--             metas, regras comerciais, preços de itens, minuta de contrato,
--             documentos de orçamento). Projetos, atividades, agenda, Central de
--             Mídias e Histórico continuam como estão. O que essas telas precisam
--             do comercial chega por funções que devolvem só o necessário, sem
--             valores: budget_schedules, set_budget_execution_month,
--             media_center_clients e my_finance_entries.
--   Configurações (colunas do CRM, status de leads, colunas de projetos): só gestores alteram.

CREATE FUNCTION private.is_commercial() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT private.my_role()) IN ('owner', 'admin', 'vendedor')
$$;

CREATE FUNCTION private.is_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT private.my_role()) IN ('owner', 'admin')
$$;

REVOKE ALL ON FUNCTION private.is_commercial(), private.is_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_commercial(), private.is_manager() TO authenticated, service_role;

-- ============================================================================
-- Comercial: gestores e vendedor; apagar só gestores
-- ============================================================================
ALTER POLICY clients_select ON public.clients
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY clients_insert ON public.clients
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY clients_update ON public.clients
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY clients_delete ON public.clients
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));

-- Contatos fazem parte da edição do cliente (o editor remove contatos tirados da lista)
ALTER POLICY cc_select ON public.client_contacts
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY cc_insert ON public.client_contacts
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY cc_update ON public.client_contacts
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY cc_delete ON public.client_contacts
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));

ALTER POLICY leads_select ON public.prospection_leads
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY leads_insert ON public.prospection_leads
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY leads_update ON public.prospection_leads
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY leads_delete ON public.prospection_leads
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));

ALTER POLICY budgets_select ON public.budgets
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY budgets_insert ON public.budgets
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY budgets_update ON public.budgets
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY budgets_delete ON public.budgets
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));

-- Versões: desfazer a última versão (não aprovada) faz parte da edição do orçamento
ALTER POLICY budget_versions_select ON public.budget_versions
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY budget_versions_insert ON public.budget_versions
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY budget_versions_update ON public.budget_versions
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY budget_versions_delete ON public.budget_versions
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));

ALTER POLICY score_history_select ON public.score_history
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY score_history_insert ON public.score_history
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY score_history_delete ON public.score_history
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));

-- Dados comerciais de configuração: leitura do comercial (edição já era só do proprietário)
ALTER POLICY payment_terms_select ON public.payment_terms
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY monthly_goals_select ON public.monthly_goals
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY service_items_select ON public.service_items
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY workspace_contract_template_select ON public.workspace_contract_template
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));

-- ============================================================================
-- Configurações de quadros: o comercial lê, só gestores alteram
-- ============================================================================
ALTER POLICY kanban_columns_select ON public.kanban_columns
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY kanban_columns_insert ON public.kanban_columns
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));
ALTER POLICY kanban_columns_update ON public.kanban_columns
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));
ALTER POLICY kanban_columns_delete ON public.kanban_columns
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));

ALTER POLICY "Members can view lead statuses" ON public.lead_statuses
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_commercial()));
ALTER POLICY "Members can create lead statuses" ON public.lead_statuses
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));
ALTER POLICY "Members can update lead statuses" ON public.lead_statuses
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()))
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));
ALTER POLICY "Members can delete lead statuses" ON public.lead_statuses
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));

-- Colunas de projetos: todos leem, só gestores alteram
ALTER POLICY project_columns_insert ON public.project_columns
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));
ALTER POLICY project_columns_update ON public.project_columns
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));
ALTER POLICY project_columns_delete ON public.project_columns
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));

-- ============================================================================
-- Financeiro do Time: uma regra de leitura e as de escrita só para gestores
-- ============================================================================
DROP POLICY "Owner/admin manage team finance access" ON public.team_finance_access;
CREATE POLICY team_finance_access_insert ON public.team_finance_access FOR INSERT TO authenticated
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));
CREATE POLICY team_finance_access_update ON public.team_finance_access FOR UPDATE TO authenticated
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()))
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));
CREATE POLICY team_finance_access_delete ON public.team_finance_access FOR DELETE TO authenticated
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.is_manager()));

-- ============================================================================
-- 2. Documentos de orçamento (contratos, NF): só o comercial
-- ============================================================================
ALTER POLICY budget_docs_select ON storage.objects
  USING (bucket_id = 'budget-documents'
         AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text
         AND (SELECT private.is_commercial()));
ALTER POLICY budget_docs_insert ON storage.objects
  WITH CHECK (bucket_id = 'budget-documents'
              AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text
              AND (SELECT private.is_commercial()));
ALTER POLICY budget_docs_update ON storage.objects
  USING (bucket_id = 'budget-documents'
         AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text
         AND (SELECT private.is_commercial()));
ALTER POLICY budget_docs_delete ON storage.objects
  USING (bucket_id = 'budget-documents'
         AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text
         AND (SELECT private.is_manager()));

-- ============================================================================
-- O que as telas de projeto precisam do comercial, sem valores
-- ============================================================================

-- Mês de execução e recorrência de cada orçamento (Área de Projetos)
CREATE FUNCTION public.budget_schedules()
RETURNS TABLE (budget_id uuid, execution_month text, is_recurring boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT b.id, b.execution_month, b.is_recurring
    FROM public.budgets b
   WHERE b.workspace_id = (SELECT private.my_workspace_id())
$$;

CREATE FUNCTION public.set_budget_execution_month(p_budget_id uuid, p_month text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_month IS NOT NULL AND p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Mês inválido: use AAAA-MM' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE public.budgets
     SET execution_month = p_month, updated_at = now()
   WHERE id = p_budget_id
     AND workspace_id = (SELECT private.my_workspace_id());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
END $$;

-- Clientes com projeto aprovado ou histórico (Central de Mídias): só id e nome
CREATE FUNCTION public.media_center_clients()
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id, c.company_name
    FROM public.clients c
   WHERE c.workspace_id = (SELECT private.my_workspace_id())
     AND (EXISTS (SELECT 1 FROM public.budgets b
                   WHERE b.client_id = c.id AND b.status = 'aprovada')
          OR EXISTS (SELECT 1 FROM public.legacy_projects l WHERE l.client_id = c.id))
   ORDER BY c.company_name
$$;

-- Meu Financeiro: só os custos de execução em que a pessoa é o fornecedor
-- (o vínculo é pelo nome, como sempre foi), e só se o acesso estiver liberado
-- para ela (o proprietário sempre vê).
CREATE FUNCTION public.my_finance_entries()
RETURNS TABLE (
  budget_id uuid, proposal_id text, project_name text, client_name text,
  description text, real_value numeric, payment_status text, payment_date text, month text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH me AS (
    SELECT p.name
      FROM public.profiles p
     WHERE p.id = (SELECT auth.uid())
       AND coalesce(p.name, '') <> ''
       AND ((SELECT private.my_role()) = 'owner'
            OR EXISTS (SELECT 1 FROM public.team_finance_access t
                        WHERE t.user_id = (SELECT auth.uid())
                          AND t.workspace_id = (SELECT private.my_workspace_id())
                          AND t.enabled))
  ),
  costs AS (
    SELECT b.id AS budget_id, b.proposal_id, b.project_name, b.client_id,
           coalesce(b.execution_month, to_char(b.approval_date, 'YYYY-MM'), '—') AS month,
           src.prefix, src.cost
      FROM public.budgets b
      CROSS JOIN LATERAL (
        SELECT NULL::text AS prefix, c AS cost
          FROM jsonb_array_elements(coalesce(b.execution -> 'services', '[]')) s,
               jsonb_array_elements(coalesce(s -> 'costs', '[]')) c
        UNION ALL
        SELECT 'Extra', c
          FROM jsonb_array_elements(coalesce(b.execution -> 'services', '[]')) s,
               jsonb_array_elements(coalesce(s -> 'extraCosts', '[]')) c
        UNION ALL
        SELECT 'Operacional', c FROM jsonb_array_elements(coalesce(b.execution -> 'operationalCosts', '[]')) c
        UNION ALL
        SELECT 'Operacional Extra', c FROM jsonb_array_elements(coalesce(b.execution -> 'extraOperationalCosts', '[]')) c
      ) src
     WHERE b.workspace_id = (SELECT private.my_workspace_id())
       AND b.execution IS NOT NULL
  )
  SELECT costs.budget_id, costs.proposal_id, costs.project_name, coalesce(cl.company_name, ''),
         CASE WHEN costs.prefix IS NULL THEN costs.cost ->> 'description'
              ELSE costs.prefix || ' — ' || (costs.cost ->> 'description') END,
         coalesce(nullif(costs.cost ->> 'realValue', '')::numeric, 0),
         coalesce(costs.cost ->> 'paymentStatus', 'pendente'),
         costs.cost ->> 'paymentDate',
         costs.month
    FROM costs
    JOIN me ON costs.cost ->> 'supplier' = me.name
    LEFT JOIN public.clients cl ON cl.id = costs.client_id
$$;

REVOKE ALL ON FUNCTION public.budget_schedules(), public.set_budget_execution_month(uuid, text),
  public.media_center_clients(), public.my_finance_entries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.budget_schedules(), public.set_budget_execution_month(uuid, text),
  public.media_center_clients(), public.my_finance_entries() TO authenticated;
