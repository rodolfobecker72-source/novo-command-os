ALTER TABLE public.payment_terms ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, (row_number() OVER (PARTITION BY workspace_id ORDER BY created_at, id) - 1)::integer AS position
  FROM public.payment_terms
)
UPDATE public.payment_terms t SET sort_order = ranked.position FROM ranked WHERE t.id = ranked.id;
CREATE OR REPLACE FUNCTION public.reorder_payment_terms(p_workspace_id uuid, p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) <> (SELECT count(*) FROM public.payment_terms WHERE workspace_id = p_workspace_id)
     OR cardinality(p_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ids) id)
     OR EXISTS (SELECT 1 FROM unnest(p_ids) id WHERE NOT EXISTS (SELECT 1 FROM public.payment_terms t WHERE t.id = id AND t.workspace_id = p_workspace_id)) THEN
    RAISE EXCEPTION 'Invalid payment terms ordering';
  END IF;
  UPDATE public.payment_terms t SET sort_order = ordered.position - 1, updated_at = now()
  FROM unnest(p_ids) WITH ORDINALITY AS ordered(id, position)
  WHERE t.id = ordered.id AND t.workspace_id = p_workspace_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reorder_payment_terms(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_payment_terms(uuid, uuid[]) TO authenticated, service_role;