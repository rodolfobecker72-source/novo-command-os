-- Uso dos recursos de IA ("Melhorar com IA" nas propostas). Serve para o limite
-- diário por empresa e para o painel do Command OS acompanhar o consumo.
-- Só o backend (edge functions) lê e grava.
CREATE TABLE public.ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  feature text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_workspace_created ON public.ai_usage (workspace_id, created_at DESC);
CREATE INDEX idx_ai_usage_user ON public.ai_usage (user_id);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM anon, authenticated;
