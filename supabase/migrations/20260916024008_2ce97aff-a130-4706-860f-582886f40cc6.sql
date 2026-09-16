-- 1) Workspace-scoped role helper
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid, _workspace_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.workspace_members
  WHERE user_id = _user_id AND workspace_id = _workspace_id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_user_role(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid, uuid) TO authenticated, service_role;

-- helper: does the workspace already have members?
CREATE OR REPLACE FUNCTION public.workspace_has_members(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id)
$$;

REVOKE ALL ON FUNCTION public.workspace_has_members(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.workspace_has_members(uuid) TO authenticated, service_role;

-- 2) Block owner self-escalation into existing workspaces
DROP POLICY IF EXISTS workspace_members_insert_owner ON public.workspace_members;
CREATE POLICY workspace_members_insert_owner ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'::app_role
    AND NOT public.workspace_has_members(workspace_id)
    AND EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.created_by = auth.uid()
    )
  );

-- 3) Workspace-scoped role checks in existing policies
DROP POLICY IF EXISTS workspace_members_update ON public.workspace_members;
CREATE POLICY workspace_members_update ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid(), workspace_id) = 'owner'::app_role);

DROP POLICY IF EXISTS workspace_members_delete ON public.workspace_members;
CREATE POLICY workspace_members_delete ON public.workspace_members
  FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid(), workspace_id) = 'owner'::app_role);

DROP POLICY IF EXISTS monthly_goals_insert ON public.monthly_goals;
CREATE POLICY monthly_goals_insert ON public.monthly_goals
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid(), workspace_id) = 'owner'::app_role);

DROP POLICY IF EXISTS monthly_goals_update ON public.monthly_goals;
CREATE POLICY monthly_goals_update ON public.monthly_goals
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid(), workspace_id) = 'owner'::app_role);

DROP POLICY IF EXISTS monthly_goals_delete ON public.monthly_goals;
CREATE POLICY monthly_goals_delete ON public.monthly_goals
  FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid(), workspace_id) = 'owner'::app_role);

DROP POLICY IF EXISTS workspace_invites_insert ON public.workspace_invites;
CREATE POLICY workspace_invites_insert ON public.workspace_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::app_role, 'admin'::app_role]));

DROP POLICY IF EXISTS workspace_invites_update ON public.workspace_invites;
CREATE POLICY workspace_invites_update ON public.workspace_invites
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::app_role, 'admin'::app_role]));

DROP POLICY IF EXISTS workspace_invites_delete ON public.workspace_invites;
CREATE POLICY workspace_invites_delete ON public.workspace_invites
  FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::app_role, 'admin'::app_role]));

-- 4) Landing leads readable only by owners/admins
DROP POLICY IF EXISTS authenticated_can_select_landing_leads ON public.landing_leads;
CREATE POLICY authenticated_can_select_landing_leads ON public.landing_leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 5) Logos scoped to the owning workspace folder
DROP POLICY IF EXISTS logos_upload ON storage.objects;
CREATE POLICY logos_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND public.has_workspace_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS logos_update ON storage.objects;
CREATE POLICY logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.has_workspace_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS logos_delete ON storage.objects;
CREATE POLICY logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.has_workspace_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );