/**
 * Reduce an MCP tool's JSON Schema to what every model provider accepts.
 *
 * WHY (found 2026-10-24, the first real Swiggy agent run returned 500): Gemini's
 * function declarations take an OpenAPI-3.0 subset, and Swiggy's live tools use
 * JSON Schema features outside it. Reproduced against gemini-2.5-flash with
 * Swiggy's own tools/list output:
 *   - `type: ["string","number"]` (update_food_cart) → "Proto field is not
 *     repeating, cannot start list"
 *   - a top-level `anyOf: [{required:[addressId]}, {required:[latitude,
 *     longitude]}]` (search_restaurants, search_menu, get_restaurant_menu) →
 *     "any_of[0].required: only allowed for OBJECT type"
 * Either one rejects the WHOLE request, so no Swiggy tool worked at all.
 *
 * This keeps only a conservative, widely supported keyword set and folds what
 * it drops into the description, so the model still knows the rule. It only
 * shapes what the MODEL sees — Swiggy validates the real arguments server-side,
 * so loosening the hint cannot let a bad call through.
 */

type Json = Record<string, unknown>;

const KEEP = new Set([
  "type",
  "description",
  "enum",
  "properties",
  "required",
  "items",
  "nullable",
  "format",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
]);

/** "a" for ["a"]; for a union, prefer string (any value can be sent as one). */
function singleType(t: unknown): { type?: string; nullable?: boolean } {
  if (typeof t === "string") return { type: t };
  if (!Array.isArray(t)) return {};
  const types = t.filter((x): x is string => typeof x === "string");
  const nullable = types.includes("null");
  const rest = types.filter((x) => x !== "null");
  if (rest.length === 0) return { nullable };
  const type = rest.length === 1 ? rest[0] : rest.includes("string") ? "string" : rest[0];
  return nullable ? { type, nullable } : { type };
}

/** Human-readable form of a requirement-only anyOf/oneOf, e.g. "addressId, or latitude + longitude". */
function describeAlternatives(branches: unknown): string | null {
  if (!Array.isArray(branches)) return null;
  const parts = branches
    .map((b) => (b && typeof b === "object" && Array.isArray((b as Json).required) ? ((b as Json).required as string[]).join(" + ") : null))
    .filter((x): x is string => !!x);
  return parts.length ? `Provide one of: ${parts.join(", or ")}.` : null;
}

export function sanitizeToolSchema(schema: unknown, depth = 0): Json {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { type: "object", properties: {} };
  const src = schema as Json;
  const out: Json = {};
  const notes: string[] = [];

  for (const [k, v] of Object.entries(src)) {
    if (!KEEP.has(k)) continue;
    if (k === "type") Object.assign(out, singleType(v));
    else if (k === "properties" && v && typeof v === "object") {
      const props: Json = {};
      for (const [name, sub] of Object.entries(v as Json)) props[name] = sanitizeToolSchema(sub, depth + 1);
      out.properties = props;
    } else if (k === "items") out.items = sanitizeToolSchema(v, depth + 1);
    else out[k] = v;
  }

  // Combinators: a requirement-only anyOf/oneOf becomes a sentence; a union of
  // value schemas collapses to the first branch's type.
  for (const comb of ["anyOf", "oneOf"] as const) {
    if (!(comb in src)) continue;
    const alt = describeAlternatives(src[comb]);
    if (alt) notes.push(alt);
    else if (!out.type && Array.isArray(src[comb]) && (src[comb] as unknown[]).length) {
      Object.assign(out, sanitizeToolSchema((src[comb] as unknown[])[0], depth + 1));
    }
  }
  if (typeof src.pattern === "string") notes.push(`Format: ${src.pattern}`);

  // Objects need a properties map; required may only name declared properties.
  if (out.type === "object" || out.properties) {
    out.type = "object";
    out.properties = (out.properties as Json) ?? {};
    if (Array.isArray(out.required)) {
      const declared = new Set(Object.keys(out.properties as Json));
      const req = (out.required as unknown[]).filter((r): r is string => typeof r === "string" && declared.has(r));
      if (req.length) out.required = req;
      else delete out.required;
    }
  }
  if (!out.type && depth > 0) out.type = "string";

  if (notes.length) {
    const base = typeof out.description === "string" ? out.description : "";
    out.description = [base, ...notes].filter(Boolean).join(" ");
  }
  return out;
}
