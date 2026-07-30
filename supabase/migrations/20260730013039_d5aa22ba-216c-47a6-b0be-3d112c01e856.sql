CREATE TABLE public.feedback_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  workspace_name TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'sugestao',
  rating INTEGER,
  message TEXT NOT NULL,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_reports TO authenticated;
GRANT ALL ON public.feedback_reports TO service_role;

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own feedback" ON public.feedback_reports
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON public.feedback_reports
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback" ON public.feedback_reports
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete feedback" ON public.feedback_reports
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_feedback_reports_updated_at BEFORE UPDATE ON public.feedback_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();