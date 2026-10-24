-- Feature flags for runtime feature gating.
-- Admins toggle flags via the /admin dashboard; the app reads them
-- via /api/admin/flags and caches client-side.

create table if not exists public.feature_flags (
  id          text primary key,               -- e.g. "mcp_swiggy", "mcp_zomato"
  enabled     boolean not null default false,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

-- Everyone can read flags (they're app-wide config, not sensitive).
drop policy if exists "feature_flags_select_all" on public.feature_flags;
create policy "feature_flags_select_all" on public.feature_flags
  for select using (true);

-- Seed default flags (idempotent).
insert into public.feature_flags (id, enabled, description) values
  ('mcp_swiggy',    false, 'Swiggy MCP server connectivity'),
  ('mcp_instacart', false, 'Instacart MCP server connectivity'),
  ('mcp_zomato',    false, 'Zomato MCP server connectivity'),
  ('agent_mode',    true,  'AI agent mode with tool calling'),
  ('meal_planner',  true,  'Meal planner / nutrition tracker'),
  ('pro_upgrade',   true,  'Pro subscription upgrade flow')
on conflict (id) do nothing;

-- Partner switches (lib/partners.ts). Swiggy, Instamart, Dineout, Uber and Ola
-- are the launch set and are not flag-gated; these three can be turned back on
-- from Admin -> Flags with no deploy. Seeded OFF (launch decision 2026-10-24).
insert into public.feature_flags (id, enabled, description) values
  ('partner_zomato',    false, 'Show Zomato links (food delivery + dining out)'),
  ('partner_blinkit',   false, 'Show Blinkit grocery links'),
  ('partner_instacart', false, 'Show Instacart grocery links and its Connections row')
on conflict (id) do nothing;

-- "Cook with a soundtrack": a Spotify playlist link in the cooking views.
-- A plain outbound link (no Spotify account connection). Seeded ON (2026-10-24).
insert into public.feature_flags (id, enabled, description) values
  ('partner_spotify', true, 'Show the Cook-with-a-soundtrack Spotify link in cooking views')
on conflict (id) do nothing;
