# Parar o "recarregamento" da tela de tarefas do projeto

## Por que acontece
A tela do projeto fica "escutando" mudanças em tempo real (para mostrar o que outras pessoas alteram). Só que ela também reage às mudanças feitas por você: a cada tarefa criada, movida, concluída, comentário ou link salvo, ela recarrega tudo do zero — tarefas, briefing, equipe, links e comentários — e mostra o carregando de novo. Por isso a tela "pisca", pode voltar ao topo e apaga o que estava sendo digitado (ex.: o campo de novo link).

## O que vai mudar
1. **Atualização silenciosa**: quando chegar uma mudança, só a lista de tarefas e os comentários/links são atualizados por baixo, sem mostrar carregando e sem limpar campos. O carregando aparece apenas na primeira abertura do projeto.
2. **Ignorar o próprio eco**: alterações que você acabou de fazer (já aplicadas na tela na hora) não disparam nova recarga por alguns segundos.
3. **Agrupar avisos**: várias mudanças seguidas (ex.: arrastar uma tarefa reordena várias) viram uma única atualização, em vez de várias recargas seguidas.
4. Briefing e lista da equipe passam a carregar só ao abrir o projeto, não a cada mudança.
5. Mudanças de outras pessoas continuam aparecendo automaticamente.

## Detalhes técnicos
- `ProjectActivitiesDialog.tsx`: separar o `useEffect` inicial (briefing, membros, carga completa com `loading`) de uma função `refreshSilently()` que busca só `project_activities` e `project_cards` (comments/material_links) sem `setLoading` e sem `setNewLink('')`.
- Callback do realtime: debounce (~400 ms) chamando `refreshSilently`; ignorar eventos dentro de uma janela (~1,5 s) após escrita local registrada via `lastLocalWriteRef`, marcada em handleAdd/update/delete/drag/comentários/links.
- Não atualizar o estado se o usuário estiver arrastando (`activeId`) para não quebrar o drag.
