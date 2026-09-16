# Status personalizados na Gestão de Leads

Hoje os status do funil são fixos no código. A ideia é torná-los editáveis por empresa: criar, renomear, escolher cor, reordenar e excluir — e mover os leads livremente entre eles.

## O que muda para você

- Novo botão **Gerenciar status** no topo da Gestão de Leads.
- Na janela de gerenciamento você pode:
  - criar um status novo (nome, cor e posição na ordem do funil, escolhida já na criação);
  - renomear e trocar a cor de qualquer status, inclusive os padrão;
  - reordenar por arrastar;
  - excluir qualquer status — ao excluir, você escolhe para qual status os leads existentes serão movidos.
- O kanban passa a mostrar uma coluna por status cadastrado, na sua ordem, e o arraste entre colunas continua funcionando igual.
- O gráfico do funil e os contadores passam a seguir a lista de status cadastrada, na ordem definida.
- O cadastro/edição de lead mostra a lista atualizada de status.

## Comportamentos automáticos preservados

Duas regras hoje dependem de status específicos:
- **Reunião Agendada**: pede confirmação de que a reunião aconteceu quando o lead sai desse status, e alimenta a meta de reuniões.
- **Qualificado para CRM**: exibe o botão de migrar para o CRM.

Esses dois status nascem marcados com um "papel" (reunião / qualificação). O papel segue o status mesmo que você o renomeie ou mova. Se você excluir um deles, a regra correspondente simplesmente deixa de existir; ao criar um novo status você pode atribuir o papel de reunião ou de qualificação a ele.

## Detalhes técnicos

- Nova tabela `lead_statuses` (workspace_id, key, label, color, order, role, is_default) com GRANTs, RLS por `has_workspace_access` e trigger de `updated_at`.
- Seed dos 5 status atuais para cada workspace existente, preservando as chaves (`mapeado`, `contato_realizado`, `reuniao_agendada`, `qualificado_crm`, `nutricao`) para não quebrar os dados em `prospection_leads.funnel_status`; `perdido` é migrado para o primeiro status caso exista.
- Seed automático dos status padrão quando um workspace novo abre a página sem status cadastrados.
- `prospection_leads.funnel_status` continua texto livre, gravando a `key` do status.
- `ProspectionContext` carrega os status, expõe CRUD e assina realtime igual aos demais dados.
- `src/types/prospection.ts`: `LeadFunnelStatus` vira `string`; `LEAD_FUNNEL_STATUS_LABELS`/`FUNNEL_STATUS_ORDER` passam a ser apenas os defaults de seed. Ajustar consumidores (`ProspectionPage`, `WelcomePage`, `leadTemperature`) para resolver rótulo/cor pela lista carregada, com fallback para a própria chave.
- Substituir as comparações diretas com `'qualificado_crm'` e `'reuniao_agendada'` por checagem do papel do status.
- Novo componente `ManageLeadStatusesDialog.tsx` com dnd-kit para a reordenação, seguindo o padrão de colunas do kanban de projetos.
