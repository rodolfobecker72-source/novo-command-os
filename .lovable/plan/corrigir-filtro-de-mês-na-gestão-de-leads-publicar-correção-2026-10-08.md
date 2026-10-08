# Corrigir filtro de mês na Gestão de Leads (publicar correção)

## Diagnóstico (confirmado)

- **Sintoma relatado:** lead criado no mês atual só aparece em "Todos os meses"; ao aplicar o filtro do mês, ele some.
- **Causa raiz:** na versão **publicada** (go.command-os.app.br, bundle `index-30YREROb.js`), o filtro de mês tem um erro de offset:
  - o seletor de mês usa valores 0–11 (`Janeiro=0` ... `Outubro=9`);
  - mas o filtro compara `getMonth() + 1 !== mêsEscolhido` (1–12);
  - resultado: ao escolher "Outubro", o sistema filtra **setembro** — os leads criados em outubro desaparecem e os de setembro aparecem no lugar.
- **O código atual do projeto já está corrigido**: `src/pages/prospection/ProspectionPage.tsx` compara `d.getMonth() !== Number(filterMonth)` (0–11), coerente com o seletor.
- **Verificação no build atual (Playwright + dados reais):** com filtro "2026 / Outubro", aparecem exatamente os leads de outubro (Bimbo, Arco Educação, Construtora e Incorporadora Ribeiro, Intelbras) e nenhum de setembro (Institudo Active e John Deere ficam de fora). Screenshot: `/tmp/browser/lead-filter/7_outubro.png`.

## O que fazer

1. Nenhuma alteração de código é necessária — a correção já está no código-fonte atual.
2. Publicar o app (deploy) para que go.command-os.app.br receba o build corrigido.
3. Após publicar, conferir no ar que o filtro "Outubro" passa a exibir os leads criados em outubro.

## Impacto

- Nenhum dado é afetado — o problema é só da versão publicada em execução; os dados dos leads estão íntegros no banco.
