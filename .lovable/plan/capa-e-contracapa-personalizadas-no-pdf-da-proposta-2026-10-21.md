# Capa e contracapa personalizadas no PDF da proposta

## O que muda para o usuário
Em **Configurações > Layout do PDF**, um novo bloco "Páginas personalizadas":
- **Página inicial (capa)**: enviar um PDF próprio (ver nome do arquivo, trocar, remover).
- **Última página (contracapa)**: enviar um PDF próprio.
- Ambos opcionais. Sem arquivo, o PDF sai como hoje.

Ao baixar a proposta (e na pré-visualização), o sistema monta um único PDF:

```text
[PDF da capa enviado] + [páginas geradas: Briefing, Serviços, Despesas Operacionais,
 Composição do Investimento, Investimento Total, Validade — iguais às atuais] + [PDF da contracapa]
```

Se o PDF enviado tiver mais de uma página, todas entram. O conteúdo gerado continua exatamente como está hoje (incluindo termos e assinatura, se já aparecem).

## Detalhes técnicos
- Migração: colunas `cover_pdf_url` e `back_pdf_url` (text, null) em `workspace_layout`.
- Upload no bucket `logos` existente em `{workspace_id}/cover.pdf` e `back.pdf` (aceita só `application/pdf`, limite ~10 MB).
- `LayoutPage.tsx`: campos novos no estado, upload, salvar no payload.
- Adicionar `pdf-lib`. Em `pdfGenerator.ts`, quando houver capa/contracapa: gerar o jsPDF com `skipSave`, converter para ArrayBuffer, buscar os PDFs enviados, mesclar com `PDFDocument.copyPages` e baixar o resultado. Mesma lógica aplicada à pré-visualização e ao PDF unificado contrato+proposta (`contractPDF.ts`).
- Falha ao baixar capa/contracapa: aviso e gera o PDF sem elas.
