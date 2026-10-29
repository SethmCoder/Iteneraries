-- Additive pending cars and activities (booking checklist)

create table public.pending_cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  provider text,
  pickup_location text,
  dropoff_location text,
  pickup_at timestamptz,
  dropoff_at timestamptz,
  booking_status text not null default 'needs_booking'
    check (booking_status in ('needs_booking', 'in_progress', 'booked', 'skipped')),
  booking_url text,
  confirmation_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pending_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  activity_type text not null default 'other'
    check (activity_type in (
      'restaurant', 'meeting', 'transportation', 'attraction',
      'hotel', 'flight', 'other'
    )),
  location text,
  start_at timestamptz,
  end_at timestamptz,
  booking_status text not null default 'needs_booking'
    check (booking_status in ('needs_booking', 'in_progress', 'booked', 'skipped')),
  booking_url text,
  confirmation_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pending_cars_user_idx on public.pending_cars (user_id);
create index pending_cars_trip_idx on public.pending_cars (trip_id);
create index pending_activities_user_idx on public.pending_activities (user_id);
create index pending_activities_trip_idx on public.pending_activities (trip_id);

create trigger pending_cars_set_updated_at
  before update on public.pending_cars
  for each row execute function public.set_updated_at();

create trigger pending_activities_set_updated_at
  before update on public.pending_activities
  for each row execute function public.set_updated_at();

alter table public.pending_cars enable row level security;
alter table public.pending_activities enable row level security;

create policy "Users manage own pending cars"
  on public.pending_cars for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own pending activities"
  on public.pending_activities for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Optional flight number on pending flights (additive)
alter table public.pending_flights
  add column if not exists flight_number text;
