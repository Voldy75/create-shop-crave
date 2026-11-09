/**
 * Keeping Bo's model calls small. Every step re-sends the tool definitions
 * and the conversation so far, so both are trimmed here:
 *
 *   - compactToolResult: what a Swiggy tool returns to the model. Small
 *     results pass through untouched (orders, payment status, carts — the
 *     approval and payment logic reads those). Big ones — search results
 *     run to 45k characters — lose images and badges, keep at most a handful
 *     of items per list, and drop Swiggy's second copy of the same data
 *     (prose listing + JSON block + structuredContent). Ids the next call
 *     needs (skuId, spinId, restaurant id…) are kept.
 *
 *   - activeToolNames (lib/bo/swiggy-tools.ts) — which tools a step sees.
 *
 * Measured on dev 2026-10-29: 40 tools = 62k characters of definitions per
 * step; Instamart search_products("milk") = 45k characters of result.
 */

import { resultText } from "@/lib/bo/approval";

/** Results at or under this many characters are returned exactly as before. */
const PASS_THROUGH = 4000;
/** Hard ceiling for a compacted result. */
const CEILING = 8000;
/** Keys that only feed Swiggy's own widgets. */
const DROP_KEY = /image|icon|thumbnail|banner|logo|cloudinary|badge|media|maxQuantityMessage/i;

function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}… [trimmed]`;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  return typeof v === "object" && Object.keys(v as object).length === 0;
}

/** Drops widget-only keys and empties; keeps the first `items` of every list. */
export function pruneForModel(v: unknown, items: number): unknown {
  if (Array.isArray(v)) {
    const kept = v.slice(0, items).map((x) => pruneForModel(x, items));
    return v.length > items ? [...kept, `…${v.length - items} more not shown`] : kept;
  }
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (DROP_KEY.test(k)) continue;
      const p = pruneForModel(x, items);
      if (!isEmpty(p)) out[k] = p;
    }
    return out;
  }
  return v;
}

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** What a Swiggy tool call returns to the model (and to the chat's step trace). */
export function compactToolResult(r: unknown): unknown {
  const res = r as { structuredContent?: unknown; content?: unknown };
  const text = resultText(r);
  // Unchanged from before for anything small.
  const full = text || res.structuredContent || res.content;
  const size = typeof full === "string" ? full.length : JSON.stringify(full ?? null).length;
  if (size <= PASS_THROUGH) return full;

  // Swiggy text = model instructions, then often the same data as a JSON block.
  const jsonAt = text.indexOf("\n{");
  const data = res.structuredContent ?? (jsonAt >= 0 ? parseJson(text.slice(jsonAt + 1)) : null);
  if (data === null || data === undefined) return clip(text, CEILING);

  let prose = (jsonAt >= 0 ? text.slice(0, jsonAt) : text).trim();
  // No JSON block in the text: the text is a listing of the structured data
  // itself, so only its opening (instructions, counts) is worth keeping.
  if (jsonAt < 0 && res.structuredContent) prose = clip(prose, 800);
  prose = clip(prose, 1500);

  let json = "";
  for (const items of [10, 6, 3]) {
    json = JSON.stringify(pruneForModel(data, items));
    if (prose.length + json.length <= CEILING) break;
  }
  return clip(prose ? `${prose}\n${json}` : json, CEILING);
}
