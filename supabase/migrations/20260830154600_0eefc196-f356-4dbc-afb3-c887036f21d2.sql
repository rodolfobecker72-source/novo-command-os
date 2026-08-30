CREATE TABLE public.archived_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  project_number text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  source_card_id uuid,
  archived_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archived_projects TO authenticated;
GRANT ALL ON public.archived_projects TO service_role;

ALTER TABLE public.archived_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view archived projects"
ON public.archived_projects FOR SELECT TO authenticated
USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can insert archived projects"
ON public.archived_projects FOR INSERT TO authenticated
WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can update archived projects"
ON public.archived_projects FOR UPDATE TO authenticated
USING (public.has_workspace_access(auth.uid(), workspace_id))
WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can delete archived projects"
ON public.archived_projects FOR DELETE TO authenticated
USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE TRIGGER update_archived_projects_updated_at
BEFORE UPDATE ON public.archived_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_archived_projects_ws_group ON public.archived_projects(workspace_id, group_name);

ALTER TABLE public.project_cards ADD COLUMN archived_at timestamptz;