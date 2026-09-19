-- Notification subscriptions + delivery log for the daily-nudge feature.
-- Idempotent — safe to re-run.
--
-- Two tables:
--   notification_subscriptions — per-user channel preferences + push subscription JSON
--   notification_log           — every send attempt with status + error for debugging

-- ─── notification_subscriptions ────────────────────────────────────────────

create table if not exists public.notification_subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  web_push_enabled       boolean not null default false,
  web_push_subscription  jsonb,                -- raw PushSubscription serialized
  whatsapp_enabled       boolean not null default false,
  phone_e164             text,                 -- normalized E.164, e.g. "+919876543210"
  whatsapp_status        text not null default 'none'
                              check (whatsapp_status in ('none','pending','active','revoked')),
  last_inbound_at        timestamptz,          -- last time we received a WhatsApp message from this user (for 24h-window tracking)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Native push (Capacitor APNs/FCM) — added for the mobile app shell. Additive so
-- re-running on an existing DB just no-ops these columns.
alter table public.notification_subscriptions
  add column if not exists native_push_enabled  boolean not null default false;
alter table public.notification_subscriptions
  add column if not exists native_push_token     text;      -- APNs/FCM registration token
alter table public.notification_subscriptions
  add column if not exists native_push_platform  text
    check (native_push_platform in ('ios','android'));

alter table public.notification_subscriptions enable row level security;

drop policy if exists "notification_subscriptions_select_own" on public.notification_subscriptions;
drop policy if exists "notification_subscriptions_insert_own" on public.notification_subscriptions;
drop policy if exists "notification_subscriptions_update_own" on public.notification_subscriptions;
drop policy if exists "notification_subscriptions_delete_own" on public.notification_subscriptions;

create policy "notification_subscriptions_select_own" on public.notification_subscriptions
  for select using (auth.uid() = user_id);
create policy "notification_subscriptions_insert_own" on public.notification_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "notification_subscriptions_update_own" on public.notification_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notification_subscriptions_delete_own" on public.notification_subscriptions
  for delete using (auth.uid() = user_id);

-- Index for finding all opted-in users in the cron (faster than scanning entire table).
create index if not exists notification_subscriptions_active_idx
  on public.notification_subscriptions (user_id)
  where web_push_enabled or whatsapp_enabled or native_push_enabled;

-- Index for webhook lookups by phone number (Twilio sends inbound keyed by phone).
create index if not exists notification_subscriptions_phone_idx
  on public.notification_subscriptions (phone_e164)
  where phone_e164 is not null;

-- ─── notification_log ──────────────────────────────────────────────────────

create table if not exists public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  channel     text not null check (channel in ('web_push','whatsapp','native_push')),
  sent_at     timestamptz not null default now(),
  status      text not null check (status in ('queued','sent','failed','skipped')),
  error       text,
  payload     jsonb,                 -- the message we sent (title/body), for debugging
  send_date   date generated always as ((sent_at at time zone 'Asia/Kolkata')::date) stored
  -- send_date is the IST calendar day, used for daily dedupe. Adjust if the
  -- project ever serves users in other primary TZs.
);

-- Widen the channel check to include native_push on already-created tables.
do $$
begin
  alter table public.notification_log drop constraint if exists notification_log_channel_check;
  alter table public.notification_log
    add constraint notification_log_channel_check
    check (channel in ('web_push','whatsapp','native_push'));
end $$;

create index if not exists notification_log_user_date_idx
  on public.notification_log (user_id, send_date desc);

alter table public.notification_log enable row level security;

drop policy if exists "notification_log_select_own" on public.notification_log;
create policy "notification_log_select_own" on public.notification_log
  for select using (auth.uid() = user_id);

-- Writes go through the service-role client only (the cron + webhook).
-- No insert/update/delete policies for anon/authenticated.
