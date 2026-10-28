-- Trip-linked pending flights and hotels (booking checklist)

create table public.pending_flights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  origin text not null,
  destination text not null,
  depart_date date,
  return_date date,
  passengers integer not null default 1 check (passengers >= 1 and passengers <= 9),
  airline text,
  booking_status text not null default 'needs_booking'
    check (booking_status in ('needs_booking', 'in_progress', 'booked', 'skipped')),
  booking_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pending_hotels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  hotel_name text not null,
  location text,
  check_in date,
  check_out date,
  rooms integer not null default 1 check (rooms >= 1 and rooms <= 20),
  guests integer not null default 1 check (guests >= 1 and guests <= 30),
  booking_status text not null default 'needs_booking'
    check (booking_status in ('needs_booking', 'in_progress', 'booked', 'skipped')),
  booking_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pending_flights_user_idx on public.pending_flights (user_id);
create index pending_flights_trip_idx on public.pending_flights (trip_id);
create index pending_hotels_user_idx on public.pending_hotels (user_id);
create index pending_hotels_trip_idx on public.pending_hotels (trip_id);

create trigger pending_flights_set_updated_at
  before update on public.pending_flights
  for each row execute function public.set_updated_at();

create trigger pending_hotels_set_updated_at
  before update on public.pending_hotels
  for each row execute function public.set_updated_at();

alter table public.pending_flights enable row level security;
alter table public.pending_hotels enable row level security;

create policy "Users manage own pending flights"
  on public.pending_flights for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own pending hotels"
  on public.pending_hotels for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
