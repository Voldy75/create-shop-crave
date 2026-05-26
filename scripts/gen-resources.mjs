/**
 * Generate the source images that @capacitor/assets expands into every iOS /
 * Android icon + splash size. Run: `node scripts/gen-resources.mjs` then
 * `npm run assets` (capacitor-assets generate) once `npx cap add ios/android`
 * has created the native projects.
 *
 * Outputs (per @capacitor/assets conventions):
 *   resources/icon.png         1024×1024  full-bleed app icon
 *   resources/splash.png       2732×2732  light splash
 *   resources/splash-dark.png  2732×2732  dark splash
 *
 * Brand: accent #ff6b35, dark surface #0f0f0f — matches the --cc-* tokens and
 * the PWA manifest (public/manifest.json).
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("resources", { recursive: true });

const ACCENT = "#ff6b35";
const DARK = "#0f0f0f";

// Full-bleed icon — stores apply their own corner masking, so no rounded rect.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${ACCENT}"/>
  <text x="512" y="700" font-family="-apple-system,BlinkMacSystemFont,Helvetica,sans-serif" font-weight="700" font-size="620" text-anchor="middle" fill="white">C</text>
</svg>`;

// Centered logo on a flat surface for the splash (logo ~26% of the canvas).
function splashSvg(bg, mark) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
    <rect width="2732" height="2732" fill="${bg}"/>
    <rect x="1016" y="1016" width="700" height="700" rx="156" fill="${ACCENT}"/>
    <text x="1366" y="1560" font-family="-apple-system,BlinkMacSystemFont,Helvetica,sans-serif" font-weight="700" font-size="430" text-anchor="middle" fill="${mark}">C</text>
  </svg>`;
}

async function png(svg, out, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}

await png(iconSvg, "resources/icon.png", 1024);
await png(splashSvg("#ffffff", "#ffffff"), "resources/splash.png", 2732);
await png(splashSvg(DARK, "#ffffff"), "resources/splash-dark.png", 2732);
console.log("done — now run `npm run assets` after `npx cap add ios/android`.");
