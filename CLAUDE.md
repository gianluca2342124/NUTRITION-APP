# CLAUDE.md

Permanent decisions for this repo. Product spec lives with the owner; current
progress lives in `STATUS.md`.

## Architecture
- pnpm workspaces, no Turborepo. Internal packages are consumed as TypeScript
  source (`@repo/*`), transpiled by Next (`transpilePackages`) and Metro.
- Package scope is neutral (`@repo/*`); the brand lives only in
  `packages/config/src/brand.ts` (+ `app.config.ts`, i18n copy).
- `apps/web` hosts the public site AND the JSON API (`/api/v1/*`) for the app.
  Secrets (service role, AI keys) exist only there.
- The mobile app talks to Supabase directly for the user's own data (RLS) and to
  `/api/v1` for catalogue imports and AI.
- Next.js 16: Cache Components on — data reads in pages use `'use cache'` +
  `cacheLife`, runtime data goes behind `<Suspense>`; middleware is `proxy.ts`.
  Read `apps/web/node_modules/next/dist/docs/` before using unfamiliar APIs.
- Expo SDK 58: JS tabs from `expo-router/js-tabs`; read docs.expo.dev for v58
  before touching native APIs. React Compiler is on: use `sv.get()/set()` for
  Reanimated values and avoid setState-in-effect.

## Data rules (do not break)
- Nutrient values come only from catalogue data (USDA FDC, Open Food Facts,
  validated labels). AI output is perception only (foods, grams, label text).
- `NULL` means unknown — never coerce to 0; show "Sin dato".
- Diary items are snapshotted by the DB trigger; never write nutrient columns
  from clients. Meals are saved with `save_meal` and client UUIDs (idempotent).
- PostgREST bulk inserts: pass `{ defaultToNull: false }`.
- Health data requires the `health_data` consent (RLS-enforced); revoking it
  deletes the data. AI calls require `ai_processing` consent (API-enforced).
- Provenance (source, licence, update date) is shown wherever data is shown.

## Conventions
- Migrations: new file per change in `supabase/migrations/`; seeds are generated
  by `scripts/seed/build-seed.mjs` (never edit generated SQL by hand).
- Copy goes in `packages/i18n` (Spanish is the reference locale).
- Tests: unit tests next to sources (`*.test.ts`); integration tests in
  `supabase/tests/` run against `pnpm db:start`.
- AI defaults to `claude-opus-5-5` for every task; models/effort are env-configurable.
