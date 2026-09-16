# Status padrão protegidos e confirmação ao qualificar para CRM

## O que muda

**1. Status padrão não podem ser excluídos**
- Os cinco status originais (Mapeado, Contato Realizado, Reunião Agendada, Qualificado para CRM, Nutrição) perdem o ícone de lixeira e ganham a etiqueta "Padrão".
- Continuam podendo ser renomeados, ter a cor trocada e ser reordenados.
- Status criados pelo usuário continuam podendo ser excluídos normalmente (escolhendo para onde vão os leads).

**2. Fim do campo "comportamento"**
- A coluna de comportamento some da tela de gerenciar status e do formulário de novo status.
- O sistema passa a reconhecer sozinho os dois status especiais pelos status padrão: "Reunião Agendada" (onde pede a confirmação da reunião) e "Qualificado para CRM" (onde oferece o cadastro como cliente).
- Novos status criados são simples, sem comportamento especial.

**3. Confirmação automática ao mover para "Qualificado para CRM"**
- Ao arrastar o lead para a coluna Qualificado para CRM (ou escolher esse status no formulário/ficha), aparece uma confirmação: "Cadastrar {empresa} como cliente?".
- Confirmando, a empresa é criada no cadastro de clientes na hora. Recusando, o lead apenas muda de status.
- Se a empresa já estiver cadastrada, a confirmação não aparece.
- O botão manual "Migrar para CRM" no cartão e na ficha continua existindo para quem já estava naquele status.

## Detalhes técnicos

- `ManageLeadStatusesDialog.tsx`: remover `RoleSelect` da linha e do formulário de criação; usar `status.isDefault` para esconder o botão de exclusão e mostrar badge "Padrão"; `addStatus` passa a enviar `role: null`.
- `ProspectionPage.tsx`: `meetingKey`/`qualifiedKey` derivados por chave padrão (`reuniao_agendada`/`qualificado_crm`) com fallback ao `role` existente; em `changeLeadStatus`, quando o novo status for o qualificado e o lead ainda não estiver em clientes, abrir um `AlertDialog` de confirmação que chama `handleMigrateToCRM` após aplicar a mudança de status.
- `ProspectionContext.tsx`: `deleteStatus` rejeita status com `is_default = true`; `addStatus` grava `role` nulo. Nenhuma mudança de banco necessária.
