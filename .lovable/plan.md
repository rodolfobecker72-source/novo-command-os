# Dados da empresa configuráveis no PDF

Hoje o CNPJ e o endereço no topo da proposta (CNPJ 38.204.599/0001-58, Rua Ver. Célso Henrique Borsato, 426, Santa Rita do Sapucaí/MG) estão fixos e não dá para editar.

## O que muda
Em **Layout da Proposta**, no bloco "Informações do Rodapé" (renomeado para "Dados da Empresa"), novos campos:
- CNPJ
- Endereço (rua e número)
- Cidade / UF / CEP

O PDF passa a mostrar o que estiver preenchido. Campos vazios não aparecem. Para não mudar nada de imediato, os dados atuais já vêm preenchidos para a HERO.

## Detalhes técnicos
- Migração: colunas `company_cnpj`, `company_address`, `company_city_line` (text) em `workspace_layout`; preencher com os valores atuais para workspaces que já têm layout.
- `LayoutPage.tsx`: campos novos no estado, carregar e salvar.
- `PDFLayoutSettings` ganha `companyCnpj`, `companyAddress`, `companyCityLine`; `BudgetDetail` mapeia.
- `pdfGenerator.ts` linhas 216-218: trocar textos fixos pelos campos, pulando os vazios.
