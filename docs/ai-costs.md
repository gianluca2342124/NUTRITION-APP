# AI: models per task and cost per analysis

AI only perceives (foods, grams, label text); every nutrient value comes from
the catalogue. Calls happen on the server (`apps/web`), never on the device.

## Models per task (defaults, all overridable by env)

| Task | Route | Model | Effort | Why |
| --- | --- | --- | --- | --- |
| Meal photo → foods + grams | `/api/v1/ai/meal-photo` | `claude-opus-5-5` | medium | Hardest perception task (portion size from a photo). |
| Nutrition label photo → values | `/api/v1/ai/label` | `claude-sonnet-5-5` | low | Reading a printed table; every value is validated and reviewed by the person before saving. |
| Short meal text → items | `/api/v1/ai/parse-meal` | `claude-haiku-5-5` | low | Simple extraction; matching to foods is done by our catalogue search. |
| Voice → text | `/api/v1/ai/transcribe` | speech-to-text provider (`TRANSCRIPTION_*`) | — | Claude does not transcribe audio. Use the provider's standard speech-to-text model (billed per audio minute), never an LLM. |
| Coach (not active) | — | `claude-opus-5-5` | medium | Not built yet. |

Env vars: `AI_MODEL_VISION`, `AI_MODEL_EXTRACTION`, `AI_MODEL_CLASSIFICATION`,
`AI_MODEL_CONVERSATION` and `AI_EFFORT_*`. The server-side refusal fallback is
only sent to models that support it (not to Claude Haiku 5.5).

## Estimated cost per analysis (not measured yet)

Assumptions: prices in `packages/ai/src/cost.ts` (USD per million tokens:
Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50); photos are
downscaled on the phone to 1600 px (≈2,500 image tokens); prompt + schema
sizes measured from the code (meal photo ≈8.7k characters with the 204-food
catalogue, label ≈3.0k, text ≈8.4k); thinking at the chosen effort counted as
output; no prompt-cache hits assumed.

| Analysis | Input tokens | Output tokens | Estimated cost |
| --- | --- | --- | --- |
| Meal photo (Opus 5.5) | ≈5,500 | ≈800–2,000 | ≈$0.04–0.06 |
| Label (Sonnet 5.5) | ≈3,400 | ≈400–700 | ≈$0.011–0.014 (was ≈$0.03–0.05 on Opus) |
| Meal text (Haiku 5.5) | ≈2,700 | ≈200–500 | ≈$0.0005 (was ≈$0.015–0.02 on Opus) |

## Measuring the real cost

Every call is logged in `ai_usage` (feature, model, input/output tokens,
latency). With `ANTHROPIC_API_KEY` configured on the server, run each flow a
few times and price the rows:

```sql
select feature, model, count(*) as calls,
       avg(input_tokens) as avg_in, avg(output_tokens) as avg_out, avg(latency_ms) as avg_ms
from public.ai_usage where status = 'ok' group by 1, 2 order by 1;
```

Multiply the averages with `estimateCostUsd()` (`@repo/ai`). Not done yet:
this environment has no Anthropic API key (see `STATUS.md`). Before switching
any task to a cheaper model in production, confirm quality on an evaluation
set of real photos, labels and Spanish phrases.
