CREATE TABLE public.historical_project_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  history_key text NOT NULL,
  link text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, history_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historical_project_links TO authenticated;
GRANT ALL ON public.historical_project_links TO service_role;

ALTER TABLE public.historical_project_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view historical links of their workspace"
  ON public.historical_project_links FOR SELECT TO authenticated
  USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can insert historical links in their workspace"
  ON public.historical_project_links FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can update historical links in their workspace"
  ON public.historical_project_links FOR UPDATE TO authenticated
  USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can delete historical links in their workspace"
  ON public.historical_project_links FOR DELETE TO authenticated
  USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE TRIGGER update_historical_project_links_updated_at
  BEFORE UPDATE ON public.historical_project_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();