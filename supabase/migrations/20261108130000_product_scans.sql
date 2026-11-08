-- =============================================================================
-- Scan history (Fudyu 2.1)
--
-- Products the user scanned or looked at, per local day. A scan is NOT a meal:
-- it never adds nutrients to the day. "Añadir al día" creates a diary entry
-- (save_meal) and links it here so the feed shows the product once; deleting
-- that entry removes the scan with it (it was the same item in the feed).
-- =============================================================================

create table public.product_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- Device-local calendar date of the interaction.
  scanned_on date not null,
  scanned_at timestamptz not null default now(),
  source text not null default 'barcode' check (source in ('barcode', 'search', 'label')),
  entry_id uuid references public.food_entries (id) on delete cascade,
  unique (user_id, product_id, scanned_on)
);

create index product_scans_user_day on public.product_scans (user_id, scanned_on, scanned_at desc);

alter table public.product_scans enable row level security;

create policy "scans: own" on public.product_scans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A scan can only be linked to the user's own entry.
create or replace function public.check_scan_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entry_id is not null
     and not exists (select 1 from public.food_entries e where e.id = new.entry_id and e.user_id = new.user_id) then
    raise exception 'entry not found for this user' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger product_scans_entry_owner before insert or update on public.product_scans
  for each row execute function public.check_scan_entry();
