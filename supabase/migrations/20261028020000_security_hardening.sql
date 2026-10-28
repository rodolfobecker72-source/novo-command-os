-- Security hardening (audit 2026-10-28)
--
-- has_role(uid, role) ignores the workspace, so being owner/admin of ANY
-- workspace (anyone can self-register at /cadastro) granted access to data
-- that belongs to the platform, not to a workspace. Those rows are read by the
-- system admin through the admin-overview edge function (service role), so the
-- client-side policies only need to cover the row's own author.

-- 1. landing_leads: only system admins may read
DROP POLICY IF EXISTS "authenticated_can_select_landing_leads" ON public.landing_leads;
DROP POLICY IF EXISTS "system_admins_can_select_landing_leads" ON public.landing_leads;
CREATE POLICY "system_admins_can_select_landing_leads" ON public.landing_leads
  FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- 2. feedback_reports: author sees own rows; system admins manage all
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback_reports;
DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback_reports;
DROP POLICY IF EXISTS "Admins can delete feedback" ON public.feedback_reports;
CREATE POLICY "Users can view own feedback" ON public.feedback_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "System admins can update feedback" ON public.feedback_reports;
CREATE POLICY "System admins can update feedback" ON public.feedback_reports
  FOR UPDATE TO authenticated
  USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS "System admins can delete feedback" ON public.feedback_reports;
CREATE POLICY "System admins can delete feedback" ON public.feedback_reports
  FOR DELETE TO authenticated
  USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own feedback images" ON storage.objects;
CREATE POLICY "Users can view own feedback images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-images'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_system_admin(auth.uid()))
  );

-- 3. logos bucket: the unscoped policies let any logged-in user overwrite or
--    delete any workspace's logo/PDF covers. The workspace-scoped
--    logos_upload / logos_update / logos_delete policies remain.
DROP POLICY IF EXISTS "logos_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "logos_auth_delete" ON storage.objects;

-- 4. avatars bucket: files live at <user_id>/avatar.<ext>. Allow the user
--    themself, or the owner of a workspace the user belongs to (UsersPage).
DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;

CREATE OR REPLACE FUNCTION public.can_manage_avatar(_user_id uuid, _folder text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _folder = _user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members target
      JOIN public.workspace_members caller ON caller.workspace_id = target.workspace_id
      WHERE target.user_id::text = _folder
        AND caller.user_id = _user_id
        AND caller.role = 'owner'
    )
$$;

CREATE POLICY "avatars_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND public.can_manage_avatar(auth.uid(), (storage.foldername(name))[1]));
CREATE POLICY "avatars_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND public.can_manage_avatar(auth.uid(), (storage.foldername(name))[1]));
CREATE POLICY "avatars_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND public.can_manage_avatar(auth.uid(), (storage.foldername(name))[1]));

-- 5. handle_signup_workspace: a user who already belongs to a workspace
--    (e.g. a vendedor) could call it again and become owner of a second
--    workspace, which also made the app load an arbitrary workspace for them.
CREATE OR REPLACE FUNCTION public.handle_signup_workspace(workspace_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'User already belongs to a workspace';
  END IF;

  IF coalesce(trim(workspace_name), '') = '' THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  INSERT INTO public.workspaces (name, created_by)
  VALUES (trim(workspace_name), auth.uid())
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, auth.uid(), 'owner');

  RETURN new_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_signup_workspace(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_signup_workspace(text) TO authenticated;

-- 6. workspaces: only the owner may rename/update the workspace row
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid(), id) = 'owner');
