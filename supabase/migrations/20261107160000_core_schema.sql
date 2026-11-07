-- =============================================================================
-- Core schema: profiles, consents, targets, catalogue (generic foods, products,
-- additives, sources), food diary, favourites, AI usage, contributions.
--
-- Conventions
-- * Text + CHECK constraints instead of enums (easier to evolve).
-- * Every user-owned table has RLS keyed on (select auth.uid()).
-- * Catalogue tables are world-readable; only the service role writes them.
-- * Nutrient columns are per 100 g / 100 ml of the row's basis. NULL = unknown.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(input, '')));
$$;

create or replace function public.join_search_text(parts text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select public.normalize_search_text(array_to_string(parts, ' '));
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles & preferences
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  locale text not null default 'es' check (locale in ('es', 'en')),
  country text not null default 'ES' check (country ~ '^[A-Z]{2}$'),
  region text check (char_length(region) <= 60),
  timezone text check (char_length(timezone) <= 64),
  primary_goal text not null default 'eat_balanced' check (primary_goal in (
    'eat_balanced', 'understand_food', 'gain_weight', 'lose_weight', 'maintain_weight',
    'build_muscle', 'increase_protein', 'organize_meals', 'compare_products', 'learn_nutrition')),
  goals text[] not null default '{}',
  keep_meal_photos boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  diet text check (diet in ('omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'vegan', 'other')),
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  meals_per_day smallint check (meals_per_day between 1 and 8),
  cooking_time text check (cooking_time in ('under_15', '15_30', '30_60', 'over_60')),
  budget text check (budget in ('tight', 'moderate', 'comfortable', 'prefer_not_say')),
  stores text[] not null default '{}',
  usage_modes text[] not null default '{}',
  notifications_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- Append-only consent log (GDPR). The latest row per type is authoritative.
create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consent_type text not null check (consent_type in ('health_data', 'ai_processing', 'photo_storage', 'analytics')),
  granted boolean not null,
  policy_version text not null check (char_length(policy_version) <= 32),
  created_at timestamptz not null default now()
);

create index user_consents_lookup on public.user_consents (user_id, consent_type, created_at desc);

create or replace function public.has_consent(p_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted
    from public.user_consents c
    where c.user_id = auth.uid() and c.consent_type = p_type
    order by c.created_at desc, c.id desc
    limit 1
  ), false);
$$;

-- Special-category data (GDPR art. 9). Only writable with an active consent.
create table public.health_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  birth_year smallint check (birth_year between 1900 and 2100),
  sex text check (sex in ('female', 'male', 'unspecified')),
  height_cm numeric(5, 1) check (height_cm between 120 and 230),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 30 and 300),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  weekly_workouts smallint check (weekly_workouts between 0 and 14),
  allergies text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create trigger health_profiles_updated_at before update on public.health_profiles
  for each row execute function public.set_updated_at();

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null,
  weight_kg numeric(5, 1) not null check (weight_kg between 30 and 300),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

-- Revoking health-data consent erases the related data immediately.
create or replace function public.apply_consent_revocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_type = 'health_data' and not new.granted then
    delete from public.health_profiles where user_id = new.user_id;
    delete from public.weight_logs where user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger user_consents_revocation after insert on public.user_consents
  for each row execute function public.apply_consent_revocation();

create table public.daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_from date not null,
  energy_kcal integer check (energy_kcal between 1000 and 6000),
  protein_g integer check (protein_g between 0 and 400),
  carbs_g integer check (carbs_g between 0 and 1000),
  fat_g integer check (fat_g between 0 and 400),
  fiber_g integer check (fiber_g between 0 and 100),
  method text not null check (method in ('mifflin_st_jeor_v1', 'user_defined')),
  inputs jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

create or replace function public.target_for_date(p_date date)
returns setof public.daily_targets
language sql
stable
set search_path = ''
as $$
  select t.*
  from public.daily_targets t
  where t.user_id = (select auth.uid()) and t.effective_from <= p_date
  order by t.effective_from desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Catalogue: generic foods
-- ---------------------------------------------------------------------------

create table public.generic_foods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_es text not null,
  name_en text not null,
  synonyms_es text[] not null default '{}',
  synonyms_en text[] not null default '{}',
  category text not null check (category in (
    'fruits', 'vegetables', 'legumes', 'grains', 'dairy', 'eggs', 'meat', 'fish_seafood',
    'fats_oils', 'nuts_seeds', 'sweets_snacks', 'beverages', 'condiments', 'prepared', 'other')),
  basis text not null default '100g' check (basis in ('100g', '100ml')),
  energy_kcal numeric(7, 2) check (energy_kcal >= 0),
  protein_g numeric(6, 2) check (protein_g >= 0),
  carbs_g numeric(6, 2) check (carbs_g >= 0),
  sugars_g numeric(6, 2) check (sugars_g >= 0),
  fat_g numeric(6, 2) check (fat_g >= 0),
  saturated_fat_g numeric(6, 2) check (saturated_fat_g >= 0),
  fiber_g numeric(6, 2) check (fiber_g >= 0),
  salt_g numeric(7, 3) check (salt_g >= 0),
  micros jsonb not null default '{}',
  source text not null check (source in ('open_food_facts', 'usda_fdc', 'user_contribution', 'label_scan', 'editorial')),
  source_id text not null,
  source_url text,
  source_version text,
  license text not null,
  search_text text generated always as (
    public.join_search_text(array[name_es, name_en] || synonyms_es || synonyms_en)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index generic_foods_search_trgm on public.generic_foods using gin (search_text extensions.gin_trgm_ops);
create index generic_foods_category on public.generic_foods (category);
create trigger generic_foods_updated_at before update on public.generic_foods
  for each row execute function public.set_updated_at();

create table public.generic_food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.generic_foods (id) on delete cascade,
  position smallint not null default 0,
  label_es text not null,
  label_en text not null,
  grams numeric(7, 2) not null check (grams > 0),
  source_ref text,
  unique (food_id, position)
);

-- ---------------------------------------------------------------------------
-- Catalogue: branded products
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  gtin text not null unique check (gtin ~ '^([0-9]{8}|[0-9]{13,14})$'),
  slug text not null unique,
  name text,
  names jsonb not null default '{}',
  brand text,
  quantity_text text,
  net_quantity numeric(10, 2) check (net_quantity > 0),
  net_quantity_unit text check (net_quantity_unit in ('g', 'ml')),
  serving_size_text text,
  serving_quantity numeric(8, 2) check (serving_quantity > 0),
  basis text not null default '100g' check (basis in ('100g', '100ml')),
  energy_kcal numeric(7, 2) check (energy_kcal >= 0),
  protein_g numeric(6, 2) check (protein_g >= 0),
  carbs_g numeric(6, 2) check (carbs_g >= 0),
  sugars_g numeric(6, 2) check (sugars_g >= 0),
  fat_g numeric(6, 2) check (fat_g >= 0),
  saturated_fat_g numeric(6, 2) check (saturated_fat_g >= 0),
  fiber_g numeric(6, 2) check (fiber_g >= 0),
  salt_g numeric(7, 3) check (salt_g >= 0),
  nutrition_available boolean not null default false,
  categories text[] not null default '{}',
  category_main text,
  countries text[] not null default '{}',
  ingredients_text text,
  ingredients_texts jsonb not null default '{}',
  allergens text[] not null default '{}',
  traces text[] not null default '{}',
  additives text[] not null default '{}',
  labels text[] not null default '{}',
  nutriscore_grade text check (nutriscore_grade in ('a', 'b', 'c', 'd', 'e')),
  nutriscore_version text,
  nova_group smallint check (nova_group between 1 and 4),
  image_url text,
  image_ingredients_url text,
  image_nutrition_url text,
  source text not null check (source in ('open_food_facts', 'usda_fdc', 'user_contribution', 'label_scan', 'editorial')),
  source_id text not null,
  source_url text,
  license text not null,
  source_last_modified timestamptz,
  warnings text[] not null default '{}',
  verification_status text not null default 'imported' check (verification_status in (
    'imported', 'user_submitted', 'pending_review', 'verified', 'rejected')),
  imported_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now(),
  search_text text generated always as (
    public.join_search_text(array[coalesce(name, ''), coalesce(brand, ''), coalesce(names ->> 'es', ''), coalesce(names ->> 'en', '')])
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_search_trgm on public.products using gin (search_text extensions.gin_trgm_ops);
create index products_categories on public.products using gin (categories);
create index products_additives on public.products using gin (additives);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Raw source payloads for audit/debugging. Not exposed to clients.
create table public.product_snapshots (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  source text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index product_snapshots_product on public.product_snapshots (product_id, fetched_at desc);

-- ---------------------------------------------------------------------------
-- Catalogue: additives & scientific sources
-- ---------------------------------------------------------------------------

create table public.additives (
  code text primary key check (code ~ '^e[0-9]{3,4}[a-z0-9]*$'),
  e_number text not null,
  name_es text,
  name_en text,
  classes text[] not null default '{}',
  parent_code text,
  efsa_evaluation_title text,
  efsa_evaluation_url text,
  efsa_evaluation_date date,
  efsa_adi_mg_per_kg numeric(10, 3),
  efsa_exposure_above_adi_groups text[] not null default '{}',
  vegan text check (vegan in ('yes', 'no', 'maybe')),
  vegetarian text check (vegetarian in ('yes', 'no', 'maybe')),
  wikidata_id text,
  editorial_note_es text,
  editorial_note_en text,
  review_status text not null default 'not_reviewed' check (review_status in ('not_reviewed', 'in_review', 'reviewed')),
  reviewed_at timestamptz,
  source text not null default 'open_food_facts',
  license text not null,
  search_text text generated always as (
    public.join_search_text(array[code, e_number, coalesce(name_es, ''), coalesce(name_en, '')])
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index additives_search_trgm on public.additives using gin (search_text extensions.gin_trgm_ops);
create trigger additives_updated_at before update on public.additives
  for each row execute function public.set_updated_at();

create table public.scientific_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'regulatory_evaluation', 'regulation', 'systematic_review', 'clinical_trial',
    'observational_study', 'animal_study', 'dataset', 'other')),
  title text not null,
  publisher text not null,
  url text unique,
  doi text,
  published_on date,
  accessed_on date,
  created_at timestamptz not null default now()
);

create table public.additive_sources (
  additive_code text not null references public.additives (code) on delete cascade,
  source_id uuid not null references public.scientific_sources (id) on delete cascade,
  relation text not null default 'evaluation' check (relation in ('evaluation', 'regulation', 'evidence')),
  primary key (additive_code, source_id)
);

-- ---------------------------------------------------------------------------
-- Food diary
-- ---------------------------------------------------------------------------

create table public.food_entries (
  -- Client-generated UUID: retries of the same save are idempotent.
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consumed_on date not null,
  consumed_at timestamptz,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  title text check (char_length(title) <= 120),
  method text not null check (method in ('photo', 'barcode', 'voice', 'text', 'search', 'label', 'recipe', 'copy', 'quick_add')),
  photo_path text,
  ai_draft_id uuid,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index food_entries_user_day on public.food_entries (user_id, consumed_on);
create trigger food_entries_updated_at before update on public.food_entries
  for each row execute function public.set_updated_at();

create table public.food_entry_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.food_entries (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null default 0,
  food_kind text not null check (food_kind in ('generic_food', 'product', 'custom')),
  generic_food_id uuid references public.generic_foods (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  -- Amount of the basis unit (grams for 100g, millilitres for 100ml).
  amount numeric(8, 2) not null check (amount > 0 and amount <= 5000),
  quantity_label text check (char_length(quantity_label) <= 60),
  basis text not null default '100g' check (basis in ('100g', '100ml')),
  -- Snapshot of per-100 values at log time; history never changes silently.
  per100 jsonb not null default '{}',
  energy_kcal numeric(8, 2),
  protein_g numeric(7, 2),
  carbs_g numeric(7, 2),
  sugars_g numeric(7, 2),
  fat_g numeric(7, 2),
  saturated_fat_g numeric(7, 2),
  fiber_g numeric(7, 2),
  salt_g numeric(7, 3),
  data_source text not null default 'user_contribution',
  data_source_ref text,
  data_version text,
  is_estimate boolean not null default false,
  created_at timestamptz not null default now()
);

create index food_entry_items_entry on public.food_entry_items (entry_id, position);
create index food_entry_items_user on public.food_entry_items (user_id);

create or replace function public.prepare_food_entry_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f record;
  k text;
  keys constant text[] := array['energy_kcal', 'protein_g', 'carbs_g', 'sugars_g', 'fat_g', 'saturated_fat_g', 'fiber_g', 'salt_g'];
  ref_changed boolean;
begin
  if not exists (select 1 from public.food_entries e where e.id = new.entry_id and e.user_id = new.user_id) then
    raise exception 'food entry % not found for this user', new.entry_id using errcode = '23503';
  end if;

  ref_changed := tg_op = 'INSERT'
    or new.food_kind is distinct from old.food_kind
    or new.generic_food_id is distinct from old.generic_food_id
    or new.product_id is distinct from old.product_id;

  if ref_changed then
    if new.food_kind = 'generic_food' then
      select g.* into f from public.generic_foods g where g.id = new.generic_food_id;
      if not found then
        raise exception 'generic food not found' using errcode = '23503';
      end if;
      new.basis := f.basis;
      new.data_source := f.source;
      new.data_source_ref := f.source_id;
      new.data_version := coalesce(f.source_version, f.updated_at::text);
    elsif new.food_kind = 'product' then
      select p.* into f from public.products p where p.id = new.product_id;
      if not found then
        raise exception 'product not found' using errcode = '23503';
      end if;
      if not f.nutrition_available then
        raise exception 'product has no nutrition data' using errcode = '22023';
      end if;
      new.basis := f.basis;
      new.data_source := f.source;
      new.data_source_ref := f.gtin;
      new.data_version := coalesce(f.source_last_modified, f.refreshed_at)::text;
    else
      new.generic_food_id := null;
      new.product_id := null;
      if new.data_source not in ('user_contribution', 'label_scan') then
        new.data_source := 'user_contribution';
      end if;
    end if;

    if new.food_kind in ('generic_food', 'product') then
      new.per100 := jsonb_build_object(
        'energy_kcal', f.energy_kcal, 'protein_g', f.protein_g, 'carbs_g', f.carbs_g,
        'sugars_g', f.sugars_g, 'fat_g', f.fat_g, 'saturated_fat_g', f.saturated_fat_g,
        'fiber_g', f.fiber_g, 'salt_g', f.salt_g);
    end if;
  end if;

  -- Validate the snapshot (custom items come from the client).
  foreach k in array keys loop
    if coalesce(jsonb_typeof(new.per100 -> k), 'null') not in ('number', 'null') then
      raise exception 'per100.% must be a number or null', k using errcode = '22023';
    end if;
    if (new.per100 ->> k)::numeric < 0 then
      raise exception 'per100.% must be >= 0', k using errcode = '22023';
    end if;
  end loop;
  if (new.per100 ->> 'energy_kcal')::numeric > 900
    or coalesce((new.per100 ->> 'protein_g')::numeric, 0) + coalesce((new.per100 ->> 'carbs_g')::numeric, 0)
       + coalesce((new.per100 ->> 'fat_g')::numeric, 0) > 102 then
    raise exception 'per100 values are not plausible' using errcode = '22023';
  end if;

  new.energy_kcal := round((new.per100 ->> 'energy_kcal')::numeric * new.amount / 100, 2);
  new.protein_g := round((new.per100 ->> 'protein_g')::numeric * new.amount / 100, 2);
  new.carbs_g := round((new.per100 ->> 'carbs_g')::numeric * new.amount / 100, 2);
  new.sugars_g := round((new.per100 ->> 'sugars_g')::numeric * new.amount / 100, 2);
  new.fat_g := round((new.per100 ->> 'fat_g')::numeric * new.amount / 100, 2);
  new.saturated_fat_g := round((new.per100 ->> 'saturated_fat_g')::numeric * new.amount / 100, 2);
  new.fiber_g := round((new.per100 ->> 'fiber_g')::numeric * new.amount / 100, 2);
  new.salt_g := round((new.per100 ->> 'salt_g')::numeric * new.amount / 100, 3);
  return new;
end;
$$;

create trigger food_entry_items_prepare before insert or update on public.food_entry_items
  for each row execute function public.prepare_food_entry_item();

create view public.daily_nutrition with (security_invoker = true) as
select
  e.user_id,
  e.consumed_on,
  count(distinct e.id)::int as entry_count,
  count(i.id)::int as item_count,
  round(sum(i.energy_kcal), 1) as energy_kcal,
  round(sum(i.protein_g), 1) as protein_g,
  round(sum(i.carbs_g), 1) as carbs_g,
  round(sum(i.sugars_g), 1) as sugars_g,
  round(sum(i.fat_g), 1) as fat_g,
  round(sum(i.saturated_fat_g), 1) as saturated_fat_g,
  round(sum(i.fiber_g), 1) as fiber_g,
  round(sum(i.salt_g), 2) as salt_g,
  coalesce(bool_or(i.is_estimate), false) as has_estimates,
  (count(i.id) filter (where i.fiber_g is null))::int as items_missing_fiber
from public.food_entries e
join public.food_entry_items i on i.entry_id = e.id
group by e.user_id, e.consumed_on;

create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('generic_food', 'product')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

-- ---------------------------------------------------------------------------
-- AI usage, cache and contributions
-- ---------------------------------------------------------------------------

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('meal_photo', 'label', 'parse_meal', 'transcribe', 'coach')),
  status text not null check (status in ('ok', 'error', 'rejected', 'cached')),
  model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index ai_usage_quota on public.ai_usage (user_id, feature, created_at desc);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  input_hash text not null,
  prompt_version text not null,
  model text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, feature, input_hash, prompt_version)
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('new_product', 'product_correction', 'label_scan')),
  gtin text check (gtin ~ '^[0-9]{8,14}$'),
  product_id uuid references public.products (id) on delete set null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_review')),
  reviewer_id uuid references auth.users (id) on delete set null,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index contributions_status on public.contributions (status, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_consents enable row level security;
alter table public.health_profiles enable row level security;
alter table public.weight_logs enable row level security;
alter table public.daily_targets enable row level security;
alter table public.generic_foods enable row level security;
alter table public.generic_food_portions enable row level security;
alter table public.products enable row level security;
alter table public.product_snapshots enable row level security;
alter table public.additives enable row level security;
alter table public.scientific_sources enable row level security;
alter table public.additive_sources enable row level security;
alter table public.food_entries enable row level security;
alter table public.food_entry_items enable row level security;
alter table public.favorites enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.contributions enable row level security;

-- Own-row policies
create policy "profiles: read own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "preferences: own" on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "consents: read own" on public.user_consents for select to authenticated
  using (user_id = (select auth.uid()));
create policy "consents: append own" on public.user_consents for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "health: read own" on public.health_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "health: insert with consent" on public.health_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_consent('health_data'));
create policy "health: update with consent" on public.health_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.has_consent('health_data'));
create policy "health: delete own" on public.health_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "weights: read own" on public.weight_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "weights: insert with consent" on public.weight_logs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_consent('health_data'));
create policy "weights: update with consent" on public.weight_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.has_consent('health_data'));
create policy "weights: delete own" on public.weight_logs for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "targets: own" on public.daily_targets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "entries: own" on public.food_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "items: own" on public.food_entry_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "favorites: own" on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "ai usage: read own" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ai analyses: read own" on public.ai_analyses for select to authenticated
  using (user_id = (select auth.uid()));

create policy "contributions: read own" on public.contributions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "contributions: submit pending" on public.contributions for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'pending'
    and reviewer_id is null and reviewed_at is null and review_notes is null
  );

-- Public catalogue (read-only for clients)
create policy "generic foods: public read" on public.generic_foods for select to anon, authenticated using (true);
create policy "portions: public read" on public.generic_food_portions for select to anon, authenticated using (true);
create policy "products: public read" on public.products for select to anon, authenticated
  using (verification_status <> 'rejected');
create policy "additives: public read" on public.additives for select to anon, authenticated using (true);
create policy "sources: public read" on public.scientific_sources for select to anon, authenticated using (true);
create policy "additive sources: public read" on public.additive_sources for select to anon, authenticated using (true);

-- Defence in depth: clients never write catalogue tables directly.
revoke insert, update, delete on public.generic_foods, public.generic_food_portions, public.products,
  public.product_snapshots, public.additives, public.scientific_sources, public.additive_sources,
  public.ai_usage, public.ai_analyses
  from anon, authenticated;
revoke all on public.product_snapshots from anon, authenticated;
revoke all on public.user_consents from anon;
revoke update, delete on public.user_consents from authenticated;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------

create or replace function public.search_catalog(
  q text,
  kinds text[] default array['generic_food', 'product', 'additive'],
  lim integer default 20,
  lang text default 'es'
)
returns table (
  kind text,
  id text,
  slug text,
  title text,
  subtitle text,
  image_url text,
  energy_kcal numeric,
  basis text,
  score real
)
language sql
stable
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.35
as $$
  with p as (
    select public.normalize_search_text(trim(q)) as nq,
           regexp_replace(q, '\D', '', 'g') as digits
  ),
  hits as (
    select 'generic_food'::text as kind, f.id::text, f.slug,
           case when lang = 'en' then f.name_en else f.name_es end as title,
           case when lang = 'en' then f.name_es else f.name_en end as subtitle,
           null::text as image_url, f.energy_kcal, f.basis,
           (greatest(extensions.word_similarity(p.nq, f.search_text), extensions.similarity(p.nq, f.search_text))
             + case when f.search_text like p.nq || '%' then 0.3 else 0 end
             + case when public.normalize_search_text(case when lang = 'en' then f.name_en else f.name_es end) like p.nq || '%' then 0.2 else 0 end
           )::real as score
    from public.generic_foods f, p
    where 'generic_food' = any (kinds) and char_length(p.nq) >= 2
      and (f.search_text like '%' || p.nq || '%' or p.nq operator(extensions.<%) f.search_text)
    union all
    select 'product', pr.id::text, pr.slug,
           coalesce(case when lang = 'en' then pr.names ->> 'en' else pr.names ->> 'es' end, pr.name, pr.gtin),
           nullif(concat_ws(' · ', pr.brand, pr.quantity_text), ''),
           pr.image_url, pr.energy_kcal, pr.basis,
           (case when pr.gtin = p.digits then 2.0
                 else greatest(extensions.word_similarity(p.nq, pr.search_text), extensions.similarity(p.nq, pr.search_text)) end)::real
    from public.products pr, p
    where 'product' = any (kinds) and pr.verification_status <> 'rejected'
      and (pr.gtin = p.digits
           or (char_length(p.nq) >= 2 and (pr.search_text like '%' || p.nq || '%' or p.nq operator(extensions.<%) pr.search_text)))
    union all
    select 'additive', a.code, a.code,
           a.e_number || coalesce(' · ' || case when lang = 'en' then coalesce(a.name_en, a.name_es) else coalesce(a.name_es, a.name_en) end, ''),
           null, null, null, null,
           (case when a.code = replace(p.nq, ' ', '') then 2.0
                 else greatest(extensions.word_similarity(p.nq, a.search_text), extensions.similarity(p.nq, a.search_text)) end)::real
    from public.additives a, p
    where 'additive' = any (kinds) and char_length(p.nq) >= 2
      and (a.code = replace(p.nq, ' ', '') or a.search_text like '%' || p.nq || '%' or p.nq operator(extensions.<%) a.search_text)
  )
  select h.kind, h.id, h.slug, h.title, h.subtitle, h.image_url, h.energy_kcal, h.basis, h.score
  from hits h
  order by h.score desc, char_length(h.title) asc
  limit greatest(1, least(lim, 50));
$$;

-- Candidate generic foods for a free-text food description (fallback for AI
-- matching). Score = share of query words found at word starts (with naive
-- plural stripping), blended with trigram similarity of the English name.
create or replace function public.match_generic_foods(q text, lim integer default 5)
returns table (id uuid, slug text, name_es text, name_en text, score real)
language sql
stable
set search_path = ''
as $$
  with p as (select public.normalize_search_text(trim(q)) as nq),
  words as (
    select distinct case when char_length(w) > 4 then regexp_replace(w, 'e?s$', '') else w end as w
    from p, regexp_split_to_table(p.nq, '[^a-z0-9ñ]+') as w
    where char_length(w) >= 3 and w not in ('the', 'and', 'with', 'con', 'del', 'los', 'las', 'una', 'para')
  ),
  total as (select greatest(count(*), 1)::real as n from words),
  scored as (
    select f.id, f.slug, f.name_es, f.name_en,
           (select count(*) from words where f.search_text ~ ('\m' || words.w))::real / total.n as overlap,
           extensions.similarity(p.nq, public.normalize_search_text(f.name_en)) as sim
    from public.generic_foods f, p, total
  )
  select s.id, s.slug, s.name_es, s.name_en, (0.75 * s.overlap + 0.25 * s.sim)::real as score
  from scored s
  where s.overlap > 0
  order by score desc, char_length(s.name_en) asc
  limit greatest(1, least(lim, 20));
$$;

grant execute on function public.search_catalog(text, text[], integer, text) to anon, authenticated;
grant execute on function public.match_generic_foods(text, integer) to anon, authenticated;
grant execute on function public.target_for_date(date) to authenticated;
grant execute on function public.has_consent(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private buckets for meal and label photos (owner-only, by folder)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('meal-photos', 'meal-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('label-photos', 'label-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "photos: owner read" on storage.objects for select to authenticated
  using (bucket_id in ('meal-photos', 'label-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('meal-photos', 'label-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('meal-photos', 'label-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
