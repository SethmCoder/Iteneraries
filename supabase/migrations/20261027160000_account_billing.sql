-- Account entitlement / billing period (free renew now; Stripe-ready later)

create table public.account_billing (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- free | pro (pro reserved for paid plans)
  plan text not null default 'free' check (plan in ('free', 'pro')),
  -- active = access; expired = locked pending renew/delete; canceled reserved for paid churn
  status text not null default 'active'
    check (status in ('active', 'expired', 'canceled', 'past_due')),
  -- none | manual | stripe — how the current period was granted
  billing_provider text not null default 'manual'
    check (billing_provider in ('none', 'manual', 'stripe')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  -- Soft-lock at period end; hard-delete after this (default +7 days)
  delete_after timestamptz,
  last_renewed_at timestamptz,
  -- Reminder stages: none | d7 | d1 | expired
  reminder_stage text not null default 'none'
    check (reminder_stage in ('none', 'd7', 'd1', 'expired')),
  last_reminder_at timestamptz,
  -- Reserved for Stripe (unused until paid launch)
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index account_billing_period_end_idx on public.account_billing (current_period_end);
create index account_billing_status_idx on public.account_billing (status);

create trigger account_billing_set_updated_at
  before update on public.account_billing
  for each row execute function public.set_updated_at();

alter table public.account_billing enable row level security;

create policy "Users read own billing"
  on public.account_billing for select to authenticated
  using (user_id = auth.uid());

create policy "Users update own billing renew fields"
  on public.account_billing for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Backfill existing users with a fresh 30-day period
insert into public.account_billing (user_id, plan, status, billing_provider, current_period_start, current_period_end)
select
  p.id,
  'free',
  'active',
  'manual',
  now(),
  now() + interval '30 days'
from public.profiles p
on conflict (user_id) do nothing;

-- Extend signup trigger: create billing row for new users
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

  while exists (select 1 from public.profiles where username = uname) loop
    uname := left(uname, 24) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', uname));

  insert into public.user_preferences (user_id) values (new.id);

  alias := replace(gen_random_uuid()::text, '-', '');
  insert into public.email_aliases (user_id, alias_token) values (new.id, alias);

  insert into public.account_billing (
    user_id, plan, status, billing_provider,
    current_period_start, current_period_end
  ) values (
    new.id, 'free', 'active', 'manual',
    now(), now() + interval '30 days'
  );

  return new;
end;
$$;
