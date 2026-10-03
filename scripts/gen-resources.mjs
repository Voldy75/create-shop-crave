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
 * PHASE 10d — this was the last place the retired Midnight Kitchen orange
 * survived. Two things changed together, and they have to stay together:
 *
 *   1. The ground is meshi forest, not orange.
 *   2. The mark is BO, not the letter "C". The product is "meshi" now and its
 *      brand IS the mascot — an icon reading "C" for the old "Crave & Create"
 *      name was wrong independently of the colour.
 *
 * Bo's path data is copied verbatim from components/mascots/BoBowl.tsx so the
 * icon and the in-app mascot cannot drift. Hex literals are correct here on
 * two counts: this is brand art (DESIGN.md exempts mascot artwork), and a
 * standalone node script has no CSS custom properties to resolve anyway. The
 * values are meshi's --m-forest / --m-forest-2 / --m-cream.
 *
 * NOTE: `resources/*.png` are committed build OUTPUT. If you edit this file,
 * re-run it and commit the regenerated PNGs in the same change — leaving the
 * generator and its output disagreeing is worse than either state alone.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("resources", { recursive: true });

const FOREST = "#1E5A34"; // --m-forest
const FOREST_2 = "#14421F"; // --m-forest-2
const CREAM = "#FBF6E3"; // --m-cream
const DARK = "#241C10"; // --m-cream in the dark token pass

/** Bo, from components/mascots/BoBowl.tsx. viewBox is 0 0 64 64. */
const BO = `
  <ellipse cx="32" cy="28" rx="21" ry="13" fill="#FFF6DF" stroke="#7A3E12" stroke-width="4"/>
  <ellipse cx="26" cy="27" rx="2.3" ry="3.2" fill="#7A3E12"/>
  <ellipse cx="38" cy="27" rx="2.3" ry="3.2" fill="#7A3E12"/>
  <path d="M9 36 C9 51 19 58 32 58 C45 58 55 51 55 36 Z" fill="#1E5A34" stroke="#14421F" stroke-width="4" stroke-linejoin="round"/>
  <path d="M15 44 h34" stroke="#3D7A52" stroke-width="3.5" stroke-linecap="round"/>`;

/**
 * Bo on a forest ground reads as green-on-green — his bowl IS forest. The icon
 * therefore sits him on a cream disc, which is also how `.side-bo`/`.tab-bo`
 * present him in the app: a light orb on the deep action colour.
 */
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${FOREST}"/>
  <circle cx="512" cy="512" r="340" fill="${CREAM}"/>
  <g transform="translate(272 272) scale(7.5)">${BO}</g>
</svg>`;

/** Centered mark on a flat surface for the splash (mark ~26% of the canvas). */
function splashSvg(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
    <rect width="2732" height="2732" fill="${bg}"/>
    <rect x="1016" y="1016" width="700" height="700" rx="156" fill="${FOREST}"/>
    <circle cx="1366" cy="1366" r="232" fill="${CREAM}"/>
    <g transform="translate(1180 1180) scale(5.8)">${BO}</g>
  </svg>`;
}

async function png(svg, out, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}

await png(iconSvg, "resources/icon.png", 1024);
await png(splashSvg(CREAM), "resources/splash.png", 2732);
await png(splashSvg(DARK), "resources/splash-dark.png", 2732);
console.log(
  `done — ground ${FOREST} / ${FOREST_2}. Now run \`npm run assets\` after \`npx cap add ios/android\`.`
);
