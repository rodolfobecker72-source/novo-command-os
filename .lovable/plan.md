# Correção da tela em branco e proteção do backend

## O que foi verificado agora

- O banco de dados na nuvem está saudável: consulta real de dados respondeu normalmente.
- As credenciais de conexão do app (arquivo `.env`) estavam **vazias**; foram restauradas e o servidor reiniciou.
- Abrindo o app aqui já logado, `/crm/dashboard` renderiza a sidebar e o conteúdo normalmente, sem erro de execução.

Conclusão: a tela branca vem do app ter carregado enquanto as credenciais estavam vazias. Nesse estado, o cliente do banco é criado com valores indefinidos e a aplicação quebra antes de desenhar qualquer coisa — sem nenhuma mensagem para o usuário. A versão em cache no seu navegador ainda pode ser a quebrada.

## Passo 1 — Voltar a carregar para você

- Recarregar o preview com cache limpo (Ctrl/Cmd + Shift + R).
- Se continuar em branco, coletar o erro exato do seu navegador e tratar como um segundo problema (não é o mesmo desta análise).

## Passo 2 — Nunca mais tela branca sem explicação

1. **Guarda de credenciais**: em `src/integrations/supabase/client.ts` não é permitido editar (arquivo gerado). Em vez disso, criar `src/lib/backendConfig.ts` que valida `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` e exporta um booleano `isBackendConfigured`.
2. **Tela de indisponibilidade**: em `src/main.tsx`, se `isBackendConfigured` for falso, renderizar uma tela simples em pt-BR ("Não foi possível conectar ao servidor — tente recarregar"), com botão de recarregar, em vez de montar o `App`.
3. **ErrorBoundary global**: hoje o `ErrorBoundary` existe mas não envolve a aplicação inteira. Envolver o `App` em `src/main.tsx` para que qualquer erro de render vire a tela de erro já existente, e não uma página branca.

## Detalhes técnicos

- Arquivos afetados: `src/main.tsx` (guarda + boundary), novo `src/lib/backendConfig.ts`.
- Nada muda no banco de dados, nas rotas ou na lógica de negócio.
- Sem alterações no `.env` pelo código — apenas leitura e validação.
