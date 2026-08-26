# Crave & Create — native (iOS / Android) checklist

Everything standing between this branch and a shipped binary, in the order it
should be done. Ordering is not cosmetic: item 1 is irreversible if skipped,
and item 2 has the longest external lead time.

**Architecture:** Capacitor in **remote-URL mode** — the native shell loads the
deployed Next.js app rather than bundling static assets. Web changes ship
without a store re-review. The flip side is that the app is only ever as good
as whatever the pinned URL serves, which is why item 1 matters so much.

> This file used to describe a separate mobile repo with its own Vercel
> project. That world is gone — the repos are merged and `app/(mobile)` is the
> `/m` route group in this one. Its brand-asset section was also still
> describing the retired orange palette. Both are corrected below.

---

## 1. Pin the Vercel alias — do this FIRST

`capacitor.config.ts` currently defaults to
`https://create-shop-crave-mobile.vercel.app/m`, an alias that **auto-advances
to whatever deployed last**.

That URL is compiled into every binary permanently. In remote-URL mode the app
fetches its entire frontend from it at runtime, so with an auto-advancing alias
**any bad web deploy instantly bricks every installed app**, and there is no
store rollback for content the binary fetches at runtime. With a pinned alias
the same incident is a 30-second re-point.

Free today. **Impossible after the first binary ships** — old installs keep
requesting whatever URL was baked in.

- [ ] Add a dedicated alias on the `create-shop-crave` Vercel project
      (e.g. `m.cravecreate.app`)
- [ ] Promote deployments to it **deliberately**, never automatically
- [ ] Set `CAP_PROD_URL` to it, keeping the `/m` suffix
- [ ] Confirm before `cap add`: `node -e "console.log(require('./capacitor.config.ts'))"`
      won't work on a TS file — just read the resolved value in the file and
      check it is not the auto-advancing alias

---

## 2. Developer accounts — start now, they gate everything downstream

Neither is instant; Apple's identity verification can take days. Nothing else
in this list waits on them, so begin while you work through items 3–5.

- [ ] **Apple Developer Program** — bundle id `com.cravecreate.app`
- [ ] **Google Play Console**

(Fees apply to both — Apple is an annual membership, Play a one-time
registration. Check current pricing at signup rather than trusting a number
written here.)

---

## 3. Dashboard config — code is already written, it just fails silently

These are all implemented and will simply not work until someone clicks
something in a console.

- [ ] **Supabase → Auth → URL Configuration**, add
      `com.cravecreate.app://auth/callback`
      **Highest-risk item in the whole project.** Native sign-in has never
      completed once. Costs a minute; if skipped it surfaces at TestFlight,
      after the IAP work, when it is most expensive to debug. See
      `lib/native-auth.ts`.
- [ ] **`FIREBASE_SERVICE_ACCOUNT`** env var (single-line service-account JSON)
      — native push sends via FCM HTTP v1 (`lib/native-push.ts`)
- [ ] **APNs auth key uploaded to the Firebase console** — this is what lets
      Firebase proxy to APNs for iOS
- [ ] **`google-services.json`** dropped into the generated Android project
- [ ] **A mobile-restricted Google Maps key.** The current key is
      HTTP-referrer-restricted to the web domain, so the map silently falls
      back on mobile. Needs a bundle-id / package-name restricted key.

---

## 4. Local toolchain

Current state on this machine, checked:

| | Status |
|---|---|
| Xcode 26.6 | ✅ installed, `xcode-select` points at it |
| CocoaPods | ✅ **installed** (`brew install cocoapods` → 1.17.0) |
| `@capacitor/ios` | ✅ **installed** (`^7.6.8`, committed) — `npx cap add ios` needs it |
| iOS project | ✅ **generated locally as a DEV build** and run in the Simulator — see the note below |
| Java runtime | ✅ **JDK 17 AND JDK 21 installed** (`brew install openjdk@17 openjdk@21`). **JDK 21 is required** — Capacitor 7 plugins declare a Java-21 toolchain, so a JDK-17-only build fails at `:capacitor-geolocation:compileDebugJavaWithJavac`. Run Gradle with `JAVA_HOME=/opt/homebrew/opt/openjdk@21`. |
| Android SDK | ✅ **installed** at `~/Library/Android/sdk` (`brew install --cask android-commandlinetools`; then `sdkmanager platform-tools "platforms;android-35" "build-tools;35.0.0"`, licenses accepted). `ANDROID_HOME` is NOT persisted in the shell profile — export it per-command (see below). |
| `@capacitor/android` | ✅ **installed and committed** (`^7.6.8`, pinned to match `@capacitor/ios`). Adds no transitive dependencies, so `npm audit` stayed at 14. |
| Android project | ✅ **generated locally as a DEV build; debug APK builds cleanly** (`./gradlew assembleDebug`). Not yet run in an emulator/device. |

Both platforms build locally. Neither has been set up for *distribution* (that
needs item 1 + item 2). What's left for Android is only running it visually —
an emulator (system image + AVD) or a physical device.

**iOS simulator smoke test — already done, and what it did NOT prove.** A dev
build was generated and launched on an iPhone 17 Pro simulator, loading this
branch's `/m` from a local `next dev` server. This proved the shell launches
and renders the app; it did **not** exercise native sign-in (needs the Supabase
redirect from item 3), payments (BYOK-only on native by design), push (needs
FCM config), or the real production URL.

**Crucial: `ios/` is git-ignored and is a THROWAWAY dev artifact.** The
generated project bakes in `http://localhost:3000/m` as its server URL (via
`CAP_SERVER_URL`) plus a dev-only `NSAllowsLocalNetworking` ATS exception in
`ios/App/App/Info.plist`. It must be **regenerated against the pinned
production alias (item 1) before any distributable build** — do not reuse this
one for TestFlight. To reproduce the simulator run:

```bash
brew install cocoapods                      # once (done)
export CAP_SERVER_URL="http://localhost:3000/m"
npx cap add ios                             # regenerates ios/ (dev URL baked in)
npm run assets                              # after cap add
# re-add the localhost ATS exception to ios/App/App/Info.plist (cap add overwrites it)
PORT=3000 npm run dev                       # serve /m locally
# then build the App scheme for a booted simulator and launch App.app
```

**Android was set up from scratch this session and the debug APK builds.**
`android/` is the same kind of git-ignored DEV throwaway as `ios/`: it bakes in
`http://10.0.2.2:3000/m` (the emulator's alias for the host's localhost) and a
dev-only cleartext allowance in `android/app/src/main/res/xml/network_security_config.xml`
(referenced from `AndroidManifest.xml`). Regenerate against the pinned alias for
any distributable build. To reproduce the build:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21          # 21, NOT 17 — see table
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export CAP_SERVER_URL="http://10.0.2.2:3000/m"         # emulator → host localhost
npx cap add android                                    # regenerates android/
# re-add the cleartext network-security config + its manifest reference (cap add overwrites)
cd android && ./gradlew assembleDebug                  # → app/build/outputs/apk/debug/app-debug.apk
```

To run it visually (not yet done): an emulator needs
`sdkmanager "emulator" "system-images;android-35;google_apis;arm64-v8a"` + an
AVD, then `adb install`; a physical device needs USB debugging + `adb reverse
tcp:3000 tcp:3000` (and rebuild with `CAP_SERVER_URL=http://localhost:3000/m`).

- [x] `brew install cocoapods`
- [x] Install a JDK — **both 17 and 21** (`brew install openjdk@17 openjdk@21`; JDK 21 is required by Capacitor 7 plugins)
- [x] Android SDK installed via `android-commandlinetools` + `sdkmanager` (no Android Studio needed to build)
- [ ] Export `ANDROID_HOME` / `ANDROID_SDK_ROOT` **in your shell profile** (currently set per-command only)

Then, for a **distributable** build **after item 1 is done** (regenerate — the
committed state has no `ios/` or `android/`, and any local one is the dev
throwaway above):

```bash
export CAP_PROD_URL="https://<your-pinned-alias>/m"   # NOT localhost
npx cap add ios
npx cap add android
npx cap sync
```

For live-reload against a dev server (does not affect the shipped URL):

```bash
export CAP_SERVER_URL="http://<LAN-ip>:3000/m"
npx cap sync
```

---

## 5. Icons & splash

```bash
npm run gen:resources   # regenerates resources/{icon,splash,splash-dark}.png
npm run assets          # expands them into every iOS/Android size
                        # (run AFTER `npx cap add`)
```

`resources/*.png` are **build output** — never edit `scripts/gen-resources.mjs`
without re-running `gen:resources`, or source and output disagree.

Current values (Phase 10d retired the old orange `#ff6b35` "C" mark entirely):

- `icon.png` — 1024×1024, forest `#1E5A34` ground, cream disc, **Bo** as the
  mark, with path data copied verbatim from `components/mascots/BoBowl.tsx` so
  the icon and the in-app mascot cannot drift
- `splash.png` / `splash-dark.png` — 2732×2732, cream `#FBF6E3` / dark `#241C10`

`npm run assets` invokes `@capacitor/assets` via `npx` and **it must stay that
way**. It was removed as a dependency because it bundles a stale
`@capacitor/cli@5.7.8` carrying the only CRITICAL advisory in the tree, with no
upstream fix available. Reinstating it as a dependency brings the critical back.
Nothing to install first; npx fetches it.

---

## 6. In-app purchases — genuinely not built

Worth being precise, because "RevenueCat for IAP" undersells this:
`@revenuecat/purchases-capacitor` **is not installed**. In `lib/billing.ts`,
`purchaseStoreProduct` is a `TODO` that unconditionally returns
`"unavailable"`, and `restorePurchases` is a deliberate no-op.

**This is compliant, not broken.** `canPurchase` returns false on native, so
the paywall collapses to the free BYOK path rather than showing a dead purchase
button. The app ships and works — it just cannot sell anything on mobile. Do
this last; it is the only item here that is not on the critical path.

- [ ] RevenueCat account
- [ ] Products in App Store Connect **and** Play Console
- [ ] `npm i @revenuecat/purchases-capacitor`
- [ ] Wire `purchaseStoreProduct` + `restorePurchases` in `lib/billing.ts`
- [ ] Restore Purchases is **mandatory on iOS** for anything selling a
      subscription — a Restore control with no handler was already one of the
      three App Store rejection risks found and fixed in the paywall

---

## 7. Two review risks to decide on before submitting

**Sign in with Apple becomes mandatory if Google sign-in stays.** App Store
Guideline 4.8 triggers on offering a third-party login. This is real work, not
a checkbox: `OAuthProvider` in `lib/native-auth.ts` is typed
`"google" | "github"`, there is no Apple Services ID registered in Supabase,
and the same `com.cravecreate.app://auth/callback` redirect from item 3 is
required. This is exactly why the artboard's "Continue with Apple" button was
deliberately left unbuilt rather than shipped as a dead control.

- [ ] Decide: add Sign in with Apple, or drop third-party login on iOS

**Guideline 4.2, minimum functionality.** Thin WebView wrappers get rejected.
The app is reasonably positioned — real native camera, push, geolocation and
share — but remote-URL mode is the shape reviewers scrutinise.

- [ ] Review notes should **lead with** native push (daily nudge), camera
      (meal logging) and the AI features

---

## 8. Store submission

**Both stores**

- [ ] Privacy policy URL + data-safety disclosures: **camera** (meal photos),
      **notifications** (push), **location** (nearby restaurants), **account**
      (auth), plus food and payment data handling
- [ ] Category Food & Drink, age-rating questionnaire
- [ ] Decide the product name first — it is currently **split**: the mobile
      layout titles itself "meshi — Crave & Create", `public/manifest.json` and
      the web layout say "Crave & Create", and the design system is "meshi"
      throughout. The Razorpay descriptor deliberately names both (a statement
      line reading only "meshi" is an unrecognised descriptor and a chargeback
      risk). A real rename is a product call.

**iOS (App Store Connect)**

- [ ] `npx cap open ios` → signing team → Archive → TestFlight
- [ ] Screenshots (6.7" + 5.5"), promo text, keywords

**Android (Play Console)**

- [ ] `npx cap open android` → Generate Signed Bundle (`.aab`)
- [ ] Internal testing track → promote to Production
- [ ] Feature graphic (1024×500), screenshots, full description

---

## Note on Phase 5

All of the above sits downstream of the production cutover. In remote-URL mode
the binary serves the deployed web app, so the missing Vercel env vars
(`ADMIN_EMAIL`, `RAZORPAY_*`, `STRIPE_*`, `SWIGGY_CLIENT_ID`,
`NEXT_PUBLIC_SITE_URL`) affect mobile exactly as much as web. See the
"Blocked on you" section of `handoff.md`.
