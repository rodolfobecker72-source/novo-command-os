-- Remove nomes da HERO do schema (o Command OS não é específico de uma empresa)
--
-- * Papel "time_hero" passa a se chamar "time_operacional" (rótulo na tela:
--   Time Operacional). RENAME VALUE mantém os membros que já têm o papel.
-- * Coluna do número de patrimônio deixa de ter "hero" no nome.
-- * Texto padrão das responsabilidades (colunas legadas de termos, não
--   usadas pelo app) deixa de citar a HERO.

ALTER TYPE public.app_role RENAME VALUE 'time_hero' TO 'time_operacional';

ALTER TABLE public.assets RENAME COLUMN hero_asset_number TO asset_number;

ALTER TABLE public.workspace_layout
  ALTER COLUMN terms_company_label SET DEFAULT 'Responsabilidades da empresa:';
UPDATE public.workspace_layout
  SET terms_company_label = 'Responsabilidades da empresa:'
  WHERE terms_company_label ILIKE '%hero%';
