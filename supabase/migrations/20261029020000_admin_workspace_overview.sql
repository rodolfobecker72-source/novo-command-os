-- Painel do administrador do sistema: um resumo por empresa calculado no
-- banco (contagens por índice, sem carregar as linhas no backend).
--
-- "Último acesso" de um usuário é o mais recente entre o login e a última
-- renovação de sessão: quem fica com o sistema aberto renova a sessão a
-- cada hora sem fazer login de novo.
CREATE FUNCTION public.admin_workspace_overview()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH seen AS (
    SELECT u.id AS user_id,
           u.email,
           GREATEST(
             u.last_sign_in_at,
             max(s.updated_at),
             max(s.refreshed_at AT TIME ZONE 'UTC')
           ) AS last_seen_at
      FROM auth.users u
      LEFT JOIN auth.sessions s ON s.user_id = u.id
     GROUP BY u.id
  ),
  members AS (
    SELECT m.workspace_id,
           jsonb_agg(
             jsonb_build_object(
               'user_id', m.user_id,
               'role', m.role,
               'joined_at', m.joined_at,
               'name', coalesce(p.name, ''),
               'email', coalesce(seen.email, ''),
               'last_seen_at', seen.last_seen_at
             ) ORDER BY (m.role = 'owner') DESC, seen.last_seen_at DESC NULLS LAST
           ) AS users,
           count(*) AS user_count,
           count(*) FILTER (WHERE seen.last_seen_at >= now() - interval '30 days') AS active_users,
           max(seen.last_seen_at) AS last_seen_at
      FROM public.workspace_members m
      LEFT JOIN seen ON seen.user_id = m.user_id
      LEFT JOIN public.profiles p ON p.id = m.user_id
     GROUP BY m.workspace_id
  )
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM auth.users),
    'workspaces', coalesce((
      SELECT jsonb_agg(
               jsonb_build_object(
                 'id', w.id,
                 'name', w.name,
                 'created_at', w.created_at,
                 'users', coalesce(mb.users, '[]'::jsonb),
                 'user_count', coalesce(mb.user_count, 0),
                 'active_users', coalesce(mb.active_users, 0),
                 'last_seen_at', mb.last_seen_at,
                 'clients', (SELECT count(*) FROM public.clients c WHERE c.workspace_id = w.id),
                 'budgets', (SELECT count(*) FROM public.budgets b WHERE b.workspace_id = w.id),
                 'leads', (SELECT count(*) FROM public.prospection_leads l WHERE l.workspace_id = w.id),
                 'projects', (SELECT count(*) FROM public.project_cards pc WHERE pc.workspace_id = w.id)
               ) ORDER BY mb.last_seen_at DESC NULLS LAST, w.created_at DESC
             )
        FROM public.workspaces w
        LEFT JOIN members mb ON mb.workspace_id = w.id
    ), '[]'::jsonb)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.admin_workspace_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_workspace_overview() TO service_role;
