#!/usr/bin/env node
/**
 * DESIGN.md's hex/rgba gate: "CI should fail on new #rrggbb / rgba() literals
 * in app/** and components/**, with an allowlist for the cases already
 * enumerated in DESIGN.md."
 *
 * **The baseline is currently EMPTY, so this is a hard gate**: every literal
 * in app/** and components/** is either a --m-* token or carries an explicit
 * inline marker. Keep it that way.
 *
 * Two mechanisms:
 *
 *   1. GENUINE, PERMANENT exceptions (Razorpay's iframe theme, Google Maps
 *      style JSON, partner brand colours, mascot art, SVG data-URIs) — these
 *      need a literal forever, not because anyone forgot to convert them.
 *      Mark these inline; see MARKERS below.
 *
 *   2. scripts/hex-baseline.json is a RATCHET for temporary debt, kept for
 *      the case where a large refactor genuinely has to land mid-conversion.
 *      It reached zero when the admin console, settings, favorites and arena
 *      were converted; a non-empty baseline is now a regression, not a
 *      normal state. It must only ever shrink — running --write-baseline to
 *      silence a new violation defeats the entire point of this script.
 *
 * Usage:
 *   node scripts/check-hex.mjs                 — fail on any new violation
 *   node scripts/check-hex.mjs --write-baseline — regenerate the baseline
 *   node scripts/check-hex.mjs --report         — print every current
 *                                                  violation (baseline + new),
 *                                                  exit 0 regardless
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { globSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const BASELINE_PATH = path.join(ROOT, "scripts", "hex-baseline.json");

const SCAN_DIRS = ["app", "components"];
const EXT = new Set([".ts", ".tsx"]);

// Entire directories that are hex-by-nature and never scanned at all.
const EXEMPT_PATH_PREFIXES = ["components/mascots/"];

// A literal #rrggbb or rgba()/rgb() — the same shape DESIGN.md's exit
// criterion names. Deliberately not matching CSS variable names like --m-red.
const HEX_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

const START_MARKER = /hex-ok-start/;
const END_MARKER = /hex-ok-end/;
const LINE_MARKER = /hex-ok\b(?!-start|-end)/; // "hex-ok" but not the block variants

function walk(dir) {
  const pattern = path.join(ROOT, dir, "**/*.{ts,tsx}");
  return globSync(pattern, { cwd: ROOT }).map((p) => path.relative(ROOT, p));
}

function isExempt(relPath) {
  return EXEMPT_PATH_PREFIXES.some((p) => relPath.startsWith(p));
}

/** Every hex/rgba hit in the tree, minus path-exempt dirs and inline markers. */
function scan() {
  const hits = [];
  for (const dir of SCAN_DIRS) {
    for (const rel of walk(dir)) {
      if (isExempt(rel)) continue;
      const text = readFileSync(path.join(ROOT, rel), "utf8");
      const lines = text.split("\n");
      let inBlock = false;
      lines.forEach((line, i) => {
        if (START_MARKER.test(line)) inBlock = true;
        if (END_MARKER.test(line)) {
          inBlock = false;
          return;
        }
        if (inBlock || LINE_MARKER.test(line)) return;
        const matches = line.match(HEX_RE);
        if (matches) {
          hits.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 140) });
        }
      });
    }
  }
  return hits;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set();
  const arr = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  return new Set(arr);
}

function key(hit) {
  return `${hit.file}:${hit.line}`;
}

const mode = process.argv.includes("--write-baseline")
  ? "write"
  : process.argv.includes("--report")
    ? "report"
    : "check";

const hits = scan();

if (mode === "write") {
  const keys = hits.map(key).sort();
  writeFileSync(BASELINE_PATH, JSON.stringify(keys, null, 2) + "\n");
  console.log(`Wrote ${keys.length} entries to scripts/hex-baseline.json`);
  process.exit(0);
}

if (mode === "report") {
  for (const h of hits) console.log(`${h.file}:${h.line}  ${h.snippet}`);
  console.log(`\n${hits.length} total hardcoded hex/rgba literals in app/** and components/**.`);
  process.exit(0);
}

// mode === "check"
const baseline = loadBaseline();
const fresh = hits.filter((h) => !baseline.has(key(h)));

if (fresh.length > 0) {
  console.error(
    `\n✗ ${fresh.length} new hardcoded hex/rgba literal(s) in app/** or components/**:\n`
  );
  for (const h of fresh) {
    console.error(`  ${h.file}:${h.line}`);
    console.error(`    ${h.snippet}\n`);
  }
  console.error(
    "DESIGN.md bans hardcoded hex/rgba outside its allowlist (mascot art, Razorpay's\n" +
    "theme.color, Google Maps style JSON, partner brand colours, SVG data-URIs).\n" +
    "Use a design/meshi-b.css --m-* token instead.\n\n" +
    "If this really is one of those allowlisted cases, mark it inline rather than\n" +
    "growing the baseline:\n" +
    '  - one line:        // hex-ok: <why>\n' +
    "  - a block/array:   // hex-ok-start ... // hex-ok-end\n\n" +
    "scripts/hex-baseline.json is currently EMPTY and should stay that way.\n" +
    "Do NOT run --write-baseline to silence this; that defeats the gate."
  );
  process.exit(1);
}

console.log(
  hits.length === 0
    ? "✓ No hardcoded hex/rgba literals in app/** or components/** outside the inline allowlist."
    : `✓ No NEW hardcoded hex/rgba literals (${hits.length} still in the baseline — that number should only go down).`
);
