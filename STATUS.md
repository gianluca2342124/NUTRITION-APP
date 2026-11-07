# STATUS

Last updated: 2026-11-07 · Branch: `claude/nifty-mccarthy-v7012h`

## Phases
| Phase | State |
| --- | --- |
| 0 — Foundation | Done |
| 1 — Core nutrition | Done in code. AI-backed features need credentials to run live (see below) |
| 2 — Connected intelligence (Coach, recipes, plans, shopping lists) | Not started. The Coach tab says so; it does not pretend to be a chatbot |
| 3 — Web & SEO | Partly done: home, search, ingredient, product and additive pages, sitemap, robots |
| 4 — Community | Not started |
| 5 — Commerce & growth | Not started |

## What works
- **Monorepo:** Expo SDK 58 app, Next.js 16 site + API, shared packages `@repo/{config,design,core,data,ai,i18n}`.
- **Database:** Supabase migrations with RLS on every user table. Server-side nutrient snapshots, atomic idempotent `save_meal`, consent-gated health data (revoking consent deletes it), private photo buckets, search RPCs.
- **Catalogue:** 204 USDA FoodData Central foods with household portions, plus 721 additives from Open Food Facts, all with provenance. Barcode lookups import from Open Food Facts on demand, cached and snapshotted.
- **API:** health, search, product lookup, foods, additives, AI meal photo, AI label, AI text parsing, transcription, GDPR export, account deletion. Includes per-user AI quotas, an AI-processing consent check, a per-user analysis cache and CORS.
- **AI layer:** Claude adapter with structured outputs, refusal handling and server-side fallbacks, plus an OpenAI-compatible transcription adapter. The models only perceive (which foods, how much); nutrients always come from the catalogue.
- **Mobile:**
  - Anonymous-first session that can be upgraded to an email account.
  - Onboarding.
  - Today screen.
  - Scan: barcode, meal photo, label.
  - Review and correct before saving.
  - Voice and text logging.
  - Product sheet with allergen warnings, generic food page, additive page.
  - Comparison, entry editing, progress and weight, profile (targets, consents, export, delete).
- **Web:** Spanish public pages using Cache Components, breadcrumbs JSON-LD and an indexing policy (see `docs/methodology.md`).
- **Brand:** central `brand.ts`, original mark (v1 proposal), generated app and web icons, Icon Composer bundle.

## Verified in this session (commands actually run)
- `pnpm check`: typecheck and lint pass for all 8 workspaces; 63 unit tests pass.
- `pnpm test:db` against the local Supabase stack (Docker): 24 integration tests pass. They cover:
  - RLS isolation, triggers and consent rules
  - the data layer
  - AI routes with a **stub** model provider and the real database
  - account export and deletion
- `next build` passes with database credentials (234 pages) and without them (honest empty states).
- `expo export` passes for web and for Android (Hermes bytecode).
- Browser E2E with Playwright at 390×844 against the local stack, with no page errors:
  - onboarding and computed targets
  - search, then add a food
  - barcode product sheet (live Open Food Facts import), then add it
  - Today totals and meals
  - progress and the scan screen
- Live Open Food Facts results: found (Nutella, Coca-Cola, per 100 ml); a valid but unknown EAN returns not found; a wrong check digit is rejected.

## Not verified / blocked on credentials or devices
- **Real Claude calls** (meal photo, labels, text parsing): need `ANTHROPIC_API_KEY`. Only the pipeline is verified, using a stub. Recognition and portion accuracy have not been measured.
- **Voice transcription:** needs an OpenAI-compatible endpoint (`TRANSCRIPTION_*`).
- **iOS and Android on a device or simulator:** not run, as no simulator is available here. Unverified on hardware: camera, barcode scanning, microphone, haptics, Liquid Glass and the Icon Composer icon.
- **Anonymous → email account upgrade:** implemented but not tested end to end.
- **CI** (`.github/workflows/ci.yml`): committed but not yet run on GitHub.

## Known limitations
- The generic catalogue is US data (USDA SR Legacy). There is no Spanish composition database yet (BEDCA licence not verified). Spanish dishes are logged by their components.
- No offline persistence of cached queries. When offline, screens show error states with retry.
- No notifications. The onboarding question was removed until they are implemented.
- The app language follows the device. There is no in-app switch.
- The web is Spanish only: no hreflang or localised routes, no compare/recipe/article pages.
- Additive pages show unreviewed Open Food Facts data plus one editorial override (E171).
- The API rate limiter is in-memory, so it applies per instance. The AI quotas are database-backed.
- No subscriptions or monetisation yet.
- The brand mark is a proposal pending design review. Name, domain and store IDs are provisional.

## Next concrete tasks
1. Configure `ANTHROPIC_API_KEY`, then build a small eval set (about 20 meal photos, 20 labels, 30 Spanish phrases) to measure food recognition and portion error before tuning prompts or effort.
2. Run on devices with an EAS development build and fix any native issues.
3. Phase 2: Nutrition Coach with tool calling over the existing data layer (`get_daily_log`, `search_products`, `compare_products`, `get_additive_evidence`), plus a recipes schema with ingredients linked to catalogue foods and products.
