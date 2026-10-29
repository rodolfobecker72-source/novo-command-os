# Migração do Command OS: Lovable Cloud → Supabase próprio

Última atualização: 29/10/2026

## Situação

| Etapa | Status |
|---|---|
| Repositório `novo-command-os` (cópia com histórico do `Command-OS`) | ✅ |
| Banco no Supabase próprio: schema, segurança (RLS), arquivos, realtime | ✅ |
| App na Vercel em `https://acesso.command-os.app.br` | ✅ |
| Login: endereços de retorno e e-mails em português | ✅ |
| Funções: gestão de usuários e painel do administrador (6) | ✅ |
| E-mail próprio (SMTP via Resend, domínio `mail.command-os.app.br`) | ✅ |
| Leitura do `.md` de identidade visual com a API da Anthropic | ⏳ próximo |
| Google Agenda com OAuth próprio | ✅ |
| Histórico de projetos fixo no código: removido, sem importação futura (PR #5) | ✅ |
| Referências à empresa de origem no código, PDFs e banco: removidas (PR #6) | ✅ |
| Migração dos dados do sistema atual | não será feita: o sistema novo começa do zero |

## Onde está cada coisa

| Item | Valor |
|---|---|
| Supabase | projeto `novo-Command-OS` (`ckfhxjmhbvpazprwcnmq`), região São Paulo, plano Pro |
| Schema | `supabase/migrations/20261028000000_baseline.sql` |
| Vercel | projeto `novo-command-os`, variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Domínio | `acesso.command-os.app.br` (DNS na Cloudflare) |
| SMTP | Resend, remetente `nao-responda@mail.command-os.app.br`, host `smtp.resend.com:465` |
| Administrador do sistema | `rodolfobecker72@gmail.com` (tabela `system_admins`) |

Chaves (Resend, Anthropic, Google) ficam só no painel do Supabase, nunca no repositório.

## Observações

- O domínio principal `command-os.app.br` já está em outra conta do Resend. Por isso o
  sistema novo envia por `mail.command-os.app.br`, sem tocar na outra conta.
- No Supabase, as confirmações de comandos sensíveis não aparecem no app do Claude:
  comandos como `REVOKE` e `DROP` são executados pelo SQL Editor do painel.

## Pendências

### Leitura do `.md` (Anthropic)
1. Criar a chave em console.anthropic.com.
2. Salvar como secret `ANTHROPIC_API_KEY` em Supabase > Edge Functions > Secrets.
3. Reescrever e publicar `parse-brand-identity`; hoje ela usa o gateway de IA do Lovable.

### Google Agenda
OAuth próprio (sem o conector do Lovable). Como funciona:
- Cada usuário conecta a própria conta Google no perfil. O sistema cria nela uma agenda
  "Command OS" e só tem acesso a essa agenda (escopo `calendar.app.created`), nunca aos
  outros eventos da pessoa.
- Vão para o Google as atividades de projeto com data (para cada responsável) e os
  compromissos da Minha Agenda (para quem criou e os participantes).
- Triggers no banco colocam cada mudança na fila `google_calendar_sync_queue`, mas só quando
  alguém envolvido está conectado. O pg_cron chama a função `google-calendar-worker` a cada
  minuto, apenas quando há algo na fila; ela processa em lotes, com novas tentativas e espera
  crescente em caso de falha ou limite do Google.
- Os tokens ficam criptografados (AES-GCM) e as tabelas `google_*` só são lidas pelo backend.
- Se a pessoa revogar o acesso no Google, a conexão fica como "conectar de novo" no perfil.
- Desconectar remove a agenda "Command OS" da conta Google e revoga o acesso.

Segredos (Supabase > Edge Functions > Secrets): `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`
(do Google Cloud). As chaves internas `gcal_token_key` e `gcal_worker_secret` são geradas pela
migration no Vault; `gcal_worker_url` (endereço da função `google-calendar-worker`) é criada
no Vault à parte, por projeto.

Google Cloud (projeto "Command OS"):
1. Ativar a Google Calendar API.
2. Google Auth Platform: público Externo; domínio autorizado `command-os.app.br`; escopos
   `openid`, `email` e `https://www.googleapis.com/auth/calendar.app.created`.
3. Cliente OAuth "Aplicativo da Web" com o URI de redirecionamento
   `https://acesso.command-os.app.br/auth/google-calendar-callback`.
4. Feito em 29/10/2026: app publicado ("Em produção"), escopos `openid`, `userinfo.email`
   e `calendar.app.created`, este último classificado pelo Google como não confidencial
   (sem verificação de escopo nem limite de 100 usuários). Testado: conectar, criar,
   editar e apagar atividade e compromisso.
5. Pendente (opcional): verificação de marca, para o nome e o logo aparecerem na tela de
   autorização. Exige que `command-os.app.br` tenha link para
   `https://acesso.command-os.app.br/privacidade` e domínio verificado no Search Console.

### Histórico de projetos e referências à empresa de origem
Resolvido. A lista fixa de projetos (PR #5) e todos os logos, rodapés, textos e nomes
internos da empresa de origem (PR #6) saíram do sistema novo. Identidade visual e textos
vêm só do Layout da Proposta de cada empresa.

### Dados do sistema atual
Não serão migrados. O sistema novo começa do zero, e cada empresa cadastra seus dados nele.

### Melhorias futuras
- Mover as funções auxiliares de segurança (`has_workspace_access`, `get_user_role` etc.)
  para um schema interno, para que não fiquem chamáveis pela API.
- Esconder do Time Operacional os valores dos orçamentos na API.
