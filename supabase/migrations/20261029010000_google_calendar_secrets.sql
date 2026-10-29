-- Chaves internas do Google Agenda, geradas no próprio banco e guardadas no
-- Vault (ninguém precisa vê-las nem copiá-las):
--   gcal_token_key      criptografia dos tokens do Google (AES-256)
--   gcal_worker_secret  autoriza o pg_cron a chamar o google-calendar-worker
-- O endereço do worker (gcal_worker_url) é criado à parte por projeto.
SELECT vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'gcal_token_key')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'gcal_token_key');

SELECT vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'gcal_worker_secret')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'gcal_worker_secret');

-- Leitura pelas edge functions (service_role), só destas duas chaves
CREATE FUNCTION public.gcal_secret(p_name text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets
   WHERE name = p_name AND p_name IN ('gcal_token_key', 'gcal_worker_secret');
$$;
REVOKE EXECUTE ON FUNCTION public.gcal_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gcal_secret(text) TO service_role;
