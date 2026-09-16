CREATE TABLE public.lead_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  "order" integer NOT NULL DEFAULT 0,
  role text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_statuses TO authenticated;
GRANT ALL ON public.lead_statuses TO service_role;

ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view lead statuses" ON public.lead_statuses
  FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));
CREATE POLICY "Members can create lead statuses" ON public.lead_statuses
  FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));
CREATE POLICY "Members can update lead statuses" ON public.lead_statuses
  FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id))
  WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));
CREATE POLICY "Members can delete lead statuses" ON public.lead_statuses
  FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE TRIGGER lead_statuses_updated_at BEFORE UPDATE ON public.lead_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_lead_statuses_workspace ON public.lead_statuses(workspace_id, "order");

INSERT INTO public.lead_statuses (workspace_id, key, label, color, "order", role, is_default)
SELECT w.id, d.key, d.label, d.color, d.ord, d.role, true
FROM public.workspaces w
CROSS JOIN (VALUES
  ('mapeado', 'Mapeado', 'slate', 0, NULL),
  ('contato_realizado', 'Contato Realizado', 'blue', 1, NULL),
  ('reuniao_agendada', 'Reunião Agendada', 'amber', 2, 'meeting'),
  ('qualificado_crm', 'Qualificado para CRM', 'green', 3, 'qualified'),
  ('nutricao', 'Nutrição', 'violet', 4, NULL)
) AS d(key, label, color, ord, role)
ON CONFLICT (workspace_id, key) DO NOTHING;

UPDATE public.prospection_leads SET funnel_status = 'mapeado' WHERE funnel_status = 'perdido';