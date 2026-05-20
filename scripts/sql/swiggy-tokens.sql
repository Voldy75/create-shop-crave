-- Swiggy MCP per-user OAuth tokens.
-- One row per user; updated on each (re)authorization. Idempotent — safe to re-run.
--
-- Token lifetime in v1 of Swiggy MCP is 5 days, no refresh tokens.
-- We store the raw access_token + expiry so the agent route can mint MCP
-- clients on demand and the UI can show a "reconnect in N days" banner.

create table if not exists public.swiggy_tokens (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  token_type   text not null default 'Bearer',
  scope        text,
  expires_at   timestamptz not null,
  granted_at   timestamptz not null default now()
);

create index if not exists swiggy_tokens_expires_at_idx on public.swiggy_tokens (expires_at);

alter table public.swiggy_tokens enable row level security;

drop policy if exists "swiggy_tokens_select_own" on public.swiggy_tokens;
drop policy if exists "swiggy_tokens_delete_own" on public.swiggy_tokens;

-- Users can see their own (so the UI can show connection state + expiry).
-- They CANNOT insert or update tokens directly — only the service-role
-- callback route persists tokens, since the OAuth code exchange happens
-- server-side.
create policy "swiggy_tokens_select_own" on public.swiggy_tokens
  for select using (auth.uid() = user_id);

-- Users can disconnect (delete their own row).
create policy "swiggy_tokens_delete_own" on public.swiggy_tokens
  for delete using (auth.uid() = user_id);
