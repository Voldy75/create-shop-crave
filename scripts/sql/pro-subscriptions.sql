-- Pro subscriptions: payment-provider records for users on the unlimited tier.
-- Used by the Stripe and Razorpay webhook handlers under app/api/subscribe/.
-- Captured retroactively into source — table was provisioned manually before
-- the scripts/sql/ folder existed. Idempotent — safe to re-run.

create table if not exists public.pro_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  provider                 text not null check (provider in ('razorpay','stripe')),
  provider_subscription_id text,
  provider_customer_id     text,
  status                   text not null default 'active'
                                check (status in ('active','cancelled','past_due','trialing')),
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.pro_subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.pro_subscriptions;
create policy "Users can read own subscription"
  on public.pro_subscriptions for select
  using (auth.uid() = user_id);

-- Writes go through the service-role client only (webhook handlers).
-- No insert/update/delete policies for anon/authenticated by design.
