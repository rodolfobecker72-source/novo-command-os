# Auditoria de hierarquia e escala

Feita em 30/10/2026, antes de abrir o sistema para muitas empresas e de ligar a cobrança.
Fontes: relatórios de segurança e desempenho do Supabase, regras de acesso (RLS) do banco e
leitura do código do app e das edge functions.

Situação de cada item: ⏳ pendente · 🔧 em andamento · ✅ feito

## Decisões (30/10/2026)

| Papel | Pode |
|---|---|
| Proprietário | Tudo, inclusive configurações da empresa, equipe e cobrança. Único que gerencia a equipe (convidar, editar, remover). |
| Administrador | Tudo, exceto configurações da empresa, cobrança e gestão da equipe. |
| Vendedor | Cria e edita clientes, leads e orçamentos. Não apaga e não vê o financeiro. |
| Time Operacional | Projetos, atividades, agenda, Central de Mídias e Histórico. Sem valores. |

- Uma pessoa pertence a uma única empresa.
- Empresa inadimplente passa a somente leitura 3 dias após o vencimento.

## Achados

### 1. Hierarquia e segurança

| # | Achado | Risco | Fase | Situação |
|---|---|---|---|---|
| 1 | Permissões por papel existem só na tela. No banco, qualquer membro lê, edita e apaga clientes, orçamentos, leads e projetos pela API, e o app carrega todos os orçamentos (com valores) no navegador de qualquer usuário. | Alto | 2 | ✅ |
| 2 | Arquivos de orçamentos e contratos (`budget-documents`) abertos a qualquer membro. | Alto | 2 | ✅ |
| 3 | Nada impede a empresa de ficar sem proprietário (o proprietário pode rebaixar a si mesmo) ou de ter dois. | Médio | 1 | ✅ |
| 4 | Convites aceitam Administrador, mas criar, editar e remover membros é só do Proprietário. Decisão: só o Proprietário. | Médio | 1 | ✅ |
| 5 | Uma pessoa, uma empresa: hoje é só suposição do código (`.single()`), sem regra no banco. Decisão: manter e travar no banco. | Baixo | 1 | ✅ |
| 6 | Funções auxiliares de permissão chamáveis pela API; proteção contra senhas vazadas desligada. | Médio | 1 | ✅ |

### 2. Banco de dados

| # | Achado | Impacto | Fase | Situação |
|---|---|---|---|---|
| 7 | 128 regras de acesso reavaliam o usuário a cada linha (`auth_rls_initplan`). | Alto em escala | 1 | ✅ |
| 8 | 16 chaves estrangeiras sem índice. | Médio | 1 | ✅ |
| 9 | O app carrega tabelas inteiras sem paginação; a API devolve no máximo 1.000 linhas por consulta (padrão Supabase). Acima disso, dados somem sem erro. | Crítico | 3 | ⏳ |

### 3. App e tempo real

| # | Achado | Impacto | Fase | Situação |
|---|---|---|---|---|
| 10 | Cada alteração faz todos os usuários online da empresa recarregarem 13 tabelas inteiras. | Crítico | 3 | ⏳ |
| 11 | Assinaturas de tempo real sem filtro por empresa no servidor: cada mudança é conferida contra todos os usuários conectados do sistema. | Alto | 3 | ⏳ |
| 12 | Score dos clientes recalculado e gravado pelo navegador de cada usuário online (históricos duplicados, gravações multiplicadas). | Alto | 3 | ⏳ |
| 13 | Lista de membros busca o e-mail de cada pessoa uma a uma. | Baixo | 3 | ⏳ |

### 4. Cobrança e equipe do Command OS

| # | Achado | Fase | Situação |
|---|---|---|---|
| 14 | Sem plano, assinatura ou situação por empresa; cadastro livre, sem limite de usuários, sem bloqueio por inadimplência. | 4 | ⏳ |
| 15 | Equipe do Command OS (`system_admins`) sem papéis e sem registro de ações. | 4 | ⏳ |

## Fase 1: concluída em 30/10/2026

Migration `20261030010000_fase1_banco` (aplicada pelo SQL Editor) e proteção contra senhas
vazadas ligada no painel.

| Indicador do Supabase | Antes | Depois |
|---|---|---|
| Regras que reavaliam o usuário a cada linha | 128 | 0 |
| Chaves estrangeiras sem índice | 16 | 0 |
| Funções sensíveis chamáveis pela API | 10 | 2 (`accept_invite` e `handle_signup_workspace`, que o app usa) |
| Senhas vazadas | permitidas | bloqueadas |

Conferido: cada usuário de teste continua vendo exatamente o mesmo, tabela por tabela; o
proprietário não pode ser rebaixado nem removido; não há segundo proprietário; Time Operacional
não altera configurações nem convida; ninguém de fora da empresa vê os dados dela; as funções
antigas não são mais chamáveis.


## Fase 2: concluída em 30/10/2026

Migration `20261030020000_fase2_hierarquia` (aplicada pelo SQL Editor) e ajustes no app.

| | Proprietário / Administrador | Vendedor | Time Operacional |
|---|---|---|---|
| Clientes, leads, orçamentos | vê, cria, edita, apaga | vê, cria, edita, não apaga | não vê |
| Valores, metas, regras comerciais, preços, minuta, documentos de orçamento | vê | vê (sem Financeiro) | não vê |
| Colunas do CRM, status de leads, colunas de projetos | altera | usa | usa as de projetos |
| Projetos, atividades, agenda, Central de Mídias, Histórico | ✅ | ✅ | ✅ |

O que as telas de projeto precisam do comercial vem de funções sem valores:
`budget_schedules` (mês de execução e recorrência), `set_budget_execution_month`,
`media_center_clients` (id e nome) e `my_finance_entries` (só os pagamentos da própria pessoa,
se liberado). O app não pede dados comerciais para o Time Operacional e só mostra excluir e
configurar quadros para gestores. `team_finance_access` ficou com uma única regra de leitura.

Conferido no banco: o proprietário vê o mesmo de antes; o Time Operacional deixou de ver
orçamentos, versões, clientes, contatos, histórico de score, colunas do CRM e status de leads, e
segue com projetos, agenda e as funções acima; o vendedor edita mas não apaga cliente nem
orçamento, não altera colunas do CRM e não vê o financeiro.

## Fases

1. **Banco**, sem mudar telas: itens 3, 4, 5, 6, 7 e 8.
2. **Hierarquia**: regras por papel no banco e dados carregados conforme o papel (itens 1 e 2).
3. **Carregamento e tempo real**: cada tela busca o que precisa, com paginação; atualizações por
   empresa; score calculado no banco (itens 9 a 13).
4. **Cobrança com Asaas**: situação da empresa (teste, ativa, inadimplente, cancelada), limite de
   usuários por plano, somente leitura 3 dias após o vencimento, atualização automática pelo Asaas;
   papéis e registro de ações da equipe do Command OS (itens 14 e 15).
