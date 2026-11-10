-- E-mail guests on appointments. Google sends them the invitation from the
-- organizer's "Command OS" calendar; team members keep being added as
-- participants (assigned_to), which puts the appointment in their own calendar.
ALTER TABLE public.appointments
  ADD COLUMN guest_emails text[] NOT NULL DEFAULT '{}' CHECK (cardinality(guest_emails) <= 50);

CREATE OR REPLACE FUNCTION public.gcal_appointment_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_users uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND
     (NEW.title, NEW.kind, NEW.description, NEW.location, NEW.start_at, NEW.end_at,
      NEW.all_day, NEW.assigned_to, NEW.created_by, NEW.guest_emails)
     IS NOT DISTINCT FROM
     (OLD.title, OLD.kind, OLD.description, OLD.location, OLD.start_at, OLD.end_at,
      OLD.all_day, OLD.assigned_to, OLD.created_by, OLD.guest_emails) THEN
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
REVOKE EXECUTE ON FUNCTION public.gcal_appointment_changed() FROM PUBLIC, anon, authenticated;
