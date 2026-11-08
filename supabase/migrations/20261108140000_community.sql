-- =============================================================================
-- Public profiles and community publications (Fudyu 2.1)
--
-- Privacy by construction: the public profile only has what the person types
-- in it (name, @username, bio, photo) plus opt-in switches. Health data,
-- goals and diary history live in other tables and never reach it.
--
-- Publications are moderated: authors can only save drafts or send them to
-- review; only moderators (service role) publish or reject. Editing a
-- published item takes it back to review. Recipe nutrition is never typed by
-- the author: ingredients link to catalogue foods and values are computed.
-- =============================================================================

create table public.public_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(btrim(display_name)) between 1 and 60),
  bio text check (char_length(bio) <= 280),
  avatar_path text check (avatar_path is null or avatar_path like user_id::text || '/%'),
  show_achievements boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger public_profiles_updated_at before update on public.public_profiles
  for each row execute function public.set_updated_at();

alter table public.public_profiles enable row level security;
create policy "public profiles: read" on public.public_profiles for select to anon, authenticated using (true);
create policy "public profiles: own insert" on public.public_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "public profiles: own update" on public.public_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "public profiles: own delete" on public.public_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- Achievements are private unless the person chose to show them.
create or replace function public.public_achievements(p_user uuid)
returns table (achievement text, earned_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.achievement, a.earned_at
  from public.user_achievements a
  join public.public_profiles pp on pp.user_id = a.user_id
  where a.user_id = p_user and pp.show_achievements
  order by a.earned_at;
$$;
revoke all on function public.public_achievements(uuid) from public;
grant execute on function public.public_achievements(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- publications

create table public.community_recipes (
  id uuid primary key,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 90),
  summary text check (char_length(summary) <= 280),
  image_path text check (image_path is null or image_path like author_id::text || '/%'),
  minutes smallint check (minutes between 1 and 600),
  servings smallint not null default 1 check (servings between 1 and 20),
  steps text[] not null default '{}' check (cardinality(steps) <= 30),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'rejected')),
  review_note text,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or (cardinality(steps) >= 1 and minutes is not null))
);

create table public.community_recipe_ingredients (
  recipe_id uuid not null references public.community_recipes (id) on delete cascade,
  position smallint not null check (position between 0 and 39),
  generic_food_id uuid references public.generic_foods (id),
  product_id uuid references public.products (id),
  grams numeric(7, 2) not null check (grams > 0 and grams <= 5000),
  label text not null check (char_length(label) between 1 and 120),
  primary key (recipe_id, position),
  check (num_nonnulls(generic_food_id, product_id) = 1)
);

create table public.community_articles (
  id uuid primary key,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  cover_path text check (cover_path is null or cover_path like author_id::text || '/%'),
  body text not null default '' check (char_length(body) <= 20000),
  sources text[] not null default '{}' check (cardinality(sources) <= 20),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'rejected')),
  review_note text,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Science needs sources: nothing goes to review without at least one.
  check (status = 'draft' or (char_length(body) >= 200 and cardinality(sources) >= 1))
);

create index community_recipes_author on public.community_recipes (author_id, updated_at desc);
create index community_recipes_published on public.community_recipes (published_at desc) where status = 'published';
create index community_articles_author on public.community_articles (author_id, updated_at desc);
create index community_articles_published on public.community_articles (published_at desc) where status = 'published';

create trigger community_recipes_updated_at before update on public.community_recipes
  for each row execute function public.set_updated_at();
create trigger community_articles_updated_at before update on public.community_articles
  for each row execute function public.set_updated_at();

-- Authors draft and submit; moderators publish or reject.
create or replace function public.guard_publication_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') = 'service_role' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      new.published_at := now();
    end if;
    return new;
  end if;
  if new.status not in ('draft', 'pending_review') then
    raise exception 'only moderators can publish or reject' using errcode = '42501';
  end if;
  -- Any author change to a published item takes it out until it is reviewed again.
  new.published_at := null;
  if new.status = 'pending_review' and (tg_op = 'INSERT' or old.status is distinct from 'pending_review') then
    new.submitted_at := now();
    new.review_note := null;
  end if;
  return new;
end;
$$;

create trigger community_recipes_status before insert or update on public.community_recipes
  for each row execute function public.guard_publication_status();
create trigger community_articles_status before insert or update on public.community_articles
  for each row execute function public.guard_publication_status();

alter table public.community_recipes enable row level security;
alter table public.community_recipe_ingredients enable row level security;
alter table public.community_articles enable row level security;

create policy "community recipes: published or own" on public.community_recipes for select to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()));
create policy "community recipes: own insert" on public.community_recipes for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "community recipes: own update" on public.community_recipes for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "community recipes: own delete" on public.community_recipes for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "community ingredients: visible with recipe" on public.community_recipe_ingredients for select to anon, authenticated
  using (exists (
    select 1 from public.community_recipes r
    where r.id = recipe_id and (r.status = 'published' or r.author_id = (select auth.uid()))
  ));
-- Ingredients of a published recipe cannot change without sending it back to review.
create policy "community ingredients: own unpublished write" on public.community_recipe_ingredients for all to authenticated
  using (exists (
    select 1 from public.community_recipes r
    where r.id = recipe_id and r.author_id = (select auth.uid()) and r.status <> 'published'
  ))
  with check (exists (
    select 1 from public.community_recipes r
    where r.id = recipe_id and r.author_id = (select auth.uid()) and r.status <> 'published'
  ));

create policy "community articles: published or own" on public.community_articles for select to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()));
create policy "community articles: own insert" on public.community_articles for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "community articles: own update" on public.community_articles for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "community articles: own delete" on public.community_articles for delete to authenticated
  using (author_id = (select auth.uid()));

-- Saves a recipe and its ingredients atomically (client ids: safe to retry).
create or replace function public.save_community_recipe(p_recipe jsonb, p_ingredients jsonb, p_submit boolean)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := (p_recipe ->> 'id')::uuid;
  v_status text := case when p_submit then 'pending_review' else 'draft' end;
begin
  if p_submit and jsonb_array_length(coalesce(p_ingredients, '[]'::jsonb)) = 0 then
    raise exception 'a recipe needs at least one ingredient' using errcode = '23514';
  end if;

  insert into public.community_recipes as r (id, title, summary, image_path, minutes, servings, steps, status)
  values (
    v_id,
    btrim(p_recipe ->> 'title'),
    nullif(btrim(p_recipe ->> 'summary'), ''),
    nullif(p_recipe ->> 'image_path', ''),
    (p_recipe ->> 'minutes')::smallint,
    coalesce((p_recipe ->> 'servings')::smallint, 1),
    coalesce(array(select jsonb_array_elements_text(p_recipe -> 'steps')), '{}'),
    v_status
  )
  on conflict (id) do update set
    title = excluded.title,
    summary = excluded.summary,
    image_path = excluded.image_path,
    minutes = excluded.minutes,
    servings = excluded.servings,
    steps = excluded.steps,
    status = excluded.status
  where r.author_id = (select auth.uid());

  if not found then
    raise exception 'recipe not found' using errcode = '42501';
  end if;

  delete from public.community_recipe_ingredients where recipe_id = v_id;
  insert into public.community_recipe_ingredients (recipe_id, position, generic_food_id, product_id, grams, label)
  select v_id, (i.ord - 1)::smallint, nullif(i.value ->> 'generic_food_id', '')::uuid, nullif(i.value ->> 'product_id', '')::uuid,
         (i.value ->> 'grams')::numeric, btrim(i.value ->> 'label')
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) with ordinality as i (value, ord);

  return v_status;
end;
$$;
grant execute on function public.save_community_recipe(jsonb, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('community-media', 'community-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public media: owner upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'community-media') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "public media: owner update" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'community-media') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "public media: owner delete" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'community-media') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "public media: owner read" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'community-media') and (storage.foldername(name))[1] = (select auth.uid())::text);
