-- Meal tracker server storage: meal_logs + nutrition_goals.
-- Mirrors the localStorage shape from lib/storage.ts. Signed-in users sync to these
-- tables; anonymous users continue to use localStorage only.
-- Run in the Supabase SQL editor after deploying the corresponding client code.

-- ─── meal_logs ──────────────────────────────────────────────────────────────

create table if not exists public.meal_logs (
  id          text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,                                 -- user's local YYYY-MM-DD
  meal_type   text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  source      text not null check (source in ('planned','search','manual','photo')),
  name        text not null,
  calories    int  not null default 0,
  protein     real not null default 0,
  carbs       real not null default 0,
  fat         real not null default 0,
  image_url   text,
  notes       text,
  logged_at   timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, date desc);

alter table public.meal_logs enable row level security;

drop policy if exists "meal_logs_select_own"  on public.meal_logs;
drop policy if exists "meal_logs_insert_own"  on public.meal_logs;
drop policy if exists "meal_logs_update_own"  on public.meal_logs;
drop policy if exists "meal_logs_delete_own"  on public.meal_logs;

create policy "meal_logs_select_own" on public.meal_logs
  for select using (auth.uid() = user_id);
create policy "meal_logs_insert_own" on public.meal_logs
  for insert with check (auth.uid() = user_id);
create policy "meal_logs_update_own" on public.meal_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_logs_delete_own" on public.meal_logs
  for delete using (auth.uid() = user_id);

-- ─── nutrition_goals ───────────────────────────────────────────────────────

create table if not exists public.nutrition_goals (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  daily_calories int  not null,
  protein        int  not null,
  carbs          int  not null,
  fat            int  not null,
  goal           text not null check (goal in ('lose','maintain','gain')),
  profile        jsonb,
  updated_at     timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;

drop policy if exists "nutrition_goals_select_own"   on public.nutrition_goals;
drop policy if exists "nutrition_goals_upsert_own"   on public.nutrition_goals;
drop policy if exists "nutrition_goals_update_own"   on public.nutrition_goals;
drop policy if exists "nutrition_goals_delete_own"   on public.nutrition_goals;

create policy "nutrition_goals_select_own" on public.nutrition_goals
  for select using (auth.uid() = user_id);
create policy "nutrition_goals_upsert_own" on public.nutrition_goals
  for insert with check (auth.uid() = user_id);
create policy "nutrition_goals_update_own" on public.nutrition_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nutrition_goals_delete_own" on public.nutrition_goals
  for delete using (auth.uid() = user_id);
