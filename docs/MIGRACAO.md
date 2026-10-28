# Migração do Command OS: Lovable Cloud → Supabase próprio

Última atualização: 28/10/2026

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
| Google Agenda com OAuth próprio | ⏳ |
| Histórico de projetos fixo no código (ver abaixo) | ⏳ decidir |
| Migração dos dados do sistema atual | ⏳ dezembro |

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
As funções `google-calendar-*` e `_shared/appUserConnector.ts` usam o conector do Lovable
(`connector-gateway.lovable.dev`). É preciso refazer com OAuth próprio, criando um projeto e
um cliente OAuth no Google Cloud. Até lá, a tela mostra "não conectado" e a sincronização
das atividades fica desligada, sem erro para o usuário.

### Histórico de projetos fixo no código
`src/data/historicalProjects.ts` tem 414 projetos da HERO (nomes de clientes e links do
Drive) que aparecem para qualquer empresa no Histórico, tanto no sistema atual quanto
no novo. A proposta é tirar a lista do código e, na migração, importá-la em
`archived_projects` só para o workspace da HERO.

### Textos fixos da HERO
O contrato (`contractPDF.ts`) e o relatório financeiro (`financialReportPDF.ts`) usam o
logo e o rodapé da HERO quando a empresa não configurou o Layout. O `NewBudget.tsx`
escreve "HERO" num PDF.

### Migração dos dados (dezembro)
- Exportar do Lovable: pg_dump, se disponível em Cloud > Advanced settings, ou CSV por tabela.
- Recriar os usuários mantendo os mesmos IDs, ou remapear as referências
  (`responsible_user_id`, `assigned_to_user_ids`, `created_by` etc.).
- Reenviar os arquivos: logos, fotos de perfil e documentos dos orçamentos.
- Congelar o sistema antigo, importar e avisar a equipe.

### Melhorias futuras
- Mover as funções auxiliares de segurança (`has_workspace_access`, `get_user_role` etc.)
  para um schema interno, para que não fiquem chamáveis pela API.
- Esconder do Time Hero os valores dos orçamentos na API.
