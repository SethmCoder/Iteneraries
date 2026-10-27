-- Waypoint initial schema, RLS, indexes, and helpers

create extension if not exists "pgcrypto";

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  constraint profiles_username_unique unique (username)
);

-- Trips
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text,
  destination_name text,
  destination_latitude double precision,
  destination_longitude double precision,
  destination_image_url text,
  destination_image_attribution text,
  start_date date,
  end_date date,
  timezone text,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_date_order check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  invited_by uuid references public.profiles (id) on delete set null,
  invitation_status text not null default 'accepted'
    check (invitation_status in ('pending', 'accepted', 'declined', 'removed')),
  created_at timestamptz not null default now(),
  constraint trip_members_unique unique (trip_id, user_id)
);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  item_type text not null
    check (item_type in ('place', 'flight', 'hotel', 'train', 'ground_transport', 'other')),
  title text not null,
  description text,
  location_name text,
  address text,
  latitude double precision,
  longitude double precision,
  start_at timestamptz,
  end_at timestamptz,
  timezone text,
  sort_order integer not null default 0,
  booking_reference text,
  source_url text,
  thumbnail_url text,
  details jsonb not null default '{}'::jsonb,
  osm_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friends (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friends_no_self check (requester_id <> recipient_id),
  constraint friends_pair_unique unique (requester_id, recipient_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null,
  message text not null,
  related_trip_id uuid references public.trips (id) on delete set null,
  related_item_id uuid references public.itinerary_items (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.trip_suggestions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  suggestion_data jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now()
);

create table public.imported_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider_message_id text not null,
  status text not null default 'received'
    check (status in ('received', 'processing', 'ready_for_review', 'confirmed', 'rejected', 'error')),
  processing_error text,
  subject text,
  from_address text,
  normalized_booking_key text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint imported_emails_provider_unique unique (provider_message_id)
);

create table public.reservation_reviews (
  id uuid primary key default gen_random_uuid(),
  imported_email_id uuid not null references public.imported_emails (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  extracted_data jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_transport_modes text[] not null default array['walking', 'transit']::text[],
  travel_pace text not null default 'moderate'
    check (travel_pace in ('relaxed', 'moderate', 'packed')),
  interests text[] not null default '{}'::text[],
  distance_unit text not null default 'km' check (distance_unit in ('km', 'mi')),
  timezone_display text not null default 'destination'
    check (timezone_display in ('destination', 'home', 'utc')),
  auto_confirm_imports boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transport_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  from_item_id uuid not null references public.itinerary_items (id) on delete cascade,
  to_item_id uuid not null references public.itinerary_items (id) on delete cascade,
  mode text not null check (mode in ('car', 'walking', 'bicycle', 'transit')),
  duration_seconds integer,
  distance_meters double precision,
  geometry jsonb,
  is_manual boolean not null default false,
  manual_duration_minutes integer,
  unavailable_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_segments_pair unique (trip_id, from_item_id, to_item_id)
);

create table public.email_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  alias_token text not null unique,
  created_at timestamptz not null default now()
);

-- Indexes
create index trips_owner_id_idx on public.trips (owner_id);
create index trip_members_user_id_idx on public.trip_members (user_id);
create index trip_members_trip_id_idx on public.trip_members (trip_id);
create index itinerary_items_trip_sort_idx on public.itinerary_items (trip_id, sort_order, start_at);
create index itinerary_items_osm_id_idx on public.itinerary_items (osm_id) where osm_id is not null;
create index friends_requester_idx on public.friends (requester_id);
create index friends_recipient_idx on public.friends (recipient_id);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index profiles_username_lower_idx on public.profiles (lower(username));
create index imported_emails_user_idx on public.imported_emails (user_id, created_at desc);
create index imported_emails_booking_idx on public.imported_emails (user_id, normalized_booking_key)
  where normalized_booking_key is not null;

-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();
create trigger itinerary_items_updated_at before update on public.itinerary_items
  for each row execute function public.set_updated_at();
create trigger friends_updated_at before update on public.friends
  for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger reservation_reviews_updated_at before update on public.reservation_reviews
  for each row execute function public.set_updated_at();
create trigger transport_segments_updated_at before update on public.transport_segments
  for each row execute function public.set_updated_at();

-- Auth signup → profile + preferences + email alias
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  alias text;
begin
  uname := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );
  uname := regexp_replace(uname, '[^a-zA-Z0-9_]', '_', 'g');
  if length(uname) < 3 then
    uname := uname || '_user';
  end if;
  uname := left(uname, 30);

  -- Ensure uniqueness
  while exists (select 1 from public.profiles where username = uname) loop
    uname := left(uname, 24) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname));

  insert into public.user_preferences (user_id) values (new.id);

  alias := replace(gen_random_uuid()::text, '-', '');
  insert into public.email_aliases (user_id, alias_token) values (new.id, alias);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Membership helpers for RLS
create or replace function public.is_trip_member(p_trip_id uuid, p_statuses text[] default array['accepted'])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id
      and tm.user_id = auth.uid()
      and tm.invitation_status = any (p_statuses)
  );
$$;

create or replace function public.trip_role(p_trip_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tm.role from public.trip_members tm
  where tm.trip_id = p_trip_id
    and tm.user_id = auth.uid()
    and tm.invitation_status = 'accepted'
  limit 1;
$$;

create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.trip_role(p_trip_id) in ('owner', 'editor'), false);
$$;

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.trip_role(p_trip_id) = 'owner', false);
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.friends enable row level security;
alter table public.notifications enable row level security;
alter table public.trip_suggestions enable row level security;
alter table public.imported_emails enable row level security;
alter table public.reservation_reviews enable row level security;
alter table public.user_preferences enable row level security;
alter table public.transport_segments enable row level security;
alter table public.email_aliases enable row level security;

-- Profiles policies
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated
  using (true);

create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Trips
create policy "Members can view accepted trips"
  on public.trips for select to authenticated
  using (public.is_trip_member(id));

create policy "Authenticated users can create trips they own"
  on public.trips for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Editors and owners can update trips"
  on public.trips for update to authenticated
  using (public.can_edit_trip(id))
  with check (public.can_edit_trip(id));

create policy "Owners can delete trips"
  on public.trips for delete to authenticated
  using (public.is_trip_owner(id));

-- Trip members
create policy "Members can view membership of their trips"
  on public.trip_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_trip_member(trip_id)
    or public.is_trip_member(trip_id, array['pending', 'accepted'])
  );

create policy "Owners can insert members"
  on public.trip_members for insert to authenticated
  with check (
    (role = 'owner' and user_id = auth.uid() and invited_by = auth.uid())
    or public.is_trip_owner(trip_id)
  );

create policy "Owners manage members; invitees update own invitation"
  on public.trip_members for update to authenticated
  using (
    public.is_trip_owner(trip_id)
    or (user_id = auth.uid() and invitation_status = 'pending')
  )
  with check (
    public.is_trip_owner(trip_id)
    or (user_id = auth.uid())
  );

create policy "Owners can remove members"
  on public.trip_members for delete to authenticated
  using (public.is_trip_owner(trip_id) or user_id = auth.uid());

-- Itinerary items
create policy "Members can view itinerary items"
  on public.itinerary_items for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "Editors can insert itinerary items"
  on public.itinerary_items for insert to authenticated
  with check (public.can_edit_trip(trip_id) and created_by = auth.uid());

create policy "Editors can update itinerary items"
  on public.itinerary_items for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create policy "Editors can delete itinerary items"
  on public.itinerary_items for delete to authenticated
  using (public.can_edit_trip(trip_id));

-- Friends
create policy "Participants view friendships"
  on public.friends for select to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid());

create policy "Users send friend requests"
  on public.friends for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

create policy "Participants update friendships"
  on public.friends for update to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid())
  with check (requester_id = auth.uid() or recipient_id = auth.uid());

create policy "Participants delete friendships"
  on public.friends for delete to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid());

-- Notifications
create policy "Users view own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Users update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Authenticated can insert notifications for others via app"
  on public.notifications for insert to authenticated
  with check (true);

-- Suggestions
create policy "Members view suggestions"
  on public.trip_suggestions for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "Editors create suggestions"
  on public.trip_suggestions for insert to authenticated
  with check (public.can_edit_trip(trip_id) and created_by = auth.uid());

create policy "Editors update suggestions"
  on public.trip_suggestions for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

-- Imported emails / reviews
create policy "Users manage own imported emails"
  on public.imported_emails for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own reservation reviews"
  on public.reservation_reviews for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Preferences
create policy "Users manage own preferences"
  on public.user_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Transport segments
create policy "Members view transport segments"
  on public.transport_segments for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "Editors manage transport segments"
  on public.transport_segments for all to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

-- Email aliases
create policy "Users view own email alias"
  on public.email_aliases for select to authenticated
  using (user_id = auth.uid());

-- Storage bucket for avatars (run in dashboard or via storage API)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Realtime
alter publication supabase_realtime add table public.notifications;
