# Crave & Create — Mobile (Capacitor) setup

This repo is the **mobile build** of Crave & Create. It's a copy of the web app
(full git history preserved) plus a Capacitor native shell. The original
`create-shop-crave` repo is untouched.

Build path (decided): **Capacitor + mobile-web frontend.** The native iOS/Android
shells load the deployed Next.js app (remote-URL mode); we build mobile-optimized
screens here and wrap them. Backend, Supabase, and all integrations are shared
with the web app unchanged.

## Status

- [x] M1: repo seeded, Capacitor 7 installed, config + native-bridge skeleton
- [ ] M1 remaining (needs your machine — native toolchains):
  - [ ] `npx cap add ios` (needs Xcode + CocoaPods)
  - [ ] `npx cap add android` (needs Android Studio + SDK)
  - [x] Created a new Vercel project for THIS repo; env copied from the web project
  - [x] Set `capacitor.config.ts` `server.url` to the new Vercel URL
- [x] M2: built the meshi mobile screens, wired to backend
- [x] M3 (code): native bridge (push/camera/share/geo) + OAuth deep-link handler
  - [ ] M3 remaining (your machine): `cap add`; register `com.cravecreate.app://`
        redirect with Supabase Auth + Swiggy; set `FIREBASE_SERVICE_ACCOUNT` for
        native push delivery
- [x] M4 (code): N1 features (streaks, 1-tap reorder, inbox push filter) + asset sources
  - [ ] M4 remaining (your machine): generate native assets + store submission (below)

## One-time setup on your machine

```bash
# 1. Add native platforms (run where Xcode / Android Studio are installed)
npx cap add ios
npx cap add android

# 2. Pull shared env into a new Vercel project, then locally:
#    cp the web project's env (Supabase, GOOGLE_AI_API_KEY, TWILIO_*, VAPID_*,
#    CRON_SECRET, SWIGGY_CLIENT_ID) into this project's Vercel env + .env.local

# 3. Point the shell at your deployment (or a LAN dev server for live reload)
export CAP_SERVER_URL="https://<this-repo>.vercel.app"   # or http://<LAN-ip>:3000
npx cap sync

# 4. Run on a simulator/emulator
npx cap run ios
npx cap run android
```

## Env vars (shared with the web project)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_AI_API_KEY
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM / TWILIO_SANDBOX_JOIN_CODE
NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
CRON_SECRET
SWIGGY_CLIENT_ID            # "swiggy-mcp" for dev (DCR), real client_id for prod
NEXT_PUBLIC_SITE_URL        # this repo's canonical origin
```

## Native value wired (carries App Store Guideline 4.2)

- Push notifications (APNs/FCM) — the daily diet nudge
- Camera — meal-photo logging → `/api/meals/analyze`
- Share, Geolocation, deep-link OAuth return (`com.cravecreate.app://`)

See `lib/native-bridge.ts` for the runtime-detection seam.

## App icons & splash screens

Source images live in `resources/` (generated from the brand SVG):

```bash
npm run gen:resources   # regenerates resources/{icon,splash,splash-dark}.png
npm run assets          # capacitor-assets expands them into every iOS/Android size
                        # (run AFTER `npx cap add ios/android`)
```

`resources/icon.png` is 1024×1024 full-bleed (#ff6b35 "C"); splashes are 2732×2732
(white / #0f0f0f). Drop in real brand art over these files and re-run `npm run assets`
to override. The PWA manifest (`public/manifest.json`) already carries 192/512 icons.

## Store submission checklist (M4 — your machine + developer accounts)

**Both stores**
- [ ] `npm run gen:resources && npm run assets` to produce native icon/splash sets
- [ ] Privacy policy URL + data-safety disclosures: declare **camera** (meal photos),
      **notifications** (push), **location** (nearby restaurants), **account** (auth),
      and food/payment data handling
- [ ] App name "Crave & Create", category Food & Drink, age rating questionnaire

**iOS (App Store Connect)**
- [ ] Apple Developer membership ($99/yr); bundle id `com.cravecreate.app`
- [ ] Add APNs auth key in Firebase console (enables native push via FCM→APNs)
- [ ] `npx cap open ios` → set signing team → Archive → upload to TestFlight
- [ ] **Review notes: lead with native push (daily nudge) + camera (meal logging) +
      AI features** to pre-empt Guideline 4.2 (minimum-functionality) rejection
- [ ] Screenshots (6.7" + 5.5"), promo text, keywords

**Android (Play Console)**
- [ ] Play Console account ($25 one-time)
- [ ] `npx cap open android` → Build → Generate Signed Bundle (`.aab`)
- [ ] Upload to Internal testing track → promote to Production
- [ ] Feature graphic (1024×500), screenshots, full description
