## Objetivo

Permitir marcar/desmarcar manualmente um projeto como **Recorrente** direto no card do CRM, e exibir essa tag também na área de Projetos.

## Situação atual

Hoje a tag "Recorrente" já aparece nos cards do CRM (`KanbanCard.tsx` e `KanbanListRow.tsx`), mas é **calculada automaticamente**: o `CRMContext` marca como recorrente qualquer orçamento cuja versão tenha o motivo iniciando com "Duplicado de #". Não existe campo no banco nem forma de o usuário ativar/desativar.

## O que será feito

1. **Banco de dados**
   - Nova coluna `is_recurring` (booleano, padrão falso) na tabela de orçamentos.
   - Preenchimento inicial: marcar como recorrente os orçamentos que hoje já são detectados como duplicados, para não perder a marcação atual.

2. **CRM — controle no card**
   - No card do Kanban (visão card e visão lista) adicionar, na área de ações do card, um botão "Recorrente" que liga/desliga a tag com um clique (com feedback imediato e toast de confirmação).
   - A tag passa a refletir o valor salvo no banco, e não mais a heurística de duplicação.
   - Manter o comportamento de duplicação: ao duplicar um projeto para meses futuros, as cópias já nascem marcadas como recorrentes.

3. **Área de Projetos**
   - Exibir a tag "Recorrente" (mesmo estilo visual do CRM: ícone de cópia + borda/destaque em accent) no card do projeto na listagem de gestão de projetos, ao lado do nome/identificação do projeto.

## Detalhes técnicos

- Migração: `ALTER TABLE public.budgets ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;` + `UPDATE` inicial baseado no motivo das versões. RLS/grants existentes da tabela continuam válidos.
- `src/contexts/CRMContext.tsx`: mapear `is_recurring` → `isRecurring` no mapper de orçamento, usar esse valor em `getCRMCards()`, e expor uma ação `toggleBudgetRecurring(budgetId, value)` (update otimista + persistência). O realtime já sincroniza a tabela para outros usuários.
- `src/types/crm.ts`: adicionar `isRecurring` ao tipo `Budget`.
- `src/components/crm/KanbanCard.tsx` e `KanbanListRow.tsx`: botão de toggle com `stopPropagation` no `onPointerDown` (para não conflitar com o drag).
- `src/pages/projects/ProjectManagementPage.tsx`: renderizar o badge quando `card.isRecurring`.
