# Cosmos OS

Multi-user personal workspace (React 19 + Vite + TypeScript + Tailwind 4) backed by Supabase Auth, Postgres, and Row Level Security.

```bash
npm install --legacy-peer-deps
cp .env.example .env.local     # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
npm test                       # unit + headless UI tests
npm run lint                   # tsc --noEmit
```
Setup (Supabase, Google sign-in, first admin, integrations): see [docs/SETUP.md](docs/SETUP.md).
Schema + RLS: `supabase/migrations/`. Isolation tests: `supabase/tests/`.
