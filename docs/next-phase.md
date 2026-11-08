# Next phase (after 2.2)

What exists now, and what is left. Nothing below is announced as done unless
it says so.

| Area | State | Next step |
| --- | --- | --- |
| Approved community recipes in Explore | **Done (2.2):** "De la comunidad" appears once a moderator publishes a recipe; detail screen with the author's photo, catalogue nutrition and "Añadir una ración". | Moderator tool (today: service role in the dashboard); notify authors of approval or rejection. |
| Indexable public recipes on the web | **Done (2.2):** `/recetas/comunidad/[id]` (published only, schema.org Recipe, sitemap) and `/api/v1/media/community/...` serving only published images. | Slugs instead of ids; Open Graph image from the share-card renderer. |
| Ingredients linked to the catalogue | **Done:** community and editorial recipes link generic foods and products; nutrition is always computed. | Portions per ingredient (e.g. "1 plátano mediano") instead of grams only. |
| Real comparisons | **Done:** side-by-side compare of two scanned products with the score badge. | — |
| Real alternatives | **Not started.** Needs enough products per category: suggest only same-category products already in the catalogue with a higher, backed score. | Category index on `products`, then an "Alternativas con mejor Fudyu Score" row on the product screen when at least one exists. |
| Nutrition Coach | **Not started** (the tab shows an honest preview). | Claude tool use over the existing data layer (diary, targets, scans, catalogue search), `ai_processing` consent, answers that cite sources; budget per user in `ai_usage`. Needs `ANTHROPIC_API_KEY`. |
