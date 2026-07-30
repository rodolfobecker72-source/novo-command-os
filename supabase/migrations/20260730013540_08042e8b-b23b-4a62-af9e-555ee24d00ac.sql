CREATE TABLE public.system_admins (
  user_id UUID NOT NULL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_admins TO authenticated;
GRANT ALL ON public.system_admins TO service_role;

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can check own system admin status" ON public.system_admins
FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = _user_id)
$$;

REVOKE EXECUTE ON FUNCTION public.is_system_admin(UUID) FROM anon;

INSERT INTO public.system_admins (user_id)
SELECT id FROM auth.users WHERE email IN ('adm@hero.rec.br', 'rodolfobecker72@gmail.com')
ON CONFLICT DO NOTHING;