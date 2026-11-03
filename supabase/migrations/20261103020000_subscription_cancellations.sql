-- Motivo de cada cancelamento da assinatura, informado pelo proprietário ao cancelar.
-- Só o backend lê e grava (billing-cancel e o painel do Command OS).
CREATE TABLE public.subscription_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text NOT NULL
    CHECK (reason IN ('preco', 'faltou_recurso', 'nao_usei', 'outro_sistema', 'outro')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscription_cancellations_workspace ON public.subscription_cancellations (workspace_id);
CREATE INDEX idx_subscription_cancellations_user ON public.subscription_cancellations (user_id);
CREATE INDEX idx_subscription_cancellations_created ON public.subscription_cancellations (created_at DESC);

ALTER TABLE public.subscription_cancellations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_cancellations FROM anon, authenticated;
