# Fudyu 2.0 — audit and design system

## 1. Brief audit (before the redesign)

| Area | Findings |
| --- | --- |
| Today | Three competing entry points to the same action: the floating Scan button, the big "Escanear comida o producto" button and the Voz/Buscar pair. Days are navigated only with chevrons, with no week context or activity view. The calorie card leads with "Quedan X kcal", a deficit framing. Macros are three large tiles. Meal rows repeat "P · H · G" letters. Two info banners are often visible together. Meals have no images. |
| Product | The 200 px image, Nutri-Score/NOVA badges and provenance captions sit at the same level. Nothing synthesises the evaluation. The add-to-diary amount card comes before the analysis. Additives are bare E-numbers. Allergen warnings are correct and must stay prominent. |
| Additive | The title is the E-number, with the name as subtitle. A "Ficha pendiente de revisión editorial" banner is shown to users. For E171 the 2016 EFSA evaluation appears next to the override note. |
| Scanner | Three equal modes. The permission card has two paragraphs and three buttons. |
| Progress | A chart is drawn even with one day of data. There are no streaks or achievements. |
| Onboarding | Text heavy. The summary leads with kcal. |
| Web | The home page has numbered "01/02/03" cards and no demonstration of the product. The header has no Recetas link or search. The product page uses badges. The additive page shows a "pendiente de revisión" pill. |
| System | No evaluation colour scale, motion primitives, image system, character, bottom sheet or collapsible sections. |

## 2. Principles applied
- **One primary element per screen, two or three secondary, the rest on demand** (collapsible sections, bottom sheets).
- **Blue = brand and primary actions.** Green, lime, amber, orange and coral are used only for evaluations, states and charts that the data justifies. Surfaces are white with very soft tints.
- **Honesty is part of the design.** "Sin puntuación" instead of an invented number; "Tu historial empieza aquí" instead of a one-point chart; real photos or labelled illustrations, never fake packaging.
- **Messages stay visible only when they matter:** declared allergens, justified immediate risks, material regulatory facts (for example E171 not authorised), blocking errors, consent. Everything else is level 3–4 (on demand).
- **Motion communicates:** counters count up to real values, cards appear in reading order, celebrations happen only for real achievements. Everything respects Reduce Motion.

## 3. Tokens (`packages/design/src/tokens.ts`)
- **Palette:**

  | Token | Colour |
  | --- | --- |
  | BRAND BLUE | `#295BFF` |
  | FRESH GREEN | `#20C78A` |
  | LIGHT LIME | `#A4D950` |
  | AMBER | `#F4B23A` |
  | ORANGE | `#F08042` |
  | CORAL RED | `#E65762` |
  | DEEP INK | `#172033` |
  | SOFT BACKGROUND | `#F7F9FC` |

  Each scale colour has a `*Soft` surface and a `*Text` variant that is contrast-checked: ≥ 4.5:1 on its soft surface.
- **Evaluation levels:** `scoreTone(level)` maps a Fudyu Score level to fill, soft and text colours. Colour is never the only carrier: every score shows its number and a label.
- **Macros** use violet, sky and orchid, kept off the evaluation hues so they don't read as judgements.
- **Shape and depth:** radii 12, 18, 24, 32, 40 and pill; diffuse shadows (`card`, `floating`); type adds `hero` (score numbers) and `micro` (day letters).
- **Motion:** `fast` 160 ms, `base` 240, `slow` 320, `reveal` 700 (counters), `stagger` 45; one spring.

## 4. Character
`packages/design/src/character.ts` defines the shapes of the Fudyu character. The squircle body comes from the app icon, the smile is the bowl arc, and the green seed is the accent. It has five expressions (smile, curious, celebrate, attention, thinking) and is rendered by `FudyuCharacter` (mobile) and `Character` (web). It appears only on welcome, achievements, empty states, positive results and completion.

## 5. Components
- **Mobile (`apps/mobile/src/components`):**
  - Scores: FudyuScoreRing, ScoreBadge, ScoreExplanation
  - Streaks and calendar: WeeklyDayStrip, StreakPill, StreakCalendar, AchievementBadge
  - Food and meals: FoodImage, FoodCard, MealCard
  - Product: ProductHero, ProductHighlights, NutritionSummary, AdditiveSummary
  - States and layout: FriendlyEmptyState, FloatingNavigation, ScannerControls, SectionHeader
  - Discovery: RecipeCard, RecipeHero, DiscoverCard
  - Metrics and motion: VisualMetric, AnimatedCounter
  - Containers: BottomSheet, Collapsible
- **Web (`apps/web/src/components`):** the same vocabulary as server components, using the same tokens (CSS variables) and the same character and illustration geometry.

## 6. Images
See `docs/images.md`:
- real user photos for meals
- Open Food Facts photos for products
- a curated, licence-checked Wikimedia Commons set for generic foods and recipes
- original category illustrations as the fallback

AI-generated images are not used yet. The data model leaves room for them, labelled "Imagen ilustrativa".
