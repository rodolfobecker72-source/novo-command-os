-- Assinaturas do Command OS (Fase 4 da auditoria, item 14), cobradas pelo Asaas.
--
-- Cada empresa tem uma assinatura. Ao ser criada, a empresa ganha 7 dias de teste.
-- Situações:
--   trialing   teste em andamento (acesso completo até trial_ends_at)
--   active     assinatura em dia
--   past_due   mensalidade vencida: acesso completo por mais 3 dias a partir do vencimento
--   canceled   cancelada: acesso completo até o fim do período já pago (ou do teste)
-- Fora disso a empresa fica em somente leitura: os dados continuam visíveis, mas o
-- banco recusa criar, editar ou apagar (o proprietário ainda consegue assinar).
-- O plano define o limite de usuários por empresa.
-- Quem altera a assinatura é só o backend (edge functions com service_role), a partir
-- dos avisos (webhooks) do Asaas.

-- ============================================================================
-- Planos
-- ============================================================================
CREATE TABLE public.billing_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric(10, 2) NOT NULL,
  max_users integer,               -- NULL = sem limite
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.billing_plans (id, name, price, max_users) VALUES ('mensal', 'Command OS', 127.90, 8);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_plans FROM anon, authenticated;
GRANT SELECT ON public.billing_plans TO authenticated;
CREATE POLICY billing_plans_select ON public.billing_plans FOR SELECT TO authenticated USING (active);

-- ============================================================================
-- Assinatura de cada empresa
-- ============================================================================
CREATE TABLE public.workspace_subscriptions (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE,
  plan_id text NOT NULL DEFAULT 'mensal' REFERENCES public.billing_plans (id),
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  current_period_end timestamptz,
  past_due_since timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_checkout_id text,
  checkout_url text,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ws_subscriptions_customer ON public.workspace_subscriptions (asaas_customer_id);
CREATE INDEX idx_ws_subscriptions_subscription ON public.workspace_subscriptions (asaas_subscription_id);
CREATE INDEX idx_ws_subscriptions_checkout ON public.workspace_subscriptions (asaas_checkout_id);
CREATE INDEX idx_ws_subscriptions_plan ON public.workspace_subscriptions (plan_id);

CREATE TRIGGER update_workspace_subscriptions_updated_at
  BEFORE UPDATE ON public.workspace_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_subscriptions FROM anon, authenticated;

-- Avisos recebidos do Asaas (o id do evento garante que cada aviso conta uma vez só)
CREATE TABLE public.billing_events (
  id text PRIMARY KEY,
  event text NOT NULL,
  workspace_id uuid REFERENCES public.workspaces (id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX idx_billing_events_workspace ON public.billing_events (workspace_id);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_events FROM anon, authenticated;

-- Toda empresa nova começa em teste; as que já existem também
CREATE FUNCTION private.create_workspace_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.workspace_subscriptions (workspace_id) VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER create_workspace_subscription
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION private.create_workspace_subscription();

INSERT INTO public.workspace_subscriptions (workspace_id)
SELECT id FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- ============================================================================
-- Acesso conforme a assinatura
-- ============================================================================
CREATE FUNCTION private.workspace_access(p_workspace_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN s.workspace_id IS NULL THEN 'full'
    WHEN s.status = 'active' THEN 'full'
    WHEN s.status = 'trialing' AND now() < s.trial_ends_at THEN 'full'
    WHEN s.status = 'past_due' AND now() < coalesce(s.past_due_since, now()) + interval '3 days' THEN 'full'
    -- cancelada: vale o que já foi pago ou o teste que ainda corre
    WHEN s.status = 'canceled' AND now() < greatest(s.current_period_end, s.trial_ends_at) THEN 'full'
    ELSE 'read_only'
  END
  FROM (SELECT p_workspace_id AS id) w
  LEFT JOIN public.workspace_subscriptions s ON s.workspace_id = w.id
$$;

-- Somente leitura: o banco recusa escrever nos dados da empresa. Vale para chamadas
-- de usuários logados; o backend (service_role) e o SQL Editor não passam por aqui.
CREATE FUNCTION private.enforce_workspace_writable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF coalesce((SELECT auth.role()), '') <> 'authenticated' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN v_workspace_id := OLD.workspace_id; ELSE v_workspace_id := NEW.workspace_id; END IF;
  IF private.workspace_access(v_workspace_id) = 'read_only' THEN
    RAISE EXCEPTION 'Empresa em modo somente leitura: a assinatura do Command OS está pendente. O proprietário pode regularizar em Assinatura.'
      USING ERRCODE = 'insufficient_privilege', HINT = 'subscription_read_only';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;

-- Todas as tabelas com dados da empresa, exceto reports de feedback, equipe e convites
-- (o proprietário pode ajustar a equipe mesmo em somente leitura) e o mapa interno da
-- Google Agenda.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public' AND c.column_name = 'workspace_id'
       AND c.table_name NOT IN ('feedback_reports', 'workspace_members', 'workspace_invites',
                                'google_calendar_sync_map', 'billing_events')
  LOOP
    EXECUTE format(
      'CREATE TRIGGER enforce_workspace_writable BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION private.enforce_workspace_writable()', t);
  END LOOP;
END $$;

-- Limite de usuários do plano
CREATE FUNCTION private.enforce_member_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  -- Serializa inclusões simultâneas na mesma empresa
  SELECT p.max_users INTO v_limit
    FROM public.workspace_subscriptions s
    JOIN public.billing_plans p ON p.id = s.plan_id
   WHERE s.workspace_id = NEW.workspace_id
     FOR UPDATE OF s;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_count FROM public.workspace_members WHERE workspace_id = NEW.workspace_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % usuários do plano atingido', v_limit
      USING ERRCODE = 'check_violation', HINT = 'member_limit';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enforce_member_limit
  BEFORE INSERT ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION private.enforce_member_limit();

REVOKE ALL ON FUNCTION private.create_workspace_subscription(), private.workspace_access(uuid),
  private.enforce_workspace_writable(), private.enforce_member_limit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.workspace_access(uuid) TO authenticated, service_role;

-- ============================================================================
-- Situação da assinatura para o app (todos da empresa leem; só o proprietário vê ids do Asaas)
-- ============================================================================
CREATE FUNCTION public.my_subscription()
RETURNS TABLE (
  status text, access text, trial_ends_at timestamptz, current_period_end timestamptz,
  past_due_since timestamptz, read_only_at timestamptz, canceled_at timestamptz,
  plan_name text, price numeric, max_users integer, member_count integer, has_card boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.status,
         private.workspace_access(s.workspace_id),
         s.trial_ends_at, s.current_period_end, s.past_due_since,
         CASE s.status
           WHEN 'trialing' THEN s.trial_ends_at
           WHEN 'past_due' THEN coalesce(s.past_due_since, now()) + interval '3 days'
           WHEN 'canceled' THEN greatest(s.current_period_end, s.trial_ends_at)
         END,
         s.canceled_at,
         p.name, p.price, p.max_users,
         (SELECT count(*)::integer FROM public.workspace_members m WHERE m.workspace_id = s.workspace_id),
         s.asaas_subscription_id IS NOT NULL
    FROM public.workspace_subscriptions s
    JOIN public.billing_plans p ON p.id = s.plan_id
   WHERE s.workspace_id = (SELECT private.my_workspace_id())
$$;
REVOKE ALL ON FUNCTION public.my_subscription() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_subscription() TO authenticated;

-- ============================================================================
-- Painel do Command OS: situação da assinatura de cada empresa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_workspace_overview()
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
                 'projects', (SELECT count(*) FROM public.project_cards pc WHERE pc.workspace_id = w.id),
                 'subscription', (
                   SELECT jsonb_build_object(
                            'status', s.status,
                            'access', private.workspace_access(s.workspace_id),
                            'trial_ends_at', s.trial_ends_at,
                            'current_period_end', s.current_period_end,
                            'past_due_since', s.past_due_since,
                            'price', p.price)
                     FROM public.workspace_subscriptions s
                     JOIN public.billing_plans p ON p.id = s.plan_id
                    WHERE s.workspace_id = w.id)
               ) ORDER BY mb.last_seen_at DESC NULLS LAST, w.created_at DESC
             )
        FROM public.workspaces w
        LEFT JOIN members mb ON mb.workspace_id = w.id
    ), '[]'::jsonb)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.admin_workspace_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_workspace_overview() TO service_role;
