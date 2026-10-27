-- Flight Booker: loyalty balances, award searches, results, RLS

create table public.loyalty_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  program text not null,
  balance integer not null default 0 check (balance >= 0),
  currency_label text not null default 'points',
  source text not null default 'manual' check (source in ('manual', 'verified')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, program)
);

create table public.award_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  origin text not null,
  destination text not null,
  trip_type text not null default 'one_way' check (trip_type in ('one_way', 'round_trip')),
  depart_date date,
  depart_date_end date,
  return_date date,
  return_date_end date,
  passengers integer not null default 1 check (passengers >= 1 and passengers <= 9),
  cabin text not null default 'economy'
    check (cabin in ('economy', 'premium_economy', 'business', 'first')),
  max_points_per_passenger integer,
  max_points_total integer,
  max_cash_fees numeric(12, 2),
  preferred_program text,
  status text not null default 'setup_required'
    check (status in ('monitoring', 'match_found', 'paused', 'setup_required')),
  notify_on_match boolean not null default true,
  require_booking_approval boolean not null default true,
  poll_interval_minutes integer not null default 360 check (poll_interval_minutes >= 60),
  last_checked_at timestamptz,
  last_notified_fingerprint text,
  paused_at timestamptz,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.award_search_programs (
  search_id uuid not null references public.award_searches (id) on delete cascade,
  program text not null,
  primary key (search_id, program)
);

create table public.award_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.award_searches (id) on delete cascade,
  airline text,
  flight_numbers text,
  origin_airport text not null,
  destination_airport text not null,
  depart_at timestamptz,
  arrive_at timestamptz,
  timezone text,
  duration_minutes integer,
  stops integer not null default 0,
  cabin text,
  points_per_passenger integer,
  points_total integer,
  taxes_fees numeric(12, 2),
  currency text default 'USD',
  loyalty_program text,
  booking_url text,
  availability_status text not null default 'unverified'
    check (availability_status in ('confirmed', 'estimated', 'stale', 'unverified')),
  provider text not null default 'seats_aero',
  provider_result_id text,
  fingerprint text not null,
  compromises text[] not null default '{}',
  raw jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (search_id, fingerprint)
);

create index award_searches_user_idx on public.award_searches (user_id);
create index award_searches_status_idx on public.award_searches (status);
create index award_results_search_idx on public.award_results (search_id);
create index loyalty_balances_user_idx on public.loyalty_balances (user_id);

create trigger loyalty_balances_set_updated_at
  before update on public.loyalty_balances
  for each row execute function public.set_updated_at();

create trigger award_searches_set_updated_at
  before update on public.award_searches
  for each row execute function public.set_updated_at();

alter table public.loyalty_balances enable row level security;
alter table public.award_searches enable row level security;
alter table public.award_search_programs enable row level security;
alter table public.award_results enable row level security;

create policy "Users manage own loyalty balances"
  on public.loyalty_balances for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own award searches"
  on public.award_searches for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users manage own award search programs"
  on public.award_search_programs for all to authenticated
  using (
    exists (
      select 1 from public.award_searches s
      where s.id = search_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.award_searches s
      where s.id = search_id and s.user_id = auth.uid()
    )
  );

create policy "Users manage own award results"
  on public.award_results for all to authenticated
  using (
    exists (
      select 1 from public.award_searches s
      where s.id = search_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.award_searches s
      where s.id = search_id and s.user_id = auth.uid()
    )
  );
