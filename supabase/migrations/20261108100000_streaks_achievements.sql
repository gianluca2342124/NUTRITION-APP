-- =============================================================================
-- Streaks and achievements (Fudyu 2.0)
--
-- * One activity day per user and local date. Eligible actions are recorded by
--   record_activity(), the only write path (SECURITY DEFINER, validated).
-- * Repeating the same action on the same subject never counts twice
--   (e.g. scanning the same product again).
-- * Friendly by design: one missed day keeps the streak (grace day); nothing is
--   ever paid for or "repaired"; users can switch gamification off.
-- * The client sends its local date; the server accepts only dates within one
--   day of the UTC date, which covers every time zone and travel.
-- =============================================================================

alter table public.user_preferences
  add column gamification_enabled boolean not null default true;

create table public.activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'meal_logged', 'product_analyzed', 'comparison', 'recipe_completed', 'ingredient_explored')),
  subject text not null check (char_length(subject) between 1 and 300),
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, subject)
);

create index activity_events_user_kind on public.activity_events (user_id, kind);

create table public.streak_daily_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  first_kind text not null,
  events integer not null default 1 check (events > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table public.user_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_date date,
  updated_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement text not null check (achievement in (
    'first_scan', 'food_explorer', 'smart_choices', 'recipe_discoverer',
    'weekly_explorer', 'food_curious', 'consistency')),
  earned_at timestamptz not null default now(),
  context jsonb not null default '{}',
  primary key (user_id, achievement)
);

alter table public.activity_events enable row level security;
alter table public.streak_daily_activity enable row level security;
alter table public.user_streaks enable row level security;
alter table public.user_achievements enable row level security;

create policy "activity: read own" on public.activity_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "streak days: read own" on public.streak_daily_activity for select to authenticated
  using (user_id = (select auth.uid()));
create policy "streaks: read own" on public.user_streaks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "achievements: read own" on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));

-- Only record_activity() writes these tables.
revoke insert, update, delete on public.activity_events, public.streak_daily_activity,
  public.user_streaks, public.user_achievements from anon, authenticated;

-- Length of the latest chain of activity days, where consecutive days may be
-- at most two calendar days apart (one missed day is forgiven).
create or replace function public.streak_chains(p_user uuid)
returns table (current_len integer, longest_len integer, last_day date)
language sql
stable
set search_path = ''
as $$
  with ordered as (
    select activity_date as d,
           activity_date - lag(activity_date) over (order by activity_date) as gap
    from public.streak_daily_activity
    where user_id = p_user
  ),
  chained as (
    select d, sum(case when gap is null or gap > 2 then 1 else 0 end) over (order by d) as chain
    from ordered
  ),
  lens as (
    select chain, count(*)::integer as len, max(d) as last_d from chained group by chain
  )
  select
    coalesce((select len from lens order by last_d desc limit 1), 0),
    coalesce((select max(len) from lens), 0),
    (select max(last_d) from lens);
$$;

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

  -- Only real events count: the subject must exist (and be the user's own).
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
    raise exception 'recipes are not available yet' using errcode = '22023';
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

revoke execute on function public.record_activity(text, text, date) from public, anon;
grant execute on function public.record_activity(text, text, date) to authenticated;
revoke execute on function public.streak_chains(uuid) from public, anon, authenticated;
