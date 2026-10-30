-- Origem do lead do cliente passa a ser opcional, e "Cliente antigo" sai da
-- lista de origens.
ALTER TABLE public.clients ALTER COLUMN lead_origin DROP NOT NULL;
ALTER TABLE public.clients ALTER COLUMN lead_origin DROP DEFAULT;
UPDATE public.clients SET lead_origin = NULL WHERE lead_origin = 'cliente_antigo';
