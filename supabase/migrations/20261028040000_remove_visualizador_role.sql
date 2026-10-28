-- Remove the "visualizador" role (audit item 3, 2026-10-28)
--
-- The role is no longer offered by the app. Existing viewers become
-- "vendedor", which sees the same pages and could already edit the same
-- data in practice. The enum value stays (dropping an enum label means
-- recreating the type and every function that uses it); a CHECK constraint
-- keeps it from being used again.

UPDATE public.workspace_members SET role = 'vendedor' WHERE role = 'visualizador';
UPDATE public.workspace_invites SET role = 'vendedor' WHERE role = 'visualizador';

ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_not_visualizador;
ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_not_visualizador CHECK (role <> 'visualizador');

ALTER TABLE public.workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_role_not_visualizador;
ALTER TABLE public.workspace_invites
  ADD CONSTRAINT workspace_invites_role_not_visualizador CHECK (role <> 'visualizador');
