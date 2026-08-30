# Arquivar projetos finalizados no Histórico

Criar um mecanismo para enviar projetos concluídos para a página de Histórico, em grupos (sessões) nomeados pelo usuário — novos ou já existentes.

## Como vai funcionar

1. Na área de Projetos, um botão "Enviar para Histórico" abre um diálogo.
2. O diálogo lista apenas os projetos com status **concluído**, com caixas de seleção e opção "Selecionar todos".
3. O usuário escolhe o grupo/sessão:
   - selecionar um grupo existente (inclui os grupos atuais do histórico, como "2025", "2024", "1º semestre 2026", "Nativos do Futuro", e qualquer grupo criado depois), ou
   - digitar o nome de um novo grupo.
4. Ao confirmar, cada projeto vira um item do histórico usando o link de material/Drive do card (quando existir; senão fica "Sem link", editável depois pelo lápis já existente).
5. Os projetos arquivados **saem da listagem** da área de Projetos.
6. A página Histórico passa a mostrar os grupos existentes (dados estáticos) somados aos projetos arquivados, agrupados por sessão e ordenados por número de projeto.

## Detalhes técnicos

**Banco (migração):**
- Nova tabela `archived_projects`: `workspace_id`, `group_name`, `project_number`, `project_name`, `client_name`, `link`, `source_card_id`, `archived_at`, timestamps. GRANTs para `authenticated`/`service_role`, RLS com `has_workspace_access`.
- Nova coluna `archived_at timestamptz` em `project_cards` (nulo = ativo).

**Frontend:**
- `src/components/projects/ArchiveToHistoryDialog.tsx` (novo): seleção múltipla de concluídos + escolha/criação de grupo.
- `src/pages/projects/ProjectManagementPage.tsx`: botão de abertura do diálogo; filtrar cards com `archived_at` preenchido.
- `src/contexts/CRMContext.tsx` (ou hook de project cards): excluir arquivados no fetch e função `archiveProjectCards(ids, groupName)`.
- `src/pages/projects/ProjectHistoryPage.tsx`: consultar `archived_projects` e mesclar com `HISTORICAL_PROJECTS`; edição de link dos itens arquivados grava direto na linha da tabela (mantendo o override atual para os estáticos); ordenação por número dentro do grupo e grupos novos listados após a ordem fixa atual.
