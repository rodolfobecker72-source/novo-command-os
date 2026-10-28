# Command OS

Gestão comercial para audiovisual: leads, CRM, propostas, projetos e financeiro.

## Stack
- React + Vite + TypeScript, Tailwind e shadcn/ui
- Supabase (banco Postgres, autenticação, arquivos, realtime e edge functions)
- Hospedagem na Vercel: `https://acesso.command-os.app.br`

## Rodar localmente
```bash
npm ci
cp .env.example .env.local   # preencha com os dados do projeto Supabase
npm run dev
```

Verificações antes de publicar:
```bash
npx tsc -p tsconfig.app.json --noEmit
npm test
npm run build
```

## Banco de dados
- O schema completo está em `supabase/migrations/20261028000000_baseline.sql`.
- Mudanças novas entram como novas migrations em `supabase/migrations/`
  (nome `AAAAMMDDHHMMSS_descricao.sql`).
- Projeto Supabase: `ckfhxjmhbvpazprwcnmq` (região São Paulo).

## Variáveis de ambiente
| Nome | Onde obter |
|---|---|
| `VITE_SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase > Project Settings > API Keys > publishable key |
