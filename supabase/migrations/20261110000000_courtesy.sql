-- Courtesy: full access with no charge, granted by the Command OS team.
ALTER TABLE public.workspace_subscriptions DROP CONSTRAINT workspace_subscriptions_status_check;
ALTER TABLE public.workspace_subscriptions ADD CONSTRAINT workspace_subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'courtesy'));

CREATE OR REPLACE FUNCTION private.workspace_access(p_workspace_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN s.workspace_id IS NULL THEN 'full'
    WHEN s.status IN ('active', 'courtesy') THEN 'full'
    WHEN s.status = 'trialing' AND now() < s.trial_ends_at THEN 'full'
    WHEN s.status = 'past_due' AND now() < coalesce(s.past_due_since, now()) + interval '3 days' THEN 'full'
    -- cancelada: vale o que já foi pago ou o teste que ainda corre
    WHEN s.status = 'canceled' AND now() < greatest(s.current_period_end, s.trial_ends_at) THEN 'full'
    ELSE 'read_only'
  END
  FROM (SELECT p_workspace_id AS id) w
  LEFT JOIN public.workspace_subscriptions s ON s.workspace_id = w.id
$$;
