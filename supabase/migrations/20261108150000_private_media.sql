-- =============================================================================
-- Private by default (Fudyu 2.2)
--
-- 1. Avatars and community media are no longer public buckets. Files are read
--    with signed URLs, and the storage RLS below decides who may sign them:
--    the owner always; anyone else only for a published publication or for the
--    avatar of a profile its owner made public. An unguessable path is not
--    access control.
-- 2. Public profiles are private until the person turns them public.
-- =============================================================================

update storage.buckets set public = false where id in ('avatars', 'community-media');

alter table public.public_profiles add column is_public boolean not null default false;

drop policy "public profiles: read" on public.public_profiles;
create policy "public profiles: public or own" on public.public_profiles for select to anon, authenticated
  using (is_public or user_id = (select auth.uid()));

-- Achievements are shown only on a public profile that opted in.
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
  where a.user_id = p_user and pp.is_public and pp.show_achievements
  order by a.earned_at;
$$;

-- Reading media: owner, or published content, or a public profile's avatar.
drop policy "public media: owner read" on storage.objects;

create policy "media: owner read" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'community-media') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media: published read" on storage.objects for select to anon, authenticated
  using (
    (bucket_id = 'community-media' and (
      exists (select 1 from public.community_recipes r where r.image_path = objects.name and r.status = 'published')
      or exists (select 1 from public.community_articles a where a.cover_path = objects.name and a.status = 'published')
    ))
    or (bucket_id = 'avatars' and exists (
      select 1 from public.public_profiles pp where pp.avatar_path = objects.name and pp.is_public
    ))
  );

create index if not exists community_recipes_image on public.community_recipes (image_path) where image_path is not null;
create index if not exists community_articles_cover on public.community_articles (cover_path) where cover_path is not null;
create index if not exists public_profiles_avatar on public.public_profiles (avatar_path) where avatar_path is not null;
