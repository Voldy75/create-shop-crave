/**
 * "Powered by Swiggy / Instamart / Dineout" — Swiggy's REQUIRED attribution
 * for anything powered by Swiggy MCP (docs: Operate → Brand guidelines).
 *
 * Their rules, which this component encodes so call sites cannot drift:
 *   - the service's own square logo, then the exact phrase, together;
 *   - one badge per service — never a merged "Powered by Swiggy" for groceries;
 *   - logo ≥ 24px (32 standard), text ≥ 14px (16 standard), 8px gap and 8px
 *     clear space, logo at full opacity and original colours;
 *   - text contrast ≥ 4.5:1 — --m-ink on the app's grounds clears it in both
 *     themes;
 *   - with live text beside it, the logo is decorative so the phrase is read
 *     once.
 * The logos are Swiggy's published artwork, loaded from their brand-asset URLs
 * rather than copied, so the original files are always what renders.
 *
 * Plain inline styles on tokens: used in BOTH root layouts, and a class from
 * one tree's stylesheet does not exist in the other.
 */

export type SwiggyService = "food" | "instamart" | "dineout";

const META: Record<SwiggyService, { logo: string; phrase: string }> = {
  food: { logo: "https://mcp.swiggy.com/builders/brand-logos/swiggy-food.png", phrase: "Powered by Swiggy" },
  instamart: { logo: "https://mcp.swiggy.com/builders/brand-logos/swiggy-instamart.png", phrase: "Powered by Instamart" },
  dineout: { logo: "https://mcp.swiggy.com/builders/brand-logos/swiggy-dineout.png", phrase: "Powered by Dineout" },
};

export function SwiggyAttribution({ service, compact = false }: { service: SwiggyService; compact?: boolean }) {
  const { logo, phrase } = META[service];
  const size = compact ? 24 : 32;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: 8,
        font: `700 ${compact ? 14 : 16}px var(--m-font-body)`,
        color: "var(--m-ink)",
        whiteSpace: "nowrap",
        flex: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Swiggy's own artwork, served by Swiggy, at a fixed small size */}
      <img src={logo} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: size * 0.2, flex: "none" }} />
      {phrase}
    </span>
  );
}

/** Which Swiggy service an agent tool belongs to, from its namespaced name
 *  ("swiggy_food__search_restaurants", "swiggy_im__get_cart", …). */
export function serviceForTool(toolName: string): SwiggyService | null {
  if (toolName.startsWith("swiggy_food__")) return "food";
  if (toolName.startsWith("swiggy_im__")) return "instamart";
  if (toolName.startsWith("swiggy_dineout__")) return "dineout";
  return null;
}

/**
 * Badges for the Swiggy services an agent reply actually used, in the order
 * they first appear — one per service, never merged. Renders nothing for a
 * reply that touched no Swiggy tool. Swiggy wants attribution "in agent
 * responses", not only in a footer, so this sits under each reply.
 */
export function AgentAttribution({ invocations }: { invocations?: ReadonlyArray<{ toolName: string }> }) {
  const seen: SwiggyService[] = [];
  for (const inv of invocations ?? []) {
    const s = serviceForTool(inv.toolName);
    if (s && !seen.includes(s)) seen.push(s);
  }
  if (seen.length === 0) return null;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginLeft: -8 }}>
      {seen.map((s) => (
        <SwiggyAttribution key={s} service={s} compact />
      ))}
    </span>
  );
}
