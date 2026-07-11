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
