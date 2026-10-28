-- Colunas do CRM: cada workspace tem no máximo uma coluna por chave.
-- Remove as cópias criadas quando dois acessos simultâneos geraram as
-- colunas padrão (fica a de menor posição de cada chave), renumera as
-- posições mantendo a ordem atual e impede que a duplicação se repita.
DELETE FROM public.kanban_columns k
USING public.kanban_columns other
WHERE k.workspace_id = other.workspace_id
  AND k.key = other.key
  AND (other."order", other.id) < (k."order", k.id);

UPDATE public.kanban_columns k
SET "order" = r.pos
FROM (
  SELECT id, row_number() OVER (PARTITION BY workspace_id ORDER BY "order", id) - 1 AS pos
  FROM public.kanban_columns
) r
WHERE k.id = r.id AND k."order" <> r.pos;

ALTER TABLE public.kanban_columns
  ADD CONSTRAINT kanban_columns_workspace_key_unique UNIQUE (workspace_id, key);
