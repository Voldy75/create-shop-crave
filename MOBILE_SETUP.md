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
  - [ ] Create a new Vercel project for THIS repo; copy env from the web project
  - [ ] Set `capacitor.config.ts` `server.url` to the new Vercel URL
- [ ] M2: build the 28 designed mobile screens (Food-Kuu handoff), wire to backend
- [ ] M3: native bridge (push/camera/share/geo) + OAuth deep-links
- [ ] M4: N1 features + store assets + submission

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
