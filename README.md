# Fudyu — Know your food.

Food intelligence platform: an iOS/Android app and a public website that share one
backend. Photograph a meal, scan a barcode or describe what you ate; review the
result; save it to a private diary. Nutrient values always come from verifiable
databases (USDA FoodData Central, Open Food Facts) — AI only identifies foods
and amounts.

> The name, domain and identifiers are provisional and live in
> [`packages/config/src/brand.ts`](packages/config/src/brand.ts).

## Repository

```
apps/mobile     Expo SDK 58 app (expo-router, React Native 0.88)
apps/web        Next.js 16 site + JSON API (/api/v1) used by the app
packages/config brand + locales            packages/design  design tokens
packages/core   domain logic, schemas      packages/data    Supabase repositories
packages/ai     AI provider abstraction    packages/i18n    es/en copy
supabase/       migrations, seeds, integration tests
scripts/seed    builds catalogue seeds from the primary sources
docs/           methodology
```

## Quick start

Requirements: Node 22+, pnpm 10, Docker (for the local Supabase stack).

```bash
pnpm install
```

```bash
pnpm db:start
```

```bash
npx supabase db reset
```

`db reset` applies the migrations and loads the catalogue seeds. Then copy the
keys printed by `npx supabase status` into `apps/web/.env.local` and
`apps/mobile/.env.local` (see [`.env.example`](.env.example)).

```bash
pnpm dev:web
```

```bash
pnpm dev:mobile
```

The web app serves the site at <http://localhost:3000> and the API the mobile
app uses. The mobile app needs a development build for the camera, barcode
scanner and microphone (`npx expo run:ios` / `run:android`, or an EAS
development build); on a physical device set `EXPO_PUBLIC_API_URL` to your
computer's LAN address.

Regenerate the catalogue seeds from the primary sources (downloads USDA SR
Legacy and the Open Food Facts additives taxonomy into `data/raw/`):

```bash
pnpm seed:build
```

## Checks

```bash
pnpm check
```

runs typecheck + lint + unit tests for every workspace. Integration tests run
against the local Supabase stack (RLS, triggers, data layer and the AI routes
with a stub model provider):

```bash
pnpm test:db
```

```bash
pnpm build:web
```

## Integrations that need credentials

| Feature | Variable(s) | Without it |
| --- | --- | --- |
| Supabase (auth, diary, catalogue) | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `EXPO_PUBLIC_SUPABASE_*` | apps show "not configured" |
| Meal photos, labels, text logging | `ANTHROPIC_API_KEY` | API returns `ai_not_configured`; manual search/logging still works |
| Voice transcription | `TRANSCRIPTION_API_URL`, `TRANSCRIPTION_API_KEY`, `TRANSCRIPTION_MODEL` | typed input |
| Open Food Facts | none (set `OFF_USER_AGENT` with a contact) | — |

All AI tasks default to `claude-opus-5-5`; each task's model and effort are
configurable (`AI_MODEL_*`, `AI_EFFORT_*`).

## Deploying

- **Database:** create a Supabase project, enable anonymous sign-ins
  (Authentication → Providers), then `npx supabase link` and
  `npx supabase db push`. Load the catalogue with
  `psql "$DATABASE_URL" -f supabase/seeds/01_generic_foods.sql -f supabase/seeds/02_additives.sql`.
- **Web/API:** any Node host for Next.js (e.g. Vercel) with the variables from
  `.env.example`. AI routes declare `maxDuration` up to 90 s.
- **Mobile:** EAS Build/Submit with `APP_IOS_BUNDLE_ID` / `APP_ANDROID_PACKAGE`
  set. Nothing is submitted or published automatically.

See [`STATUS.md`](STATUS.md) for what is done, verified and pending, and
[`docs/methodology.md`](docs/methodology.md) for data and calculation rules.

## Data attribution

Product and additive data © Open Food Facts contributors, under the Open
Database License. Generic food data: USDA FoodData Central (public domain).
