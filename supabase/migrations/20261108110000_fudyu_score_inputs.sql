-- =============================================================================
-- Fudyu Score inputs (Fudyu 2.0)
--
-- * products.nutriscore_inputs: what only the source can tell us to compute
--   the Nutri-Score 2023 ourselves (category flags, fruit/vegetable/legume
--   share, sweeteners, declared kJ) plus the source's own result for audit.
--   Products imported earlier are refreshed from Open Food Facts on their next
--   lookup (see apps/web/src/server/products.ts).
-- * additives: EU regulatory status and short editorial texts. The status is
--   'unknown' unless it has been verified editorially (seeded from
--   data/additives/overrides.json); the UI never guesses it.
-- =============================================================================

alter table public.products add column nutriscore_inputs jsonb;

alter table public.additives
  add column eu_status text not null default 'unknown' check (eu_status in ('authorised', 'not_authorised', 'unknown')),
  add column eu_status_since date,
  add column eu_status_note_es text,
  add column eu_status_note_en text,
  add column summary_es text,
  add column summary_en text,
  add column implication_es text,
  add column implication_en text;
