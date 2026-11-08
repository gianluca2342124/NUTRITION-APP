# Methodology (v1)

How the platform turns photos, barcodes and descriptions into nutrition numbers,
and what it deliberately does not do. Versioned with the code; changes here
should bump the relevant version identifier.

## 1. Data sources

| Data | Source | Licence | Where |
| --- | --- | --- | --- |
| Generic foods (204) | USDA FoodData Central, SR Legacy (2018-04) | CC0 (public domain) | `data/generic-foods/foods.csv` → `supabase/seeds/01_generic_foods.sql` |
| Household portions | USDA SR Legacy `food_portion` | CC0 | same seed; ml portions derived from USDA cup / fl oz / tbsp weights |
| Branded products | Open Food Facts API v2 (imported on demand, cached 30 days) | ODbL 1.0 / DbCL / CC BY-SA (images) | `products`, raw payload in `product_snapshots` |
| Additives (721) | Open Food Facts additives taxonomy | ODbL 1.0 | `supabase/seeds/02_additives.sql` |
| Additive overrides | Editorial, with primary sources (EFSA, EUR-Lex) | — | `data/additives/overrides.json` |

Rules:
- Nutrient values are copied verbatim from the source. Unknown is stored as
  `NULL` and shown as "Sin dato" — never as 0.
- Spanish names, categories and portion labels are editorial work on top of the
  source data; a USDA portion that does not match its Spanish label is excluded
  explicitly (see `EXCLUDED_PORTIONS` in `scripts/seed/build-seed.mjs`).
- Open Food Facts derived fields are labelled with their provenance: Nutri-Score
  is "calculated by Open Food Facts from declared data"; NOVA is "estimated by
  Open Food Facts from ingredients". Products registered for other countries
  carry a note that the local formulation may differ.
- Additive records are shown as "pending editorial review". EFSA documents linked
  from the taxonomy are displayed verbatim (some are not food-additive safety
  evaluations — e.g. the E330 link concerns food-contact materials). Known
  superseded evaluations get an editorial note with primary sources (E171).

## 2. Diary integrity

- Catalogue-backed diary items are snapshotted server-side by a trigger
  (`prepare_food_entry_item`): the client cannot alter their nutrient values,
  and later catalogue updates never rewrite history. Each item stores its
  source, source id and data version.
- Custom items (label photos, user entries) are validated for type and
  plausibility (≤ 900 kcal/100 g, macros ≤ 102 g/100 g).
- Meals are saved atomically and idempotently (`save_meal` RPC with
  client-generated UUIDs): retries never duplicate entries.
- Amounts estimated from photos or unstated quantities are flagged
  `is_estimate` until the user adjusts them.

## 3. Daily targets (`mifflin_st_jeor_v1`)

- Resting energy: Mifflin-St Jeor (1990). "Prefer not to say" uses the midpoint
  of the sex constants (−78).
- Total energy: resting energy × activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
- Goal adjustment: lose −15 %, gain +10 %, build muscle +5 %, otherwise none.
- Safety rails: no deficit when BMI < 18.5; never below max(resting energy,
  1200 kcal); no energy targets for users under 18; target weights below
  BMI 18.5 are not accepted; user-defined energy targets must be 1000–6000 kcal.
- Protein: 1.0 g/kg (above the EFSA PRI of 0.83 g/kg), 1.4 g/kg when losing
  weight, 1.6 g/kg for muscle/protein goals; reference weight = weight at
  BMI 25 when BMI > 25.
- Fat: 30 % of energy (EFSA reference intake range 20–35 %). Carbohydrate:
  remaining energy. Fibre: 25 g/day (EFSA adequate intake for adults).
- Targets are estimates for healthy adults, always editable, never medical advice.

## 4. AI: perception only

Models identify foods, estimate portions, read labels and parse descriptions.
They never produce nutrient values.

1. The model receives the catalogue (slug + English name) and returns, per item,
   the closest catalogue slug or `null`, a generic description, an estimated
   weight with a min–max range and a confidence level. Hidden ingredients
   (oil, butter, sugar) become yes/no questions instead of silent additions.
2. Output is validated with strict schemas and sanitised (clamped amounts,
   repaired ranges, invalid slugs dropped).
3. Unmatched items are matched by text (`match_generic_foods`, word overlap +
   trigram similarity); below the threshold the user must choose.
4. Nutrients = catalogue values × grams / 100, computed deterministically.
5. Spoken quantities use USDA household portions ("dos huevos" = 2 × medium
   egg 44 g) and USDA-derived densities for millilitres.
6. Labels are transcribed, then validated deterministically (kJ↔kcal ratio,
   energy vs macros, sugars ≤ carbohydrates, saturates ≤ fat, salt = sodium × 2.5,
   per-100 g plausibility). Issues are shown next to the fields.

Content in user input and images is wrapped as untrusted data in prompts.
AI use requires an explicit `ai_processing` consent, is rate-limited per user,
and identical photos are served from a per-user cache keyed by SHA-256 + prompt
version.

## 5. Comparisons

Comparisons are per 100 g/ml and neutral ("A contains more protein per 100 g"),
ordered by the user's goal. A difference is mentioned only when it is both
absolute-meaningful (e.g. ≥ 1 g protein, ≥ 0.1 g salt) and ≥ 10 % relative.
Different bases (g vs ml) or unrelated categories are flagged; there is never a
universal "better" verdict.

## 6. Public pages and indexing

Indexed: generic food pages (verified data) and products with a name and
nutrition data. Not indexed: search results, products without nutrition data,
unreviewed additive records. Every page shows its source, licence and update date.

## 7. Fudyu Score (v1.0.0)
How packaged products are evaluated, and when they show "Sin puntuación": see [`fudyu-score.md`](fudyu-score.md).
- **Base:** our Nutri-Score 2023 implementation, verified against Open Food Facts on 30 real products.
- **Adjustments:** small, documented, and never based on nutrients, so nothing is counted twice.
- **"Para ti":** personal fit (declared allergens, diet, goals) is computed separately and never changes the score.

## 8. Streaks and achievements
- **What counts:** an active day is a local calendar day with at least one eligible action:
  - logging a meal
  - analysing a product for the first time
  - comparing a new pair of products
  - opening an additive for the first time
  - marking a recipe as made (once per recipe per day)
- **Validation:** the server checks each event against real data (the meal is the user's, the product, additive or recipe exists). The same subject never counts twice.
- **Dates:** the device's local date is accepted within ±1 day of the UTC date, which covers every time zone and travel.
- **Grace day:** one missed day keeps the streak; two in a row end it. The streak counts active days, not calendar days.
- **Single write path:** `public.record_activity` (SECURITY DEFINER) is the only way to write these tables; clients can only read their own rows.
- **No pressure:** no paid repairs, no penalties, no alarming notifications. Gamification can be switched off in the profile, which stops tracking.
- **Achievements:** awarded only for real events, with thresholds in `packages/core/src/streaks.ts` and the SQL function.

## 9. Recipes
- **Authorship:** editorial recipes written by the Fudyu team (`data/recipes/recipes.json`). There are no user-published recipes.
- **Nutrition:** ingredients reference catalogue foods by slug, and nutrition is always computed from USDA values (`recipeNutrition`), never typed by hand.
- **Tags:** "Alta en proteínas", "Fuente de fibra" and similar tags are shown only when the data meets the Regulation (EC) 1924/2006 thresholds.
- **Photos:** recipe photos are licensed photos of the main ingredient, labelled "Foto ilustrativa". See [`images.md`](images.md).
