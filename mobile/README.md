# CasePingo mobile app (Expo)

The iPhone and Android app. It uses the website's private API (`docs/MOBILE-API.md`) and the same Supabase sign-in.
v1: personal cases only, no buying in the app (upgrades happen on casepingo.com), English and Spanish, light and dark.

## What's inside

| Screen | File |
|---|---|
| Welcome, sign in, create account, forgot password, two-factor code | `src/app/welcome.tsx`, `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `mfa.tsx` |
| My cases, add a case (with consent), case details | `src/app/(app)/cases/` |
| Settings: name, language, email and push alerts, plan, sign out, delete account | `src/app/(app)/settings.tsx` |

- Sign-in is stored encrypted, with its key in the iPhone keychain or Android Keystore (`src/lib/secure-storage.ts`).
- Push alerts: the app asks permission after sign-in and registers the phone's Expo push token (`src/lib/push.ts`). Tapping an alert opens the case.
- No secrets in the app: only public values (`EXPO_PUBLIC_*`).

## Settings

Copy `.env.example` to `.env` for local work. For store builds, add the same three values in **expo.dev → your project → Environment variables** (environments *preview* and *production*):

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://casepingo.com` |
| `EXPO_PUBLIC_SUPABASE_URL` | Same as the website's `NEXT_PUBLIC_SUPABASE_URL` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as the website's `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public by design) |

## Run it on your phone (development)

```bash
cd mobile
npm ci
npx expo start
```
Scan the QR code with the **Expo Go** app (Android) or the Camera (iPhone). Push alerts need a real build (below), not Expo Go.

## Test build on your phone (EAS)

```bash
npm install -g eas-cli
eas login                 # the Expo account for TSN TECH & STRATEGY NETWORK LLC
cd mobile && eas init     # creates the project and fills in extra.eas.projectId
eas build --profile preview --platform android   # installable APK link
eas build --profile preview --platform ios       # needs your Apple Developer account; register your iPhone when asked
```
EAS sets up the Apple push key and Android signing for you when asked. For Android push, upload a Firebase (FCM v1) service-account key in expo.dev → Credentials.

Store submission (screenshots, listing text, privacy labels, review notes) is Step 9C.
