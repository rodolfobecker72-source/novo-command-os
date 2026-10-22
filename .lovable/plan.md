# Identidade visual via arquivo .md

## O que muda para o usuário
Em **Configurações > Layout da Proposta**, novo bloco "Identidade visual":
- Botão **Enviar .md** do manual da marca (até 1 MB).
- Após o envio, a IA lê o arquivo e mostra o resultado: amostras das cores aplicadas (principal, secundária, destaque, texto, fundo de destaque) e o estilo de fonte (sem serifa, com serifa ou mono).
- Botões **Trocar** e **Remover** (remover volta ao visual padrão atual).
- Ao **Salvar Layout**, todos os documentos emitidos passam a usar essa identidade: proposta, contrato, relatório financeiro e PDF de projeto.

## O que é aplicado nos documentos
- Cor principal: títulos de seções, faixas e destaques do investimento total.
- Cor secundária/destaque: linhas, bordas de tabelas e subtítulos.
- Cor do texto e fundo de destaque das tabelas.
- Estilo de fonte: mapeado para as fontes disponíveis no PDF (Helvetica, Times ou Courier).
- Se o .md não trouxer alguma informação, aquele item mantém o padrão atual.

Capa/contracapa enviadas continuam iguais (não são alteradas).

## Detalhes técnicos
- Migração em `workspace_layout`: `brand_md_url text`, `brand_theme jsonb` (`{ primary, secondary, accent, text, highlightBg, fontFamily }` em hex).
- Upload do .md no bucket `logos` em `{workspace_id}/brand.md`.
- Nova função `parse-brand-identity`: valida JWT e acesso ao workspace, recebe o texto do .md (limite de tamanho), chama Lovable AI Gateway (`openai/gpt-6-astra`, Responses, streaming, schema JSON estrito) e devolve o tema. Valida hex no retorno; trata 402/429 com mensagem clara.
- `LayoutPage.tsx`: bloco de upload, chamada à função, prévia das cores, salva `brand_md_url` e `brand_theme`.
- Novo util `pdfTheme.ts` com tema padrão (#002cbe etc.) + `resolveTheme(brandTheme)` e conversão hex→RGB.
- `pdfGenerator.ts`, `contractPDF.ts`, `financialReportPDF.ts`, `projectPDF.ts`: trocar cores fixas e `'helvetica'` pelo tema resolvido; `BudgetDetail` e demais chamadores passam `brand_theme` lido do layout.
- Teste: `resolveTheme` mantém padrão para campos ausentes/inválidos e aplica hex válidos.
