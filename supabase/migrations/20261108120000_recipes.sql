-- =============================================================================
-- Editorial recipes (Fudyu 2.0)
--
-- Recipes written by the Fudyu team (author_kind = 'editorial'); there are no
-- user-published recipes yet. Ingredients reference catalogue foods, so the
-- nutrition is always computed from catalogue data, never typed by hand.
-- Seeded by scripts/seed/build-seed.mjs from data/recipes/recipes.json.
-- =============================================================================

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_es text not null,
  title_en text not null,
  summary_es text,
  summary_en text,
  minutes smallint not null check (minutes between 1 and 600),
  servings smallint not null check (servings between 1 and 20),
  meal_types text[] not null default '{}',
  vegetarian boolean not null default false,
  steps_es text[] not null default '{}',
  steps_en text[] not null default '{}',
  -- Key of a curated, licensed photo (shown as illustrative), or null for the illustration.
  image_key text,
  author_kind text not null default 'editorial' check (author_kind in ('editorial')),
  review_status text not null default 'not_reviewed' check (review_status in ('not_reviewed', 'in_review', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position smallint not null,
  generic_food_id uuid not null references public.generic_foods (id),
  grams numeric(7, 2) not null check (grams > 0),
  label_es text not null,
  label_en text not null,
  primary key (recipe_id, position)
);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
create policy "recipes: public read" on public.recipes for select to anon, authenticated using (true);
create policy "recipe ingredients: public read" on public.recipe_ingredients for select to anon, authenticated using (true);
revoke insert, update, delete on public.recipes, public.recipe_ingredients from anon, authenticated;

-- Completing a recipe now counts (once per recipe and local day).
create or replace function public.record_activity(p_kind text, p_subject text, p_local_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_enabled boolean;
  v_rows integer;
  v_new_day boolean;
  v_current integer;
  v_longest integer;
  v_last date;
  v_ids text[];
  v_new text[];
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('meal_logged', 'product_analyzed', 'comparison', 'recipe_completed', 'ingredient_explored') then
    raise exception 'unknown activity kind' using errcode = '22023';
  end if;
  if p_subject is null or char_length(p_subject) not between 1 and 300 then
    raise exception 'invalid subject' using errcode = '22023';
  end if;
  if p_local_date is null or p_local_date < v_today - 1 or p_local_date > v_today + 1 then
    raise exception 'local date out of range' using errcode = '22023';
  end if;

  select pr.gamification_enabled into v_enabled from public.user_preferences pr where pr.user_id = v_user;
  if v_enabled is false then
    return jsonb_build_object('counted', false, 'reason', 'disabled');
  end if;

  if p_kind = 'meal_logged' then
    if p_subject !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not exists (select 1 from public.food_entries e where e.id = p_subject::uuid and e.user_id = v_user) then
      raise exception 'meal not found' using errcode = '23503';
    end if;
  elsif p_kind = 'product_analyzed' then
    if not exists (select 1 from public.products p where p.gtin = p_subject) then
      raise exception 'product not found' using errcode = '23503';
    end if;
  elsif p_kind = 'ingredient_explored' then
    if not exists (select 1 from public.additives a where a.code = p_subject) then
      raise exception 'additive not found' using errcode = '23503';
    end if;
  elsif p_kind = 'comparison' then
    v_ids := array(select distinct x from unnest(string_to_array(p_subject, ',')) as x order by x);
    if cardinality(v_ids) < 2
       or (select count(*) from public.products p where p.id::text = any (v_ids)) < cardinality(v_ids) then
      raise exception 'comparison needs at least two catalogue products' using errcode = '22023';
    end if;
    p_subject := array_to_string(v_ids, ',');
  elsif p_kind = 'recipe_completed' then
    if not exists (select 1 from public.recipes r where r.slug = p_subject) then
      raise exception 'recipe not found' using errcode = '23503';
    end if;
    p_subject := p_subject || '@' || p_local_date::text;
  end if;

  insert into public.activity_events (user_id, kind, subject, local_date)
  values (v_user, p_kind, p_subject, p_local_date)
  on conflict (user_id, kind, subject) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    select s.current_len, s.longest_len, s.last_day into v_current, v_longest, v_last from public.streak_chains(v_user) s;
    return jsonb_build_object(
      'counted', false, 'reason', 'duplicate', 'newDay', false,
      'streak', jsonb_build_object('current', v_current, 'longest', v_longest, 'lastActiveDate', v_last),
      'newAchievements', '[]'::jsonb);
  end if;

  insert into public.streak_daily_activity as d (user_id, activity_date, first_kind)
  values (v_user, p_local_date, p_kind)
  on conflict (user_id, activity_date) do update set events = d.events + 1
  returning (xmax = 0) into v_new_day;

  select s.current_len, s.longest_len, s.last_day into v_current, v_longest, v_last from public.streak_chains(v_user) s;

  insert into public.user_streaks as us (user_id, current_streak, longest_streak, last_active_date, updated_at)
  values (v_user, v_current, v_longest, v_last, now())
  on conflict (user_id) do update set
    current_streak = excluded.current_streak,
    longest_streak = greatest(us.longest_streak, excluded.longest_streak),
    last_active_date = excluded.last_active_date,
    updated_at = now();

  with counts as (
    select
      count(*) filter (where kind = 'product_analyzed') as products,
      count(*) filter (where kind = 'comparison') as comparisons,
      count(*) filter (where kind = 'recipe_completed') as recipes,
      count(*) filter (where kind = 'ingredient_explored') as ingredients
    from public.activity_events where user_id = v_user
  ),
  earned(id, ok) as (
    select 'first_scan', products >= 1 from counts
    union all select 'food_explorer', products >= 10 from counts
    union all select 'smart_choices', comparisons >= 5 from counts
    union all select 'recipe_discoverer', recipes >= 1 from counts
    union all select 'weekly_explorer', v_longest >= 7
    union all select 'food_curious', ingredients >= 1 from counts
    union all select 'consistency', (select count(*) from public.streak_daily_activity where user_id = v_user) >= 30
  ),
  inserted as (
    insert into public.user_achievements (user_id, achievement, context)
    select v_user, e.id, jsonb_build_object('kind', p_kind, 'localDate', p_local_date)
    from earned e where e.ok
    on conflict (user_id, achievement) do nothing
    returning achievement
  )
  select coalesce(array_agg(achievement), '{}') into v_new from inserted;

  return jsonb_build_object(
    'counted', true, 'newDay', v_new_day,
    'streak', jsonb_build_object('current', v_current, 'longest', greatest(v_longest, v_current), 'lastActiveDate', v_last),
    'newAchievements', to_jsonb(v_new));
end;
$$;
