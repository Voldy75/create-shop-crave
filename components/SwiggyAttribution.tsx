/**
 * "Powered by Swiggy / Instamart / Dineout" — Swiggy's REQUIRED attribution
 * for anything powered by Swiggy MCP (docs: Operate → Brand guidelines).
 *
 * Built to Swiggy's OWN badge, measured from the badge previews on their
 * brand-guidelines page (2026-10-24), not approximated:
 *   - the service's 512×512 SQUARE logo at 32px, corner radius 20%;
 *   - "Powered by " + the service name in bold, 16px, 8px gap, 8px padding;
 *   - on its own solid backing with 8px corners — white with navy text in
 *     light, near-black with off-white text in dark (tokens in
 *     design/meshi-a11y.css). The backing is what keeps it readable on a
 *     tinted or busy card ("solid backing on a busy surface").
 *
 * FIRST VERSION BUG: it used /builders/brand-logos/*.png, which are 344×142
 * WORDMARKS, squeezed into a 24px square — the logo rendered distorted. The
 * square logos below are Swiggy's own files, copied into public/brand/swiggy/
 * because their URLs on Swiggy's site are content-hashed and change on every
 * Swiggy deploy.
 *
 * Accessibility per the guidelines: the logo is decorative (alt="") because
 * the live text beside it already says the phrase, so it is read once.
 * Plain inline styles: used in BOTH root layouts, where a class from one
 * tree's stylesheet does not exist in the other.
 */

export type SwiggyService = "food" | "instamart" | "dineout";

const META: Record<SwiggyService, { logo: string; name: string }> = {
  food: { logo: "/brand/swiggy/swiggy-square.jpg", name: "Swiggy" },
  instamart: { logo: "/brand/swiggy/instamart-square.jpg", name: "Instamart" },
  dineout: { logo: "/brand/swiggy/dineout-square.jpg", name: "Dineout" },
};

export function SwiggyAttribution({ service }: { service: SwiggyService }) {
  const { logo, name } = META[service];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: 8,
        borderRadius: 8,
        background: "var(--swiggy-badge-bg)",
        color: "var(--swiggy-badge-ink)",
        font: "400 16px/1.35 var(--m-font-body)",
        whiteSpace: "nowrap",
        flex: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Swiggy's own square artwork at its fixed badge size */}
      <img src={logo} alt="" width={32} height={32} style={{ width: 32, height: 32, borderRadius: "20%", flex: "none" }} />
      <span>
        Powered by <strong style={{ fontWeight: 700 }} translate="no">{name}</strong>
      </span>
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
export function AgentAttribution({ parts }: { parts?: ReadonlyArray<{ type: string; toolName?: string }> }) {
  // AI SDK 7 message parts: a tool call is `tool-<name>` (static tools) or
  // `dynamic-tool` carrying `toolName`.
  const seen: SwiggyService[] = [];
  for (const p of parts ?? []) {
    const name = p.type === "dynamic-tool" ? p.toolName : p.type.startsWith("tool-") ? p.type.slice(5) : null;
    const s = name ? serviceForTool(name) : null;
    if (s && !seen.includes(s)) seen.push(s);
  }
  if (seen.length === 0) return null;
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {seen.map((s) => (
        <SwiggyAttribution key={s} service={s} />
      ))}
    </span>
  );
}
