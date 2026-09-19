-- Dynamic Client Registration (RFC 7591) + refresh-token storage for MCP.
--
-- WHY: the registry was built assuming a client id is provisioned by hand into
-- an env var (client_id_env -> SWIGGY_CLIENT_ID). Swiggy's developer docs say
-- the opposite, verbatim: "Your MCP client registers itself via Dynamic Client
-- Registration - no client identifier to apply for", and their discovery
-- document advertises a registration_endpoint. With the old assumption the
-- connect flow 503s before it ever reaches Swiggy, because both the start route
-- and activeProviders() hard-require that env var.
--
-- Measured against the live server (2026-09-05):
--   POST https://mcp.swiggy.com/auth/register -> 201
--   {"client_id":"swiggy-mcp", "token_endpoint_auth_method":"none",
--    "grant_types":["authorization_code","refresh_token"], ...}
-- Note client_id is a FIXED shared value, not per-client, and NO client_secret
-- is issued (public client). We still store what registration returns rather
-- than hardcoding "swiggy-mcp" -- that value is theirs to change.
--
-- BOUNDARY NOTE: mcp_providers is documented as holding "public identifiers and
-- endpoints only", with secrets left in env. A client_id IS a public
-- identifier (it is sent in a front-channel redirect URL), so caching it here
-- respects that boundary rather than bending it. No client_secret column is
-- added, deliberately -- these are public clients and PKCE is the proof.
--
-- Additive and idempotent.

alter table public.mcp_providers
  add column if not exists client_id           text,
  add column if not exists client_id_issued_at timestamptz,
  add column if not exists registration_path   text;

comment on column public.mcp_providers.client_id is
  'Cached Dynamic Client Registration result. Public identifier, never a secret. NULL = not yet registered; client_id_env still wins if set.';
comment on column public.mcp_providers.registration_path is
  'RFC 7591 registration endpoint path. NULL = provider does not support DCR, so a client id must come from client_id_env.';

update public.mcp_providers
   set registration_path = '/auth/register'
 where id = 'swiggy' and registration_path is null;

-- ─── refresh tokens ────────────────────────────────────────────────────────
-- Swiggy's prose docs say "refresh-token issuance is not wired in v1.0", but
-- the LIVE discovery document lists refresh_token in grant_types_supported and
-- /auth/register echoes it back as accepted. The docs lag the server. Access
-- tokens last 5 days; without this column every user redoes phone+OTP on day 5.
-- Nullable on purpose: if the provider issues no refresh_token we simply fall
-- back to the existing full re-auth path.

alter table public.mcp_connections
  add column if not exists refresh_token text;

comment on column public.mcp_connections.refresh_token is
  'OAuth refresh token, when the provider issues one. NULL = re-auth on expiry.';

-- ─── Grants: refresh_token must be as unreadable as access_token ───────────
-- mcp_connections uses a column ALLOWLIST (see mcp-registry.sql), so a newly
-- added column is ungranted by default and this is belt-and-braces. It is
-- written down anyway because the allowlist is the only thing standing between
-- an XSS and a live ordering token, and a future reader adding refresh_token
-- to that grant list would silently reopen exactly the hole swiggy_tokens had.
-- A refresh token is STRICTLY MORE dangerous than an access token: it does not
-- expire in 5 days.
revoke select (refresh_token) on public.mcp_connections from authenticated, anon;
