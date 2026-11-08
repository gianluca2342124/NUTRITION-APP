# STATUS

Last updated: 2026-11-08 · Branch: `claude/nifty-mccarthy-v7012h`

## Phases
| Phase | State |
| --- | --- |
| 0 — Foundation | Done |
| 1 — Core nutrition | Done in code. AI-backed features need credentials to run live (see below) |
| **2.0 — Product experience redesign** | Done: design system, Today, streaks and achievements, Fudyu Score, product, additives, scanner, progress, onboarding, Explore, recipes, Coach preview, web |
| 2 — Connected intelligence (Coach, plans, shopping lists) | Not started. The Coach tab shows an honest preview and does not simulate answers |
| 3 — Web & SEO | Partly done: home, search, food, product, additive, recipes, methodology, credits, sitemap |
| 4 — Community | Not started. No user recipes, and none are pretended |
| 5 — Commerce & growth | Not started |

## What is new in 2.0
- **Design system:**
  - Palette with an evaluation scale (green, lime, amber, orange, coral) used only for data. Contrast-checked text tokens.
  - The Fudyu character with 5 expressions, built from the brand mark.
  - Original illustrations, motion helpers that respect Reduce Motion, bottom sheets, collapsible sections.
  - See `docs/design-2.0.md`.
- **Today:**
  - Greeting, avatar and streak pill.
  - Monday-first week strip with activity dots.
  - Compact "Tu progreso de hoy" card with energy ring and macro bars.
  - Meal cards with the user's photo, a product or food photo, or an illustration.
  - The big scan button, secondary buttons and default banners are gone.
- **Streaks and achievements (real):**
  - New tables and a validated `record_activity` RPC: one day per local date, repeated subjects ignored, ±1 day time-zone window, one grace day, opt-out.
  - Seven achievements, awarded only for real events. Celebrations happen only then.
- **Fudyu Score v1.0.0:**
  - Our Nutri-Score 2023 implementation reproduces Open Food Facts' score, grade and every component on 30 real products.
  - Banded 0–100 mapping, documented non-nutrient adjustments (NOVA 4, additive not authorised in the EU, EFSA exposure findings).
  - "Sin puntuación" when the data is not enough; 2–3 real reasons.
  - "Para ti" is kept separate from the score (declared allergens, diet, goals).
  - See `docs/fudyu-score.md`, which includes a calibration proposal.
- **Product:**
  - Order: hero, then the score, then reasons. Declared allergens are always visible.
  - Compare and Add (in a bottom sheet) actions; details on demand.
  - Score badges in the comparison view.
- **Additives:**
  - The understandable name first, a status chip and a short factual explanation, then "Qué significa", evidence and sources on demand.
  - E171 is shown as "Uso no autorizado en alimentos" (Regulation (EU) 2022/63, EFSA 2021). The superseded 2016 evaluation is no longer linked.
  - Editorial workflow states are hidden from users.
- **Scanner:**
  - Camera first, with minimal controls. Comida and Código are the main modes; Etiqueta is secondary.
  - One-line permission state.
  - "Thinking" reveal while analysing, and a reveal summary in the review screen.
- **Progress:** weekly summary, activity calendar, a trend only with at least 3 logged days ("Tu historial empieza aquí" before that), achievements with honest progress, optional weight.
- **Onboarding:** the same questions, grouped into 11 steps, with the character. The final screen is "¡Todo listo para empezar!" with goal, preferences and first activity, and the kcal target shown as secondary.
- **Explore and recipes:**
  - 10 editorial recipes, with nutrition computed from USDA and tags justified by EU claim thresholds.
  - Collections, filters, recipe screen with "Añadir una ración" and "La he preparado" (counts for the streak).
  - Discovery of foods with real photos and of additives.
- **Web:**
  - New header (Explorar, Recetas, search, Descargar app).
  - Home with a real-data demo, real foods, products, additives and recipes; no numbered cards; no empty sections.
  - Two-column product page with score and reasons, additive hero, food pages with licensed photos and a compact nutrition line.
  - Recipe pages, methodology page, image credits page.
- **Images:** 27 curated, licence-checked Wikimedia Commons photos with attribution (`docs/images.md`), and an original illustration fallback everywhere else.

## Verified in this session (commands actually run)
- `pnpm check`: typecheck and lint for every workspace; **150 unit tests** pass. Before 2.0 there were 63; the new ones cover the score, Nutri-Score, streaks, personal fit and recipes.
- `npx supabase db reset` then `pnpm test:db`: **33 integration tests** pass. They cover the earlier suites plus streaks:
  - dedup, ownership, date window, grace day, achievements, opt-out, RLS and write protection
  - recipe completion
  - recipe data
- `next build` (production): 248 pages.
- `expo export`: web and Android (Hermes bytecode) both pass.
- Mobile browser E2E (Playwright, mobile web build against the local stack) at **390×844 and 430×932**, with no page errors. It covers:
  - the full onboarding
  - Today (empty and logged)
  - search and add
  - product with live Open Food Facts import (Nutella, olive oil, oats), Fudyu Score and reasons
  - allergen and trace warnings
  - add-to-diary sheet
  - achievements unlocked by real events: first scan, food curious, recipe discoverer
  - streak sheet, methodology, E171 and E330, progress, scan permission state
  - Explore, recipe, Coach
  - in-app comparison with score badges
- Web (production server) at **1440×900, 820×1180 and 390×844**:
  - home, product, food, additive, recipes, recipe, search and methodology all render without page errors
  - no horizontal overflow on 9 pages at 390, 430, 820 and 1440 px

## Not verified / blocked
- **Real Claude calls** (meal photo, labels, text) need `ANTHROPIC_API_KEY`; the pipeline is verified with a stub only. The food-photo reveal screen was not exercised end to end for the same reason.
- **Voice transcription** needs `TRANSCRIPTION_*`.
- **Native iOS and Android:**
  - Not run on a device or simulator.
  - Unverified there: camera and barcode, haptics, Liquid Glass, Reduce Motion behaviour, and the curated images loaded from the API origin.
- **Dark mode:** tokens are defined, but the screens were not reviewed visually in dark mode.
- **Anonymous → email account upgrade:** not tested end to end.
- **CI on GitHub:** not run.

## Known limitations
- **Fudyu Score:**
  - It is an editorial summary, not a validated measure. The calibration study is still to do (`docs/fudyu-score.md`).
  - Only products with Open Food Facts Nutri-Score inputs are scored; label-scanned products show "Sin puntuación".
- **Web home:** static and revalidated hourly, so products imported after a build appear on the home page after revalidation.
- **Recipes:** 10 editorial recipes, not yet reviewed by a dietitian. Their photos show the main ingredient (labelled as illustrative).
- **Photos:** only 27 generic foods have a curated photo. No AI-generated images.
- **Comparison list:** kept in memory, so it is lost when the app restarts.
- **Carried over from 1.0:**
  - US generic catalogue (USDA)
  - no offline persistence
  - no notifications
  - Spanish-only web
  - in-memory API rate limiter
  - provisional brand, domain and store identifiers

## Next concrete tasks
1. Fudyu Score calibration on about 2,000 Spanish products from Open Food Facts, plus an expert ranking panel (see the methodology).
2. Configure `ANTHROPIC_API_KEY` and build an evaluation set (photos, labels, Spanish phrases) before tuning prompts.
3. EAS development build: verify camera, haptics, Liquid Glass, Reduce Motion and images on iOS and Android, then do a dark-mode visual pass.
4. Dietitian review of the recipes; more curated photos for the most-viewed foods.
5. Phase 2: Nutrition Coach with tool calling over the existing data layer.
