# Vários responsáveis por empresa + escolha do responsável no orçamento

## O que muda para você

**1. Cadastro da empresa (Nova / Editar empresa)**
- A seção "Pessoa Responsável" vira uma lista "Responsáveis".
- Cada responsável tem: nome, cargo (opcional), e-mail e telefone/WhatsApp.
- Botões "+ Adicionar responsável" e remover. Pelo menos 1 responsável continua obrigatório.
- Um deles fica marcado como "Principal" (aparece na lista de empresas, como hoje).
- O responsável que já existe em cada empresa é aproveitado automaticamente como o primeiro da lista — nada se perde.

**2. CRM — Novo orçamento / editar orçamento**
- Depois de escolher a empresa, aparece o campo "Responsável pela proposta", listando só os responsáveis daquela empresa (o principal já vem selecionado).
- Atalho "+ Novo responsável" ali mesmo, sem sair do orçamento.
- Trocar de empresa limpa o responsável escolhido.

**3. Onde o responsável aparece**
- No detalhe do orçamento (bloco do cliente) mostra o responsável escolhido, com e-mail e telefone.
- No PDF da proposta e no contrato, o "A/C" passa a ser o responsável do orçamento.
- Nos cards do CRM, nome do responsável em texto pequeno abaixo da empresa.
- Orçamentos antigos sem responsável escolhido continuam mostrando o principal da empresa.

## Detalhes técnicos
- Nova tabela `client_contacts` (id, workspace_id, client_id → clients, name, role, email, phone, is_primary, order, timestamps) com GRANTs, RLS via `has_workspace_access`, trigger updated_at.
- Preenchimento inicial: um contato principal por cliente a partir de `responsible_person`/`email`/`phone`.
- `budgets.contact_id uuid null` → client_contacts (ON DELETE SET NULL).
- `clients.responsible_person/email/phone` continuam e são sincronizados com o contato principal (compatibilidade com buscas, Central de Mídia e PDFs atuais).
- CRMContext: mapeadores + CRUD de contatos; `Budget.contactId`; `CRMCard.contactName`.
- Ajustes em NewClient, EditClient, NewBudget, BudgetDetail, pdfGenerator, contractPDF, KanbanCard.
