-- MCP provider registry.
--
-- Generalizes the working Swiggy integration instead of adding a parallel
-- system. Today lib/swiggy-mcp.ts hardcodes three server URLs,
-- lib/swiggy-oauth.ts hardcodes SWIGGY_BASE, and swiggy_tokens is
-- single-provider. This turns all of that into rows so enabling a provider is
-- a config change rather than a deploy.
--
-- HONEST SCOPE NOTE: this makes the SYSTEM provider-agnostic. It cannot make a
-- third party accept us. Swiggy's MCP OAuth gates to a hardcoded allowlist of
-- AI clients and returns "Vercel isn't whitelisted yet" for a custom web
-- origin; Instacart/Uber/Zomato may not expose a public MCP endpoint at all.
-- The value here is that IF access is granted, turning it on is a toggle.
--
-- Additive and idempotent.

-- ─── mcp_providers ─────────────────────────────────────────────────────────
-- Public identifiers and endpoints only. Client SECRETS stay in env vars keyed
-- by provider id (MCP_SWIGGY_CLIENT_ID, MCP_INSTACART_CLIENT_ID, ...) and are
-- never stored here -- same boundary as app_config.

create table if not exists public.mcp_providers (
  id              text primary key,
  name            text not null,
  enabled         boolean not null default false,
  auth_type       text not null default 'oauth_pkce'
                    check (auth_type in ('oauth_pkce','api_key','none')),
  authorize_base  text,
  authorize_path  text not null default '/auth/authorize',
  token_path      text not null default '/auth/token',
  revoke_path     text,
  scopes          text,
  -- env var holding this provider's client id; NOT the value itself
  client_id_env   text,
  icon            text,
  sort            int not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── mcp_provider_servers ──────────────────────────────────────────────────
-- One provider can expose several MCP endpoints (Swiggy has food / im /
-- dineout). tool_allowlist NULL = expose every tool the server advertises.

create table if not exists public.mcp_provider_servers (
  provider_id    text not null references public.mcp_providers(id) on delete cascade,
  service_key    text not null,
  label          text,
  url            text not null,
  tool_allowlist text[],
  enabled        boolean not null default true,
  sort           int not null default 0,
  primary key (provider_id, service_key)
);

-- ─── mcp_connections ───────────────────────────────────────────────────────
-- Per-user tokens, generalized from swiggy_tokens.

create table if not exists public.mcp_connections (
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider_id  text not null references public.mcp_providers(id) on delete cascade,
  access_token text not null,
  token_type   text not null default 'Bearer',
  scope        text,
  expires_at   timestamptz not null,
  granted_at   timestamptz not null default now(),
  primary key (user_id, provider_id)
);

create index if not exists mcp_connections_provider_idx on public.mcp_connections (provider_id);

-- ─── Seed: Swiggy, mirroring the constants it replaces ─────────────────────
-- Values taken verbatim from lib/swiggy-oauth.ts and lib/swiggy-mcp.ts.
-- enabled=false matches the existing feature_flags row ('mcp_swiggy', false)
-- and Dead End #1 -- do not flip it on without confirmed whitelist access.

insert into public.mcp_providers
  (id, name, enabled, auth_type, authorize_base, authorize_path, token_path, revoke_path, scopes, client_id_env, sort, notes)
values
  ('swiggy', 'Swiggy', false, 'oauth_pkce',
   'https://mcp.swiggy.com', '/auth/authorize', '/auth/token', '/auth/logout',
   'mcp:tools mcp:resources mcp:prompts', 'SWIGGY_CLIENT_ID', 0,
   'JWT bearer, 5-day expiry, NO refresh tokens in v1. OAuth is gated to an allowlist of AI clients.')
on conflict (id) do nothing;

insert into public.mcp_provider_servers (provider_id, service_key, label, url, sort) values
  ('swiggy', 'food',    'Swiggy Food',      'https://mcp.swiggy.com/food',    0),
  ('swiggy', 'im',      'Swiggy Instamart', 'https://mcp.swiggy.com/im',      1),
  ('swiggy', 'dineout', 'Swiggy Dineout',   'https://mcp.swiggy.com/dineout', 2)
on conflict (provider_id, service_key) do nothing;

-- Placeholders so the admin UI has something to configure if access is ever
-- granted. No endpoints -- deliberately blank until a real one is known, so
-- nobody mistakes a guess for a documented URL.
insert into public.mcp_providers (id, name, enabled, auth_type, sort, notes) values
  ('instacart', 'Instacart', false, 'oauth_pkce', 1, 'No public MCP endpoint known. Placeholder.'),
  ('zomato',    'Zomato',    false, 'oauth_pkce', 2, 'No public MCP endpoint known. Placeholder.'),
  ('uber',      'Uber',      false, 'oauth_pkce', 3, 'No public MCP endpoint known. Placeholder.')
on conflict (id) do nothing;

-- ─── Migrate existing Swiggy tokens ────────────────────────────────────────
-- swiggy_tokens stays in place, readable, but is no longer written to. Drop it
-- one release after this ships.

insert into public.mcp_connections
  (user_id, provider_id, access_token, token_type, scope, expires_at, granted_at)
select user_id, 'swiggy', access_token, token_type, scope, expires_at, granted_at
from public.swiggy_tokens
on conflict (user_id, provider_id) do nothing;

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.mcp_providers        enable row level security;
alter table public.mcp_provider_servers enable row level security;
alter table public.mcp_connections      enable row level security;

-- Provider catalogue is public config (names, icons, endpoints) so the
-- Connections settings UI can render it. Only enabled rows are exposed.
drop policy if exists "mcp_providers_select_enabled" on public.mcp_providers;
create policy "mcp_providers_select_enabled" on public.mcp_providers
  for select using (enabled);

drop policy if exists "mcp_provider_servers_select_enabled" on public.mcp_provider_servers;
create policy "mcp_provider_servers_select_enabled" on public.mcp_provider_servers
  for select using (enabled);

-- Users may see and revoke their own connections. Writes are service-role only
-- (the OAuth callback), mirroring swiggy_tokens.
drop policy if exists "mcp_connections_select_own" on public.mcp_connections;
create policy "mcp_connections_select_own" on public.mcp_connections
  for select using (auth.uid() = user_id);

drop policy if exists "mcp_connections_delete_own" on public.mcp_connections;
create policy "mcp_connections_delete_own" on public.mcp_connections
  for delete using (auth.uid() = user_id);

-- swiggy_tokens let a user SELECT their own row INCLUDING access_token, so any
-- XSS could exfiltrate a live ordering token straight from PostgREST. RLS
-- cannot restrict columns; column grants can. The UI only ever needs expiry
-- metadata -- /api/swiggy/status deliberately never returned the token either.
revoke select on public.mcp_connections from authenticated, anon;

grant select (
  user_id,
  provider_id,
  token_type,
  scope,
  expires_at,
  granted_at
) on public.mcp_connections to authenticated;
