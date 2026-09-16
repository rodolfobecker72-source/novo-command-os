# Auditoria geral do sistema + correções

Revisei todo o código em três frentes: funções incompletas, navegação e estabilidade. Abaixo o que encontrei e o que proponho corrigir.

## O que está funcionando bem

- Todas as páginas do menu existem de verdade e salvam dados (nenhuma tela "fantasma").
- Nenhum botão sem função encontrado.
- Existe página de erro para endereços inválidos.
- Os botões "voltar" usam destinos fixos (não dependem do histórico do navegador).

## Falhas encontradas

### Navegação (o que mais afeta a experiência)

1. **Sem permissão joga o usuário na tela de login.** Quem abre uma página que seu perfil não pode ver é mandado para `/`, que é o login — causa a sensação de "fui deslogado". Deve ir para Boas-vindas com um aviso.
2. **A página não volta ao topo ao trocar de tela.** Ao sair de uma lista longa e abrir outra página, a tela continua rolada no meio. Cada página resolve isso do seu jeito hoje (ou não resolve).
3. **Página de erro recarrega o sistema inteiro** ao clicar em "voltar ao início", perdendo os dados já carregados.
4. **Duas regras diferentes para a mesma permissão** (menu "Usuários"): uma no cadastro de páginas, outra escrita direto no menu lateral — mudar uma não muda a outra.
5. **"Meu Financeiro" não tem trava de rota** — hoje só a própria tela bloqueia. Quem digitar o endereço vê a tela carregar antes de bloquear.
6. **Tela órfã** (`Index.tsx`) que não é usada por nenhum endereço.

### Funcionamento indevido / risco de falha silenciosa

7. **Cadastros iniciais do espaço de trabalho podem falhar sem aviso**: a criação das colunas do kanban, categorias de serviço e colunas de projeto não verifica se deu erro — se falhar, o usuário fica com um espaço vazio sem entender por quê.
8. **Consultas de membros e perfis não verificam erro** (Financeiro do Time, Calendário do Time): se o acesso for negado, a lista aparece vazia em vez de mostrar um aviso.
9. **Mensagens de depuração ("console.log") em produção** em Autenticação, CRM, Financeiro, Novo Orçamento e Editar Cliente — ruído e vazamento de informação interna.
10. **Cadastro e login sem validação própria**: não confere se as senhas coincidem nem a força da senha; só mostra o erro genérico do servidor.
11. **Leitura de dado salvo no navegador (Calendário do Time) sem conferir o formato** — se estiver corrompido, pode quebrar a tela.
12. **Lentidão por recarga em cascata**: Autenticação e Prospecção recriam seus dados a cada atualização, fazendo dezenas de telas se redesenharem à toa.
13. **CRM com risco de dado desatualizado**: várias funções do CRM ficam "congeladas" em uma versão antiga ao trocar de espaço de trabalho.
14. **Comentário de permissão desatualizado** no código dizendo que administrador acessa tudo, quando na prática Layout, Contrato e Metas são só do proprietário.

### Segurança no banco (mais grave)

15. **Qualquer usuário logado pode se tornar proprietário de qualquer espaço de trabalho** (regra de inserção em membros mal protegida).
16. **A função que descobre o papel do usuário ignora o espaço de trabalho** — quem é proprietário em um espaço pode agir como proprietário em outro.
17. **Leads do site são legíveis por qualquer usuário logado**, de qualquer espaço.
18. **Logos podem ser sobrescritas/apagadas por qualquer usuário logado**, inclusive de outro espaço.
19. **Proteção contra senhas vazadas desligada.**

## O que proponho fazer

**Etapa 1 — Segurança do banco (itens 15-19)**
Corrigir as regras de acesso: bloquear autopromoção a proprietário, passar o espaço de trabalho na checagem de papel, restringir leitura de leads e escrita de logos ao espaço correto, e ligar a proteção de senhas vazadas.

**Etapa 2 — Navegação (itens 1-6)**
Redirecionar sem permissão para Boas-vindas com aviso; rolagem ao topo automática em toda troca de página (mantendo a restauração já existente em Projetos); página de erro usando navegação interna; unificar a regra de permissão do menu; trava de rota em Meu Financeiro; remover a tela órfã.

**Etapa 3 — Falhas silenciosas (itens 7, 8, 11)**
Verificar erro em todas essas operações e mostrar aviso claro ao usuário em vez de tela vazia.

**Etapa 4 — Estabilidade e desempenho (itens 12, 13)**
Memoizar os dados de Autenticação e Prospecção e estabilizar as funções do CRM, deixando o sistema mais rápido e sem dados desatualizados ao trocar de espaço.

**Etapa 5 — Limpeza e formulários (itens 9, 10, 14)**
Remover as mensagens de depuração, adicionar confirmação de senha e checagem de força no cadastro, e corrigir o comentário de permissão.

## Detalhes técnicos

- Migrações SQL: política `workspace_members_insert_owner` com checagem de ausência de owner/convite; `get_user_role(_workspace_id)` com filtro por workspace e atualização das políticas que a usam; `landing_leads` SELECT restrito a owner/admin do workspace; políticas de storage `logos_*` validando `(storage.foldername(name))[1] = workspace_id`; `configure_auth` para leaked password protection.
- `PageGuard.tsx`: `<Navigate to="/boas-vindas" replace />` + toast; novo `ScrollToTop` em `AppLayout.tsx` com opt-out por rota (`/gestao-projetos` mantém a restauração atual).
- `NotFound.tsx`: `<Link to="/">`; `Sidebar.tsx:113` usa `hasPageAccess('usuarios')`; `pages.ts` ganha entrada `meu-financeiro` + `PageGuard` na rota; remover `src/pages/Index.tsx`.
- `CRMContext.tsx:404/414/426` e consultas de `workspace_members`/`profiles` em `TeamFinancePage.tsx`/`TeamCalendarPage.tsx`: desestruturar `error`, logar e exibir toast.
- `AuthContext.tsx:240` e `ProspectionContext.tsx:308`: `useMemo` no value; funções do CRM em `useCallback` e adicionadas às deps do `useMemo` existente.
- `TeamCalendarPage.tsx:122`: validar `Array.isArray` após o parse.
- Remoção dos `console.log` em `AuthContext`, `CRMContext`, `FinancialPage`, `NewBudget`, `EditClient`.

Nada de comportamento de negócio muda: são correções de segurança, estabilidade e navegação.
