-- Trip-scoped inbound email slugs + AwardWallet (or other) loyalty links

alter table public.trips
  add column if not exists email_slug text;

create unique index if not exists trips_email_slug_unique
  on public.trips (email_slug)
  where email_slug is not null;

-- Backfill slugs for existing trips from name or short id
update public.trips t
set email_slug = lower(
  regexp_replace(
    coalesce(nullif(trim(t.name), ''), 'trip' || substr(replace(t.id::text, '-', ''), 1, 8)),
    '[^a-zA-Z0-9]+',
    '',
    'g'
  )
)
where t.email_slug is null;

-- Ensure uniqueness if collisions
do $$
declare
  r record;
  candidate text;
  n int;
begin
  for r in
    select id, email_slug from public.trips
    where email_slug is not null
    order by created_at
  loop
    candidate := left(r.email_slug, 40);
    if length(candidate) < 3 then
      candidate := 'trip' || substr(replace(r.id::text, '-', ''), 1, 8);
    end if;
    n := 0;
    while exists (
      select 1 from public.trips x
      where x.email_slug = candidate and x.id <> r.id
    ) loop
      n := n + 1;
      candidate := left(r.email_slug, 32) || n::text;
    end loop;
    update public.trips set email_slug = candidate where id = r.id;
  end loop;
end $$;

alter table public.loyalty_balances
  add column if not exists external_account_id text,
  add column if not exists provider text;

create table public.loyalty_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('awardwallet')),
  external_user_id text not null,
  access_level text not null default 'read_balances',
  status text not null default 'connected'
    check (status in ('connected', 'disconnected', 'error')),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index loyalty_connections_user_idx on public.loyalty_connections (user_id);

create trigger loyalty_connections_set_updated_at
  before update on public.loyalty_connections
  for each row execute function public.set_updated_at();

alter table public.loyalty_connections enable row level security;

create policy "Users manage own loyalty connections"
  on public.loyalty_connections for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
