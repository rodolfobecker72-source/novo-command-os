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
| 1 | Permissões por papel existem só na tela. No banco, qualquer membro lê, edita e apaga clientes, orçamentos, leads e projetos pela API, e o app carrega todos os orçamentos (com valores) no navegador de qualquer usuário. | Alto | 2 | ⏳ |
| 2 | Arquivos de orçamentos e contratos (`budget-documents`) abertos a qualquer membro. | Alto | 2 | ⏳ |
| 3 | Nada impede a empresa de ficar sem proprietário (o proprietário pode rebaixar a si mesmo) ou de ter dois. | Médio | 1 | ⏳ |
| 4 | Convites aceitam Administrador, mas criar, editar e remover membros é só do Proprietário. Decisão: só o Proprietário. | Médio | 1 | ⏳ |
| 5 | Uma pessoa, uma empresa: hoje é só suposição do código (`.single()`), sem regra no banco. Decisão: manter e travar no banco. | Baixo | 1 | ⏳ |
| 6 | Funções auxiliares de permissão chamáveis pela API; proteção contra senhas vazadas desligada. | Médio | 1 | ⏳ |

### 2. Banco de dados

| # | Achado | Impacto | Fase | Situação |
|---|---|---|---|---|
| 7 | 128 regras de acesso reavaliam o usuário a cada linha (`auth_rls_initplan`). | Alto em escala | 1 | ⏳ |
| 8 | 16 chaves estrangeiras sem índice. | Médio | 1 | ⏳ |
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

## Fases

1. **Banco**, sem mudar telas: itens 3, 4, 5, 6, 7 e 8.
2. **Hierarquia**: regras por papel no banco e dados carregados conforme o papel (itens 1 e 2).
3. **Carregamento e tempo real**: cada tela busca o que precisa, com paginação; atualizações por
   empresa; score calculado no banco (itens 9 a 13).
4. **Cobrança com Asaas**: situação da empresa (teste, ativa, inadimplente, cancelada), limite de
   usuários por plano, somente leitura 3 dias após o vencimento, atualização automática pelo Asaas;
   papéis e registro de ações da equipe do Command OS (itens 14 e 15).
