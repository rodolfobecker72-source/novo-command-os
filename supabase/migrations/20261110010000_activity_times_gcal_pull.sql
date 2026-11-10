-- 1. Optional start and end time on project activities (without them the
--    activity stays an all-day event, as before).
-- 2. Reading the "Command OS" calendar back: events people add or change in
--    Google become appointments in Command OS. Each connection keeps Google's
--    incremental sync token; a pg_cron job asks the worker to pull every two
--    minutes while someone is connected.

ALTER TABLE public.project_activities
  ADD COLUMN start_time time,
  ADD COLUMN end_time time,
  ADD CONSTRAINT project_activities_end_time_needs_start CHECK (end_time IS NULL OR start_time IS NOT NULL);

ALTER TABLE public.google_calendar_connections
  ADD COLUMN sync_token text,
  ADD COLUMN pulled_at timestamptz;

-- 'google': the appointment was created from an event typed in Google
ALTER TABLE public.google_calendar_sync_map
  ADD COLUMN origin text NOT NULL DEFAULT 'command' CHECK (origin IN ('command', 'google'));
CREATE INDEX idx_gcsm_user_event ON public.google_calendar_sync_map (user_id, google_event_id);

-- The activity's hours now go to Google too
CREATE OR REPLACE FUNCTION public.gcal_activity_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_users uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW.title, NEW.status, NEW.due_date, NEW.end_date, NEW.start_time, NEW.end_time, NEW.assigned_to_user_ids,
      NEW.assigned_to_user_id, NEW.project_card_id, NEW.is_delivery, NEW.is_captacao)
     IS NOT DISTINCT FROM
     (OLD.title, OLD.status, OLD.due_date, OLD.end_date, OLD.start_time, OLD.end_time, OLD.assigned_to_user_ids,
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
REVOKE EXECUTE ON FUNCTION public.gcal_activity_changed() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'gcal-pull-worker',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'gcal_worker_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'gcal_worker_secret')
    ),
    body := '{"mode":"pull"}'::jsonb
  )
  WHERE EXISTS (SELECT 1 FROM public.google_calendar_connections WHERE status = 'connected');
  $cron$
);
