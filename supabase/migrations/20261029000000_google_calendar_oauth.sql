-- Google Agenda com OAuth próprio.
--
-- Cada usuário conecta a própria conta Google; o sistema cria nela uma agenda
-- "Command OS" e só tem acesso a essa agenda (escopo calendar.app.created).
-- Mudanças em atividades de projeto e compromissos entram numa fila via
-- trigger; um worker (edge function google-calendar-worker), chamado a cada
-- minuto pelo pg_cron, envia as mudanças ao Google. Os tokens ficam
-- criptografados e só o backend (service_role) lê estas tabelas.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- Conexões (uma por usuário)
-- ============================================================================
DROP POLICY IF EXISTS gcal_conn_own_delete ON public.google_calendar_connections;
DROP POLICY IF EXISTS gcal_conn_own_select ON public.google_calendar_connections;
DROP POLICY IF EXISTS gcal_conn_own_update ON public.google_calendar_connections;
DROP POLICY IF EXISTS gcal_conn_own_upsert ON public.google_calendar_connections;

-- Linhas do conector antigo não servem para o OAuth próprio
DELETE FROM public.google_calendar_connections;

ALTER TABLE public.google_calendar_connections
  DROP COLUMN connection_key,
  DROP COLUMN pending_session_id,
  DROP COLUMN workspace_id,
  ADD COLUMN refresh_token_enc text NOT NULL,
  ADD COLUMN access_token_enc text,
  ADD COLUMN access_token_expires_at timestamptz,
  ADD COLUMN calendar_id text NOT NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'needs_reconnect')),
  ADD COLUMN last_error text;

REVOKE ALL ON public.google_calendar_connections FROM anon, authenticated;

-- ============================================================================
-- Eventos criados no Google (um por usuário e por atividade/compromisso)
-- ============================================================================
DROP POLICY IF EXISTS gcsm_delete_own ON public.google_calendar_sync_map;
DROP POLICY IF EXISTS gcsm_insert_own ON public.google_calendar_sync_map;
DROP POLICY IF EXISTS gcsm_select_own ON public.google_calendar_sync_map;
DROP POLICY IF EXISTS gcsm_update_own ON public.google_calendar_sync_map;

DELETE FROM public.google_calendar_sync_map;

ALTER TABLE public.google_calendar_sync_map
  DROP CONSTRAINT google_calendar_sync_map_user_id_activity_id_key;
DROP INDEX IF EXISTS public.idx_gcsm_activity;
ALTER TABLE public.google_calendar_sync_map RENAME COLUMN activity_id TO source_id;
ALTER TABLE public.google_calendar_sync_map
  ADD COLUMN source_type text NOT NULL CHECK (source_type IN ('activity', 'appointment')),
  ADD CONSTRAINT google_calendar_sync_map_user_source_key UNIQUE (user_id, source_type, source_id),
  ADD CONSTRAINT google_calendar_sync_map_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_gcsm_source ON public.google_calendar_sync_map (source_type, source_id);

REVOKE ALL ON public.google_calendar_sync_map FROM anon, authenticated;

-- ============================================================================
-- Estados do OAuth (protege o retorno do Google contra CSRF; uso único)
-- ============================================================================
CREATE TABLE public.google_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_verifier text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_oauth_states FROM anon, authenticated;

-- ============================================================================
-- Fila de sincronização
-- ============================================================================
CREATE TABLE public.google_calendar_sync_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type IN ('activity', 'appointment')),
  source_id uuid NOT NULL,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  UNIQUE (source_type, source_id)
);
CREATE INDEX idx_gcal_queue_run_after ON public.google_calendar_sync_queue (run_after);
ALTER TABLE public.google_calendar_sync_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_calendar_sync_queue FROM anon, authenticated;

-- Uma mudança nova sobre um item já na fila só renova o pedido; enqueued_at
-- avisa o worker que o item mudou enquanto era processado.
CREATE FUNCTION public.gcal_enqueue(p_source_type text, p_source_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.google_calendar_sync_queue (source_type, source_id)
  VALUES (p_source_type, p_source_id)
  ON CONFLICT (source_type, source_id) DO UPDATE
    SET enqueued_at = now(), run_after = now(), attempts = 0, last_error = NULL;
$$;

CREATE FUNCTION public.gcal_any_connected(p_users uuid[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.google_calendar_connections
    WHERE user_id = ANY (p_users) AND status = 'connected'
  );
$$;

CREATE FUNCTION public.gcal_has_events(p_source_type text, p_source_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.google_calendar_sync_map
    WHERE source_type = p_source_type AND source_id = p_source_id
  );
$$;

-- Só entra na fila o que interessa a alguém conectado (ou o que já tem
-- evento no Google e precisa ser atualizado ou apagado). Workspaces sem
-- ninguém conectado não geram trabalho nenhum.
CREATE FUNCTION public.gcal_activity_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_users uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW.title, NEW.status, NEW.due_date, NEW.end_date, NEW.assigned_to_user_ids,
      NEW.assigned_to_user_id, NEW.project_card_id, NEW.is_delivery, NEW.is_captacao)
     IS NOT DISTINCT FROM
     (OLD.title, OLD.status, OLD.due_date, OLD.end_date, OLD.assigned_to_user_ids,
      OLD.assigned_to_user_id, OLD.project_card_id, OLD.is_delivery, OLD.is_captacao) THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_id := OLD.id;
  ELSE
    v_id := NEW.id;
    IF NEW.due_date IS NOT NULL THEN
      v_users := CASE WHEN cardinality(NEW.assigned_to_user_ids) > 0
                      THEN NEW.assigned_to_user_ids
                      ELSE array_remove(ARRAY[NEW.assigned_to_user_id], NULL) END;
    END IF;
  END IF;

  IF public.gcal_has_events('activity', v_id)
     OR (v_users IS NOT NULL AND public.gcal_any_connected(v_users)) THEN
    PERFORM public.gcal_enqueue('activity', v_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER gcal_activity_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.project_activities
  FOR EACH ROW EXECUTE FUNCTION public.gcal_activity_changed();

CREATE FUNCTION public.gcal_appointment_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_users uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW.title, NEW.kind, NEW.description, NEW.location, NEW.start_at, NEW.end_at,
      NEW.all_day, NEW.assigned_to, NEW.created_by)
     IS NOT DISTINCT FROM
     (OLD.title, OLD.kind, OLD.description, OLD.location, OLD.start_at, OLD.end_at,
      OLD.all_day, OLD.assigned_to, OLD.created_by) THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_id := OLD.id;
  ELSE
    v_id := NEW.id;
    v_users := array_append(NEW.assigned_to, NEW.created_by);
  END IF;

  IF public.gcal_has_events('appointment', v_id)
     OR (v_users IS NOT NULL AND public.gcal_any_connected(v_users)) THEN
    PERFORM public.gcal_enqueue('appointment', v_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER gcal_appointment_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.gcal_appointment_changed();

-- O nome do projeto e o cliente aparecem no título/descrição das atividades
CREATE FUNCTION public.gcal_project_card_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.project_name, NEW.client_name, NEW.proposal_id)
     IS DISTINCT FROM (OLD.project_name, OLD.client_name, OLD.proposal_id) THEN
    INSERT INTO public.google_calendar_sync_queue (source_type, source_id)
    SELECT 'activity', a.id
      FROM public.project_activities a
     WHERE a.project_card_id = NEW.id
       AND public.gcal_has_events('activity', a.id)
    ON CONFLICT (source_type, source_id) DO UPDATE
      SET enqueued_at = now(), run_after = now(), attempts = 0, last_error = NULL;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER gcal_project_card_sync
  AFTER UPDATE ON public.project_cards
  FOR EACH ROW EXECUTE FUNCTION public.gcal_project_card_changed();

-- Ao conectar, envia o que já existe do usuário (da última semana em diante)
CREATE FUNCTION public.gcal_enqueue_user_backfill(p_user uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.google_calendar_sync_queue (source_type, source_id)
  SELECT 'activity', a.id
    FROM public.project_activities a
   WHERE a.due_date IS NOT NULL
     AND COALESCE(a.end_date, a.due_date) >= current_date - 7
     AND (p_user = ANY (a.assigned_to_user_ids) OR a.assigned_to_user_id = p_user)
  UNION ALL
  SELECT 'appointment', ap.id
    FROM public.appointments ap
   WHERE COALESCE(ap.end_at, ap.start_at) >= now() - interval '7 days'
     AND (ap.created_by = p_user OR p_user = ANY (ap.assigned_to))
  ON CONFLICT (source_type, source_id) DO UPDATE
    SET enqueued_at = now(), run_after = now(), attempts = 0, last_error = NULL;
$$;

-- Reserva um lote para o worker; SKIP LOCKED deixa vários workers em paralelo
-- sem pegar o mesmo item.
CREATE FUNCTION public.gcal_claim_jobs(p_limit integer)
RETURNS SETOF public.google_calendar_sync_queue
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.google_calendar_sync_queue q
     SET locked_until = now() + interval '5 minutes', attempts = q.attempts + 1
   WHERE q.id IN (
     SELECT id FROM public.google_calendar_sync_queue
      WHERE run_after <= now() AND (locked_until IS NULL OR locked_until < now())
      ORDER BY run_after
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
  RETURNING q.*;
$$;

REVOKE EXECUTE ON FUNCTION
  public.gcal_enqueue(text, uuid),
  public.gcal_any_connected(uuid[]),
  public.gcal_has_events(text, uuid),
  public.gcal_activity_changed(),
  public.gcal_appointment_changed(),
  public.gcal_project_card_changed(),
  public.gcal_enqueue_user_backfill(uuid),
  public.gcal_claim_jobs(integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.gcal_enqueue_user_backfill(uuid),
  public.gcal_claim_jobs(integer)
TO service_role;

-- ============================================================================
-- Worker: a cada minuto, se houver algo na fila, chama a edge function.
-- URL e segredo ficam no Vault (gcal_worker_url, gcal_worker_secret), fora
-- do repositório.
-- ============================================================================
SELECT cron.schedule(
  'gcal-sync-worker',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'gcal_worker_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'gcal_worker_secret')
    ),
    body := '{}'::jsonb
  )
  WHERE EXISTS (
    SELECT 1 FROM public.google_calendar_sync_queue
     WHERE run_after <= now() AND (locked_until IS NULL OR locked_until < now())
  );
  $cron$
);
