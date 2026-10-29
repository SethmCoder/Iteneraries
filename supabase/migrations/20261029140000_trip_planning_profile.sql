-- Additive trip planning preferences (adaptive setup). Non-destructive.
alter table public.trips
  add column if not exists planning_profile jsonb not null default '{}'::jsonb;
