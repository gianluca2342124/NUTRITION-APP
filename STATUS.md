# STATUS

Last updated: 2026-11-08 (2.2) · Branch: `claude/nifty-mccarthy-v7012h`

## Phases
| Phase | State |
| --- | --- |
| 0 — Foundation | Done |
| 1 — Core nutrition | Done in code. AI-backed features need credentials to run live (see below) |
| **2.0 — Product experience redesign** | Done: design system, Today, streaks and achievements, Fudyu Score, product, additives, scanner, progress, onboarding, Explore, recipes, Coach preview, web |
| **2.2 — Quality and real-world readiness** | Done: simpler "+", no duplicate CTAs, nav clearance, clear amount vs correction, Profile redesign, private media, score audit, 61 licensed photos, visual recipe editor, AA contrast, 9:16 share card, compare demo flow, per-task AI models. Real AI calls and iPhone checks still pending (see below) |
| **2.1 — Premium experience upgrade** | Done: typography, score card, editable nutrient grid, chronological Today with scans, undo, new navigation with "+", Profile with moderated publications, haptics, motion and celebrations |
| 2 — Connected intelligence (Coach, plans, shopping lists) | Not started. The Coach tab shows an honest preview and does not simulate answers |
| 3 — Web & SEO | Partly done: home, search, food, product, additive, recipes, methodology, credits, sitemap |
| 4 — Community | Started: authors can draft recipes and articles and send them to review. Nothing is published without a moderator (no moderation UI yet) |
| 5 — Commerce & growth | Not started |

## What is new in 2.2
- **UX:** "+" shows Foto de comida, Código de barras and Voz first; Buscar, Leer etiqueta, Crear receta and Escribir artículo below (manual label entry moved inside "Leer etiqueta"). Today has no CTA duplicating "+". Tab screens reserve exactly the space of the floating navigation (safe areas included) and content fades under it.
- **Nutrition editing:** stat tiles are read-only. "Cambiar cantidad" only changes the numbers shown (nothing is logged); "¿El envase dice otra cosa? Corregir un dato" sends a moderated `product_correction`.
- **Profile:** cover, large avatar, name, @usuario, bio, publications grid, earned achievements, then compact private data cards. The public profile is **private by default** (`is_public`); "Cómo te ven los demás" holds the switches.
- **Security:** avatars and publication media moved to private buckets; signed URLs only for the owner, published content or avatars of public profiles (storage RLS + tests).
- **Fudyu Score 1.0.1:** audited; explanations now list only what moves the number (NOVA 1 no longer a reason, one saturated-fat reason for oils); audit tests (unique and backed reasons, monotonicity); meaning of the number documented.
- **Visual:** 61 licensed food photos (was 27); visual recipe editor (full-bleed cover, inline title, time/servings chips, ingredient photos, live nutrition, sticky actions, preview); WCAG AA contrast enforced by a token test.
- **Sharing and demo:** `/api/v1/share/product/[code]` renders a 1080×1920 PNG (real photo, name, brand, score or "Sin puntuación", level, three facts, sources); "Compartir" on the product screen. Compare: "Escanear otro" returns straight to the side-by-side view; the list survives restarts; the higher score gets a badge.
- **AI:** meal photos on Opus 5.5, labels on Sonnet 5.5 (low effort), meal text on Haiku 5.5 (low effort, no server-side fallback). Estimates in `docs/ai-costs.md`.

## Verified for 2.2 (commands actually run)
- `pnpm check`: **174 unit tests** pass (new: score audit, contrast, share facts, AI cost and fallback routing).
- `pnpm test:db`: **44 integration tests** pass (new: profile private by default, media not readable through public URLs, drafts readable only by their owner, published media and public avatars readable, scans never in "recent foods").
- `next build` passes; the share card renders for a real product (Nutella) in 3.9 s on the dev server.
- Browser E2E at 390×844 with no page errors: "+" sheet, product card with separate amount/correction sheets, share button, compare one → two products with badge, Today scan/add/delete/undo, bottom of Hoy and Perfil clear of the navigation, visual recipe editor → "Enviado a revisión", profile edit, private-by-default public view and opt-in, manual label entry from the label flow.

## Blocked / not verified in 2.2
- **Real AI calls and measured cost:** no Anthropic API key in this environment (Anthropic hosts cannot be added as a network secret here). Add `ANTHROPIC_API_KEY` as an environment variable of the cloud environment (environment menu → Edit) or on the server, then measure with `ai_usage` (`docs/ai-costs.md`).
- **iPhone:** camera, barcode, haptics, motion/Reduce Motion, voice, Liquid Glass and the share sheet need a real device (`docs/device-testing.md`).

## What is new in 2.1
- **Design system:** Plus Jakarta Sans (OFL, 400–800) on app and web; nutrient tokens and icons (`NUTRIENT_STATS`); motion durations by pattern; central `haptics.ts` with intents, throttling and a setting.
- **Fudyu Score:** big number, ring and direct level (Excelente/Bueno/Regular/Malo/Muy malo); no "¿Por qué?"; reasons in "Análisis completo". Same methodology v1.0.0.
- **Product card:** photo + score side by side, then name, brand, quantity; 8-stat grid "Por 100 g/ml" or "Mi cantidad", each with a pencil. Personal changes only change the amount; a value that differs from the package becomes a moderated `product_correction` contribution (the catalogue is never edited).
- **Today:** greeting and streak, swipeable week (any day), summary, "Recientes de hoy" in time order. Scans live in `product_scans` and never add nutrients; "Añadir" logs them in one tap with a compact amount picker. Delete with a 5 s "Deshacer" (optimistic, restored on failure; deleting an entry removes the scan it came from, never the product).
- **Navigation:** Hoy · Explorar · (+) · Coach · Perfil. "+" opens real actions: barcode, plate photo, label, voice, search, manual label entry, publish recipe, write article.
- **Profile:** photo or initials, name, @username, bio; private data cards (goal, sex, age, height, weight, activity) that recompute the target unless the person set their own; "Vista pública" shows only name, username, bio, photo, opt-in achievements and approved publications. "Mis logros" moved here from Progress.
- **Publications:** recipes (catalogue ingredients only, nutrition computed) and articles (sources required), drafts, "Enviado a revisión". Only the service role can publish or reject; editing a published item takes it back to review.
- **Celebrations:** confetti only for real achievements, streak milestones (3, 7, 14, 30…) and the first entry; off with the setting or Reduce Motion.

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

## Verified for 2.1 (commands actually run)
- `pnpm check`: typecheck and lint for every workspace; **157 unit tests** pass (new: Today feed and optimistic totals).
- `npx supabase db reset` then `pnpm test:db`: **42 integration tests** pass (new: scans never count and are private; entry deletion removes its scan; public profile privacy; achievements opt-in; moderation: authors cannot publish, ingredients of a published recipe cannot change silently, articles need sources).
- `next build` (production) passes.
- Mobile browser E2E (Playwright, 390×844, light and dark, no page errors): onboarding; product card and nutrient edit sheet; scan → "Recientes" without calories → "Añadir" → 539 kcal → delete with undo → restore → delete persisted after reload; week navigation; "+" sheet; recipe editor with catalogue ingredient → "Enviado a revisión" (never "¡Publicado!"); profile editing; weight edit recomputing the target; public view without sensitive data; article preview and review; manual label entry; settings toggles.

## Verified in 2.0
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
- **Dark mode:** reviewed in the browser for Today, the "+" sheet, Profile and Progress (2.1); other screens not reviewed.
- **Moderation:** there is no moderator UI; publishing or rejecting is done with the service role (dashboard). Community media is in a public bucket under unguessable paths, so a draft image is reachable by its exact URL.
- **Anonymous → email account upgrade:** not tested end to end.
- **CI on GitHub:** not run.

## Known limitations
- **Fudyu Score:**
  - It is an editorial summary, not a validated measure. The calibration study is still to do (`docs/fudyu-score.md`).
  - Only products with Open Food Facts Nutri-Score inputs are scored; label-scanned products show "Sin puntuación".
- **Web home:** static and revalidated hourly, so products imported after a build appear on the home page after revalidation.
- **Recipes:** 10 editorial recipes, not yet reviewed by a dietitian. Their photos show the main ingredient (labelled as illustrative).
- **Photos:** only 27 generic foods have a curated photo. No AI-generated images.
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
