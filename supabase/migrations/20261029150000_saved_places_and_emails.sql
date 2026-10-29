-- Saved Places lists + sharing, and raw forwarded-email storage.

-- Canonical places (dedupe by OSM id when present)
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  osm_type text,
  osm_id text,
  name text not null,
  latitude double precision,
  longitude double precision,
  address text,
  category text,
  opening_hours_raw text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_osm_unique unique (osm_type, osm_id)
);

create index if not exists places_name_idx on public.places (name);

create table if not exists public.place_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_lists_owner_idx on public.place_lists (owner_id);

create table if not exists public.place_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.place_lists (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  notes text,
  source_url text,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint place_list_items_unique unique (list_id, place_id)
);

create index if not exists place_list_items_list_idx on public.place_list_items (list_id);
create index if not exists place_list_items_place_idx on public.place_list_items (place_id);

create table if not exists public.place_list_shares (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.place_lists (id) on delete cascade,
  friend_user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null default 'view'
    check (permission in ('view', 'edit')),
  created_at timestamptz not null default now(),
  constraint place_list_shares_unique unique (list_id, friend_user_id)
);

create index if not exists place_list_shares_friend_idx
  on public.place_list_shares (friend_user_id);

-- Raw email body + AI summary for forwarded inbox
alter table public.imported_emails
  add column if not exists raw_text text,
  add column if not exists raw_html text,
  add column if not exists ai_summary text;

alter table public.reservation_reviews
  add column if not exists match_reason text,
  add column if not exists matched_trip_confidence double precision;

-- Helpers for list access
create or replace function public.owns_place_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.place_lists
    where id = p_list_id and owner_id = auth.uid()
  );
$$;

create or replace function public.can_view_place_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.place_lists where id = p_list_id and owner_id = auth.uid()
  )
  or exists (
    select 1 from public.place_list_shares
    where list_id = p_list_id and friend_user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_place_list(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.place_lists where id = p_list_id and owner_id = auth.uid()
  )
  or exists (
    select 1 from public.place_list_shares
    where list_id = p_list_id
      and friend_user_id = auth.uid()
      and permission = 'edit'
  );
$$;

create or replace function public.are_accepted_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friends
    where status = 'accepted'
      and (
        (requester_id = a and recipient_id = b)
        or (requester_id = b and recipient_id = a)
      )
  );
$$;

alter table public.places enable row level security;
alter table public.place_lists enable row level security;
alter table public.place_list_items enable row level security;
alter table public.place_list_shares enable row level security;

-- Places: readable if referenced by a list the user can view; insertable by authenticated
create policy "Users read places on accessible lists"
  on public.places for select to authenticated
  using (
    exists (
      select 1
      from public.place_list_items i
      where i.place_id = places.id
        and public.can_view_place_list(i.list_id)
    )
    or not exists (
      select 1 from public.place_list_items i where i.place_id = places.id
    )
  );

create policy "Authenticated insert places"
  on public.places for insert to authenticated
  with check (true);

create policy "Authenticated update places they can edit via lists"
  on public.places for update to authenticated
  using (
    exists (
      select 1 from public.place_list_items i
      where i.place_id = places.id and public.can_edit_place_list(i.list_id)
    )
    or not exists (
      select 1 from public.place_list_items i where i.place_id = places.id
    )
  )
  with check (true);

-- Lists
create policy "Owners manage own lists"
  on public.place_lists for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Shared users view lists"
  on public.place_lists for select to authenticated
  using (public.can_view_place_list(id));

-- List items
create policy "View items on accessible lists"
  on public.place_list_items for select to authenticated
  using (public.can_view_place_list(list_id));

create policy "Edit items on editable lists"
  on public.place_list_items for insert to authenticated
  with check (public.can_edit_place_list(list_id));

create policy "Update items on editable lists"
  on public.place_list_items for update to authenticated
  using (public.can_edit_place_list(list_id))
  with check (public.can_edit_place_list(list_id));

create policy "Delete items on editable lists"
  on public.place_list_items for delete to authenticated
  using (public.can_edit_place_list(list_id));

-- Shares: owner manages; friend can see own shares
create policy "Owners manage list shares"
  on public.place_list_shares for all to authenticated
  using (public.owns_place_list(list_id))
  with check (
    public.owns_place_list(list_id)
    and public.are_accepted_friends(auth.uid(), friend_user_id)
  );

create policy "Friends view shares to them"
  on public.place_list_shares for select to authenticated
  using (friend_user_id = auth.uid());

create trigger places_updated_at before update on public.places
  for each row execute function public.set_updated_at();

create trigger place_lists_updated_at before update on public.place_lists
  for each row execute function public.set_updated_at();
