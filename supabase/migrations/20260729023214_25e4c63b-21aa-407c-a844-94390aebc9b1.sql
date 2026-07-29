
CREATE TABLE public.google_calendar_connections (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,
  connection_key TEXT,
  pending_session_id TEXT,
  email TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO authenticated;
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gcal_conn_own_select" ON public.google_calendar_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "gcal_conn_own_upsert" ON public.google_calendar_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gcal_conn_own_update" ON public.google_calendar_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gcal_conn_own_delete" ON public.google_calendar_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_gcal_conn_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
