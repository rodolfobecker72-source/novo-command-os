-- Fase 1 da auditoria (docs/AUDITORIA.md): itens 3, 4, 5, 6, 7 e 8.
--
-- 5: uma pessoa pertence a uma única empresa (UNIQUE em workspace_members.user_id).
-- 7: as regras de acesso passam a descobrir a empresa e o papel do usuário UMA vez
--    por consulta (private.my_workspace_id() / private.my_role() dentro de SELECT,
--    avaliados como initplan), em vez de chamar uma função por linha.
-- 6: as funções auxiliares de permissão saem da API (schema private, que o
--    PostgREST não expõe) e as antigas em public perdem o EXECUTE.
-- 3: a empresa sempre tem exatamente um proprietário.
-- 4: só o proprietário gerencia convites.
-- 8: índices para as 16 chaves estrangeiras sem cobertura.

-- ============================================================================
-- 5. Uma empresa por pessoa
-- ============================================================================
ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_user_id_key UNIQUE (user_id);

-- ============================================================================
-- Funções auxiliares (fora da API)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE FUNCTION private.my_workspace_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
$$;

CREATE FUNCTION private.my_role() RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
$$;

-- Administrador do sistema, só com verificação em duas etapas (aal2)
CREATE FUNCTION private.is_system_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = (SELECT auth.uid()))
     AND coalesce((SELECT auth.jwt()) ->> 'aal', '') = 'aal2'
$$;

CREATE FUNCTION private.workspace_has_members(_workspace_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id)
$$;

-- Foto de perfil: a própria pasta, ou a de alguém da equipe quando quem envia é o proprietário
CREATE FUNCTION private.can_manage_avatar(_folder text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _folder = (SELECT auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.workspace_members target
         WHERE target.user_id::text = _folder
           AND target.workspace_id = (SELECT private.my_workspace_id())
           AND (SELECT private.my_role()) = 'owner'
      )
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- ============================================================================
-- 7. Regras de acesso do schema public
-- ============================================================================
DO $$
DECLARE
  p record;
  q text;
  w text;
  stmt text;

  FUNCTION_SWAPS CONSTANT text[][] := ARRAY[
    -- membro da empresa
    ARRAY['has_workspace_access\(auth\.uid\(\), ([a-z_]+)\)',
          '(\1 = (SELECT private.my_workspace_id()))'],
    -- papel na empresa
    ARRAY['get_user_role\(auth\.uid\(\), ([a-z_]+)\) (= ANY \(ARRAY\[[^]]*\]\)|= ''[a-z_]+''::app_role)',
          '(\1 = (SELECT private.my_workspace_id()) AND (SELECT private.my_role()) \2)'],
    ARRAY['is_system_admin\(auth\.uid\(\)\)', '(SELECT private.is_system_admin())'],
    ARRAY['(?<!private\.)workspace_has_members\(', 'private.workspace_has_members('],
    -- o resto: auth.uid() avaliado uma vez por consulta
    ARRAY['(?<!SELECT )auth\.uid\(\)', '(SELECT auth.uid())']
  ];
  i int;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies WHERE schemaname = 'public'
  LOOP
    q := p.qual;
    w := p.with_check;
    FOR i IN 1 .. array_length(FUNCTION_SWAPS, 1) LOOP
      q := regexp_replace(q, FUNCTION_SWAPS[i][1], FUNCTION_SWAPS[i][2], 'g');
      w := regexp_replace(w, FUNCTION_SWAPS[i][1], FUNCTION_SWAPS[i][2], 'g');
    END LOOP;

    IF q IS DISTINCT FROM p.qual OR w IS DISTINCT FROM p.with_check THEN
      stmt := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
      IF q IS NOT NULL THEN stmt := stmt || format(' USING (%s)', q); END IF;
      IF w IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', w); END IF;
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;

-- Colegas de equipe: uma única regra, com a empresa calculada uma vez
ALTER POLICY profiles_select_peers ON public.profiles
  USING (
    id = (SELECT auth.uid())
    OR id IN (
      SELECT wm.user_id FROM public.workspace_members wm
       WHERE wm.workspace_id = (SELECT private.my_workspace_id())
    )
  );
DROP POLICY profiles_select_own ON public.profiles;

-- ============================================================================
-- 4. Convites: só o proprietário
-- ============================================================================
ALTER POLICY workspace_invites_insert ON public.workspace_invites
  WITH CHECK (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.my_role()) = 'owner');
ALTER POLICY workspace_invites_update ON public.workspace_invites
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.my_role()) = 'owner');
ALTER POLICY workspace_invites_delete ON public.workspace_invites
  USING (workspace_id = (SELECT private.my_workspace_id()) AND (SELECT private.my_role()) = 'owner');

-- ============================================================================
-- Arquivos (storage): mesmas regras, empresa calculada uma vez
-- ============================================================================
ALTER POLICY "Users can view own feedback images" ON storage.objects
  USING (bucket_id = 'feedback-images'
         AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR (SELECT private.is_system_admin())));
ALTER POLICY "Users can upload own feedback images" ON storage.objects
  WITH CHECK (bucket_id = 'feedback-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

ALTER POLICY avatars_auth_upload ON storage.objects
  WITH CHECK (bucket_id = 'avatars' AND private.can_manage_avatar((storage.foldername(name))[1]));
ALTER POLICY avatars_auth_update ON storage.objects
  USING (bucket_id = 'avatars' AND private.can_manage_avatar((storage.foldername(name))[1]));
ALTER POLICY avatars_auth_delete ON storage.objects
  USING (bucket_id = 'avatars' AND private.can_manage_avatar((storage.foldername(name))[1]));

ALTER POLICY budget_docs_select ON storage.objects
  USING (bucket_id = 'budget-documents' AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text);
ALTER POLICY budget_docs_insert ON storage.objects
  WITH CHECK (bucket_id = 'budget-documents' AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text);
ALTER POLICY budget_docs_update ON storage.objects
  USING (bucket_id = 'budget-documents' AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text);
ALTER POLICY budget_docs_delete ON storage.objects
  USING (bucket_id = 'budget-documents' AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text);

ALTER POLICY logos_upload ON storage.objects
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text
              AND (SELECT private.my_role()) = 'owner');
ALTER POLICY logos_update ON storage.objects
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text
         AND (SELECT private.my_role()) = 'owner');
ALTER POLICY logos_delete ON storage.objects
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = (SELECT private.my_workspace_id())::text
         AND (SELECT private.my_role()) = 'owner');

-- ============================================================================
-- 3. Sempre um único proprietário
-- ============================================================================
CREATE UNIQUE INDEX workspace_members_one_owner ON public.workspace_members (workspace_id)
  WHERE role = 'owner';

CREATE FUNCTION private.protect_workspace_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Um membro não pode ser movido para outra empresa'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
      RAISE EXCEPTION 'A empresa precisa de um proprietário: o papel do proprietário não pode ser alterado'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- O proprietário só sai junto com a empresa ou com a própria conta
  IF OLD.role = 'owner'
     AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = OLD.workspace_id)
     AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
    RAISE EXCEPTION 'O proprietário não pode ser removido da empresa'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER protect_workspace_owner
  BEFORE UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION private.protect_workspace_owner();

-- ============================================================================
-- 6. Funções antigas fora da API
-- ============================================================================
REVOKE EXECUTE ON FUNCTION
  public.has_workspace_access(uuid, uuid),
  public.get_user_role(uuid),
  public.get_user_role(uuid, uuid),
  public.has_role(uuid, public.app_role),
  public.get_user_workspace(uuid),
  public.workspace_has_members(uuid),
  public.can_manage_avatar(uuid, text),
  public.is_system_admin(uuid)
FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 8. Índices das chaves estrangeiras
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_assets_workspace_id ON public.assets (workspace_id);
CREATE INDEX IF NOT EXISTS idx_budgets_contact_id ON public.budgets (contact_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_account_id ON public.cashflow_entries (account_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_cost_center_id ON public.cashflow_entries (cost_center_id);
CREATE INDEX IF NOT EXISTS idx_cashflow_entries_revenue_center_id ON public.cashflow_entries (revenue_center_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_workspace_id ON public.client_contacts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_workspace_id ON public.cost_centers (workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_account_id ON public.credit_cards (account_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_workspace_id ON public.credit_cards (workspace_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_workspace_id ON public.financial_accounts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_user_id ON public.google_oauth_states (user_id);
CREATE INDEX IF NOT EXISTS idx_hard_drives_workspace_id ON public.hard_drives (workspace_id);
CREATE INDEX IF NOT EXISTS idx_legacy_projects_workspace_id ON public.legacy_projects (workspace_id);
CREATE INDEX IF NOT EXISTS idx_revenue_centers_workspace_id ON public.revenue_centers (workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_finance_access_user_id ON public.team_finance_access (user_id);

-- ============================================================================
-- Conferência: nenhuma regra ainda usa as funções antigas ou auth.uid() por linha
-- ============================================================================
DO $$
DECLARE leftovers text;
BEGIN
  SELECT string_agg(schemaname || '.' || tablename || ': ' || policyname, '; ') INTO leftovers
    FROM pg_policies
   WHERE schemaname IN ('public', 'storage')
     AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~
         '(has_workspace_access|get_user_role|(?<!private\.)is_system_admin|(?<!private\.)can_manage_avatar|(?<!private\.)workspace_has_members)\(|(?<!SELECT )auth\.uid\(\)';
  IF leftovers IS NOT NULL THEN
    RAISE EXCEPTION 'Regras ainda não convertidas: %', leftovers;
  END IF;
END $$;
