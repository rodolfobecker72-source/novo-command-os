CREATE TABLE public.team_finance_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_finance_access TO authenticated;
GRANT ALL ON public.team_finance_access TO service_role;
ALTER TABLE public.team_finance_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view team finance access"
  ON public.team_finance_access FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid(), workspace_id));
CREATE POLICY "Owner/admin manage team finance access"
  ON public.team_finance_access FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = team_finance_access.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = team_finance_access.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner','admin')
  ));
CREATE TRIGGER update_team_finance_access_updated_at BEFORE UPDATE ON public.team_finance_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();