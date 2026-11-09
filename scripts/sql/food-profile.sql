-- Bo's server-side food profile + the DPDP consent ledger.
-- Idempotent — safe to re-run. Additive only: no existing table, column,
-- function, policy or grant is touched.
--
-- Two tables:
--   user_food_profile — what Bo needs to plan for a user (diet, allergies,
--                       tastes, goal, household, budget, Swiggy address,
--                       quiet hours). A row exists ONLY while the user has
--                       consented; withdrawing consent deletes it.
--   consent_events    — append-only record of each grant / withdrawal, so we
--                       can show what was agreed to, when, under which notice.
--
-- WRITES GO THROUGH THE SERVER ONLY (service role, app/api/bo/*), never
-- straight from the browser: the route checks consent, the age confirmation
-- and the field limits before anything is stored. Owners may read and delete
-- their own rows through RLS; there is no insert/update policy on purpose.

-- ─── user_food_profile ─────────────────────────────────────────────────────

create table if not exists public.user_food_profile (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  -- Same vocabulary as lib/preferences.ts: lowercase diets, allergies without
  -- the "avoid " prefix, tastes are the soft favoriteCuisines signal.
  diets                text[] not null default '{}',
  allergies            text[] not null default '{}',
  tastes               text[] not null default '{}',
  goal                 text check (goal in ('lose','maintain','gain')),
  household_size       smallint check (household_size between 1 and 20),
  budget_band          text check (budget_band in ('low','mid','high')),
  swiggy_address_id    text,           -- Swiggy's own address id, not the address
  quiet_hours_start    smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end      smallint check (quiet_hours_end   between 0 and 23),
  timezone             text not null default 'Asia/Kolkata',
  -- Consent (DPDP Act 2023 s.6). The row cannot exist without both.
  consent_version      text not null,
  consented_at         timestamptz not null default now(),
  age_confirmed        boolean not null check (age_confirmed),
  -- Separate, optional purpose: proactive nudges (Phase 4). Off by default.
  nudges_consented_at  timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint user_food_profile_list_sizes check (
    cardinality(diets) <= 20 and cardinality(allergies) <= 30 and cardinality(tastes) <= 40
  )
);

alter table public.user_food_profile enable row level security;

drop policy if exists "user_food_profile_select_own" on public.user_food_profile;
drop policy if exists "user_food_profile_delete_own" on public.user_food_profile;

create policy "user_food_profile_select_own" on public.user_food_profile
  for select using (auth.uid() = user_id);
create policy "user_food_profile_delete_own" on public.user_food_profile
  for delete using (auth.uid() = user_id);

-- ─── consent_events ────────────────────────────────────────────────────────

create table if not exists public.consent_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  purpose         text not null check (purpose in ('bo_profile','bo_nudges')),
  action          text not null check (action in ('granted','withdrawn')),
  notice_version  text not null,
  platform        text check (platform in ('web','ios','android')),
  created_at      timestamptz not null default now()
);

create index if not exists consent_events_user_idx on public.consent_events (user_id, created_at desc);

alter table public.consent_events enable row level security;

drop policy if exists "consent_events_select_own" on public.consent_events;
create policy "consent_events_select_own" on public.consent_events
  for select using (auth.uid() = user_id);
