-- Role-based access (audit item 2, 2026-10-28)
--
-- Until now every table only checked workspace membership, so any member
-- (vendedor, visualizador, time_hero) could read and change the Financeiro,
-- Patrimônio and Configurações through the API even though the UI hides
-- those pages. Policies now follow src/config/pages.ts:
--   * Financeiro + Patrimônio: owner and admin only (read and write)
--   * Configurações: every member reads (budgets and PDFs need them),
--     only the owner writes

-- Drop every existing policy on the affected tables (names drifted over time)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'cashflow_entries', 'financial_accounts', 'credit_cards', 'cost_centers', 'revenue_centers', 'assets',
        'workspace_settings', 'workspace_layout', 'workspace_contract_template', 'payment_terms',
        'service_categories', 'service_items', 'service_objectives'
      ])
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Financeiro + Patrimônio: owner/admin
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cashflow_entries', 'financial_accounts', 'credit_cards', 'cost_centers', 'revenue_centers', 'assets']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.get_user_role(auth.uid(), workspace_id) IN (''owner'', ''admin''))
         WITH CHECK (public.get_user_role(auth.uid(), workspace_id) IN (''owner'', ''admin''))',
      t || '_owner_admin', t);
  END LOOP;
END $$;

-- Configurações: members read, owner writes
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspace_settings', 'workspace_layout', 'workspace_contract_template', 'payment_terms',
                           'service_categories', 'service_items', 'service_objectives']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.has_workspace_access(auth.uid(), workspace_id))',
      t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
         WITH CHECK (public.get_user_role(auth.uid(), workspace_id) = ''owner'')',
      t || '_insert_owner', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (public.get_user_role(auth.uid(), workspace_id) = ''owner'')
         WITH CHECK (public.get_user_role(auth.uid(), workspace_id) = ''owner'')',
      t || '_update_owner', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (public.get_user_role(auth.uid(), workspace_id) = ''owner'')',
      t || '_delete_owner', t);
  END LOOP;
END $$;

-- Logos bucket (Layout da Proposta): only the workspace owner writes
DROP POLICY IF EXISTS "logos_upload" ON storage.objects;
DROP POLICY IF EXISTS "logos_update" ON storage.objects;
DROP POLICY IF EXISTS "logos_delete" ON storage.objects;
CREATE POLICY "logos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND public.get_user_role(auth.uid(), ((storage.foldername(name))[1])::uuid) = 'owner');
CREATE POLICY "logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND public.get_user_role(auth.uid(), ((storage.foldername(name))[1])::uuid) = 'owner');
CREATE POLICY "logos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND public.get_user_role(auth.uid(), ((storage.foldername(name))[1])::uuid) = 'owner');
