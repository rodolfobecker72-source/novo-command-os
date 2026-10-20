CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY cc_select ON public.client_contacts FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));
CREATE POLICY cc_insert ON public.client_contacts FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));
CREATE POLICY cc_update ON public.client_contacts FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));
CREATE POLICY cc_delete ON public.client_contacts FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));
CREATE INDEX client_contacts_client_idx ON public.client_contacts(client_id);
CREATE TRIGGER update_client_contacts_updated_at BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.client_contacts (workspace_id, client_id, name, email, phone, is_primary, "order")
SELECT workspace_id, id, responsible_person, email, phone, true, 0 FROM public.clients;
ALTER TABLE public.budgets ADD COLUMN contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL;