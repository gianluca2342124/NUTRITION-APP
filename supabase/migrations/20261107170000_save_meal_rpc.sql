-- Atomic, idempotent meal save. Runs with the caller's privileges (RLS applies).
-- Re-sending the same entry id returns the existing entry without duplicating it.
create or replace function public.save_meal(p_entry jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid := (p_entry ->> 'id')::uuid;
  v_item jsonb;
  v_pos integer := 0;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_id is null then
    raise exception 'entry id is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'a meal needs at least one item' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'too many items in one meal' using errcode = '22023';
  end if;

  insert into public.food_entries (id, user_id, consumed_on, consumed_at, meal_type, title, method, photo_path, ai_draft_id, notes)
  values (
    v_id, v_user, (p_entry ->> 'consumed_on')::date, (p_entry ->> 'consumed_at')::timestamptz,
    p_entry ->> 'meal_type', nullif(p_entry ->> 'title', ''), p_entry ->> 'method',
    p_entry ->> 'photo_path', (p_entry ->> 'ai_draft_id')::uuid, nullif(p_entry ->> 'notes', ''))
  on conflict (id) do nothing;

  if not found then
    if exists (select 1 from public.food_entries e where e.id = v_id and e.user_id = v_user) then
      return v_id;
    end if;
    raise exception 'entry id already in use' using errcode = '23505';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.food_entry_items (
      id, entry_id, user_id, position, food_kind, generic_food_id, product_id, display_name,
      amount, quantity_label, per100, data_source, is_estimate)
    values (
      coalesce((v_item ->> 'id')::uuid, gen_random_uuid()), v_id, v_user, v_pos,
      v_item ->> 'food_kind', (v_item ->> 'generic_food_id')::uuid, (v_item ->> 'product_id')::uuid,
      v_item ->> 'display_name', (v_item ->> 'amount')::numeric, nullif(v_item ->> 'quantity_label', ''),
      coalesce(v_item -> 'per100', '{}'::jsonb), coalesce(v_item ->> 'data_source', 'user_contribution'),
      coalesce((v_item ->> 'is_estimate')::boolean, false));
    v_pos := v_pos + 1;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.save_meal(jsonb, jsonb) from public, anon;
grant execute on function public.save_meal(jsonb, jsonb) to authenticated;

-- Recently logged foods for quick re-logging (latest use per food).
create or replace function public.recent_foods(lim integer default 20)
returns table (
  food_kind text,
  generic_food_id uuid,
  product_id uuid,
  display_name text,
  amount numeric,
  quantity_label text,
  basis text,
  per100 jsonb,
  last_used_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.food_kind, r.generic_food_id, r.product_id, r.display_name, r.amount, r.quantity_label, r.basis, r.per100, r.created_at
  from (
    select distinct on (coalesce(i.generic_food_id::text, i.product_id::text, lower(i.display_name))) i.*
    from public.food_entry_items i
    where i.user_id = (select auth.uid())
    order by coalesce(i.generic_food_id::text, i.product_id::text, lower(i.display_name)), i.created_at desc
  ) r
  order by r.created_at desc
  limit greatest(1, least(lim, 50));
$$;

grant execute on function public.recent_foods(integer) to authenticated;
