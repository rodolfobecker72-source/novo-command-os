-- Permissões de administrador do sistema (ler leads do site, reports de
-- todos e seus anexos) só valem em sessão com verificação em duas etapas
-- (aal2), a mesma exigência do painel em admin.command-os.app.br.
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = _user_id)
     AND coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
