# Fudyu Score — methodology (v1.0.0)

The Fudyu Score summarises a **packaged product** on a 0–100 scale. It is an
editorial summary built on public, documented criteria. It is **not** a
validated health measure and does not replace professional advice. The app
shows it with a link to this methodology ("Ver cómo se calcula").

Implementation: `packages/core/src/score.ts` (engine) and
`packages/core/src/nutriscore.ts` (Nutri-Score 2023). Tests:
`score.test.ts`, `nutriscore.test.ts`.

## 1. Levels

| Score | Level | Colour | Label (es) |
| --- | --- | --- | --- |
| 80–100 | excellent | green `#20C78A` | Excelente |
| 60–79 | good | lime `#A4D950` | Bueno |
| 40–59 | fair | amber `#F4B23A` | Regular |
| 20–39 | poor | orange `#F08042` | Malo |
| 0–19 | limit | coral `#E65762` | Muy malo |

Colour never carries the meaning alone: every score shows its number and its label.
Since 2.1 the labels are direct (the bands, weights and internal level keys did
not change, so `FUDYU_SCORE_VERSION` stays 1.0.0). The reasons live in
"Análisis completo → Qué influye en la puntuación", not under the score. The
score rates the product's nutritional profile; it is never a disease risk or a
personal medical assessment.

## 2. How it is calculated

### 2.1 Nutrition (the base)
1. We compute the product's **Nutri-Score 2023** ourselves:
   - **Algorithm:** the Scientific Committee's 2022 update for foods and 2023 update for beverages.
   - **Our inputs:** nutrient values per 100 g/ml from the catalogue.
   - **Inputs only the source knows,** taken from Open Food Facts:
     - category flags (beverage, water, cheese, fats/oils/nuts/seeds, red meat)
     - the fruit/vegetable/legume share
     - non-nutritive sweeteners
     - declared kJ
   - **Validation:** the implementation reproduces Open Food Facts' result (score, grade and every component) for 30 real products across all categories (`__fixtures__/off-nutriscore-2023.json`).
2. The Nutri-Score points are mapped linearly **inside the band of the product's grade**:

   | Category | A | B | C | D | E |
   | --- | --- | --- | --- | --- | --- |
   | General, cheese, red meat | −15…0 → 100…80 | 1…2 → 79…60 | 3…10 → 59…40 | 11…18 → 39…20 | 19…40 → 19…0 |
   | Fats, oils, nuts, seeds | −15…−6 → 100…80 | −5…2 → 79…60 | as general | as general | as general |
   | Beverages | water only → 100 | −10…2 → 79…60 | 3…6 → 59…40 | 7…9 → 39…20 | 10…30 → 19…0 |

   Points beyond each end clamp to that end. Before adjustments, the Fudyu
   level therefore always matches the Nutri-Score grade (A→green … E→coral);
   a test checks this on the 30 real products.

### 2.2 Adjustments (not nutrient-based, so nothing is counted twice)

| Adjustment | Points | Why |
| --- | --- | --- |
| Ultra-processed (NOVA 4, as classified by Open Food Facts) | −8 | Precautionary. Observational evidence associates high consumption of ultra-processed foods with worse health outcomes; causality and mechanisms are still debated, hence the small weight. |
| Contains an additive **not authorised** as a food additive in the EU (editorially verified; today E171 under Regulation (EU) 2022/63) | −15 | Material regulatory fact. |
| Each additive whose **EFSA re-evaluation estimated intakes above the ADI** for some population groups (Open Food Facts taxonomy, 95th percentile) | −4 each, max −8 | Precautionary: reducing sources of an additive with documented exposure concerns. |

- Together, the adjustments never go below −25.
- **Authorised additives without such findings are not penalised.** Their presence alone says nothing about safety.
- The final score is `round(nutrition + adjustments)`, clamped to 0–100.

### 2.3 What we do not do
- **No invented numbers.** We show *"Sin puntuación"* (never 0) when:
  - there is no nutrition table;
  - energy, sugars, saturated fat or salt is missing (for fats: total fat too);
  - the category is unknown;
  - the Nutri-Score does not apply (e.g. alcoholic drinks, baby food, herbs and spices).
- **No filling of gaps.** Missing fibre, protein or fruit/vegetable share score 0 points (they cannot inflate the result). Unknown processing or additives cannot change the score either. All of them are listed as "unknown" next to the score.
- **No personal data in the score.** It is the same for everyone. Personal fit ("Para ti": declared allergens, diet, goals) is computed separately (`personal.ts`) and never changes the score.
- **No generic foods.** Fresh foods from USDA have no Fudyu Score, because the inputs the method needs are not available.

## 3. Reasons shown ("¿Por qué?")
- **Concerns:** Nutri-Score components that reach at least 40 % of their maximum points (energy only from 60 %). "Muy alto" is used from 67 %. The adjustments above are also concerns.
- **Strengths:** positive components (fibre, protein, fruits/vegetables/legumes) from 40 % of their maximum. NOVA 1 counts too.
- **"Low in" claims** use the thresholds of Regulation (EC) No 1924/2006:
  - sugars ≤ 5 g (≤ 2.5 g/100 ml)
  - salt ≤ 0.3 g
  - saturated fat ≤ 1.5 g (≤ 0.75 g/100 ml) and ≤ 10 % of energy
- **Selection:** at most three reasons. Strengths come first for green or lime scores; concerns come first otherwise. A reason of the opposite sign is added only when it is substantial.

## 4. Preliminary check on real products (v1.0.0, November 2026)
Open Food Facts data (ODbL); NOVA as classified by Open Food Facts.

| Product | Nutri-Score category | Grade (points) | NOVA | Nutrition | Adjustments | Fudyu |
| --- | --- | --- | --- | --- | --- | --- |
| Mineral waters (3) | water | A (0) | 1 | 100 | — | **100** excellent |
| Crispbreads "Authentique", "Fibres" | general | A (0) | 3 | 80 | — | **80** excellent |
| Muesli with nuts | general | B (1) | 4 | 79 | NOVA 4 −8 | **71** good |
| Extra virgin olive oils (3) | fats/oils | B (0…2) | 2 | 60–65 | — | **60–65** good |
| Semi-skimmed milk | beverage | B (0) | 1 | 63 | — | **63** good |
| Coca-Cola Zero Sugar | beverage | C (4) | 4 | 53 | NOVA 4 −8, exposure −8 | **37** poor |
| Pringles Original | general | D (11) | 4 | 39 | NOVA 4 −8 | **31** poor |
| Cream cheese (Philadelphia) | cheese | D (14) | 4 | 31 | NOVA 4 −8 | **23** poor |
| Nutella | general | E (31) | unknown | 8 | — | **8** limit |
| Coca-Cola Original | beverage | E (12) | 4 | 17 | NOVA 4 −8, exposure −8 | **1** limit |
| Chorizo ibérico | general | E (33) | 4 | 6 | NOVA 4 −8, exposure −8 | **0** limit |

## 5. Calibration proposal (next versions)
1. **Sample:**
   - about 2,000 products sold in Spain from the Open Food Facts export
   - stratified by 30 categories, including breakfast cereals, yogurts, cheeses, cured meats, oils, soft drinks, plant drinks, biscuits, ready meals and crisps
2. **Outputs per category:**
   - Fudyu distribution versus Nutri-Score
   - share of products moved to another level by the adjustments
   - share of products without a score, and why
3. **Expert review:**
   - a panel (dietitian-nutritionist plus food technologist) blind-ranks 20 products per category
   - we measure agreement (Spearman) and inspect disagreements
4. **Decisions to make with that evidence:**
   - **E-band compression:** many ultra-processed E products end at 0–10, hiding differences inside "Conviene limitarlo".
   - **Adjustment weights:** whether the NOVA weight should depend on the category.
   - **Additive list:** which EFSA exposure findings justify an adjustment.
   - **Alcohol:** whether to keep "Sin puntuación".
   - **Within-category comparison:** a "best in its category" view, so that cheeses or oils can be compared among themselves without changing the base scale.
5. **Release:**
   - every change bumps `FUDYU_SCORE_VERSION`
   - each change is listed here with its date and reason
   - the tests are updated in the same change

## 6. Changelog
- **1.0.0 (2026-11-08):** first version.
