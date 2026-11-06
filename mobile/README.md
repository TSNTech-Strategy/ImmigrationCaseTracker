# CasePingo mobile app (Expo)

The iPhone and Android app. It uses the website's private API (`docs/MOBILE-API.md`) and the same Supabase sign-in.
v1: personal cases only, no buying in the app (upgrades happen on casepingo.com), English and Spanish, light and dark.

## What's inside

| Screen | File |
|---|---|
| Welcome (English/Español switch, feature cards), sign in, create account, forgot password, two-factor code | `src/app/welcome.tsx`, `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `mfa.tsx` |
| Tabs (system tab bar: floating glass on iOS 26): Cases, Assistant, Bulletin, Resources, Settings | `src/app/(app)/(tabs)/_layout.tsx` |
| My cases: Check all, add, search, filters by kind of status, cards with progress line and "New" badge | `src/app/(app)/(tabs)/cases.tsx`, `src/components/cases.tsx` |
| Add a case (with consent; scan the receipt notice or type the number), case details (progress line, rename, guide, form and office, timelines, congratulations) | `src/app/(app)/cases/` |
| Visa Bulletin: opens the official State Department and USCIS pages in the in-app browser, with a short guide to reading them and the list of categories | `src/app/(app)/(tabs)/bulletin.tsx`, `src/lib/bulletin.ts` |
| Resources: one search over guides, questions and statuses; the status library, processing times, interviews, news and official updates, FAQ, how CasePingo helps, contact (content from `GET /api/v1/resources`) | `src/app/(app)/(tabs)/resources.tsx`, `src/app/(app)/resources/[slug].tsx`, `src/lib/resources.ts` |
| Status library (opened from Resources): searchable list and one screen per status | `src/app/(app)/guide/index.tsx`, `src/app/(app)/guide/[slug].tsx` |
| Assistant tab: chat that streams answers (`expo/fetch`) from `POST /api/v1/assistant`, suggestions, questions left today; "Ask the assistant" on a case asks about that case | `src/app/(app)/(tabs)/assistant.tsx`, `src/lib/assistant.ts` |
| Civics test practice (opened from Resources and the interview guide): 2025 or 2008 test, 65/20, practice by section, mock test with the official pass/fail rules, Listen (`expo-speech`); questions from `GET /api/v1/civics` | `src/app/(app)/civics/index.tsx`, `src/app/(app)/civics/quiz.tsx`, `src/lib/civics.ts`, `src/lib/civics-quiz.ts` |
| Settings: name, language, email and push alerts, plan, sign out, delete account, version | `src/app/(app)/(tabs)/settings.tsx` |

- **Scan a receipt notice** (Add a case, and the empty My cases screen): take a photo of the I-797 notice or choose one, and the receipt number is filled in. Text is read on the phone (`expo-text-extractor`: Apple Vision on iPhone, Google ML Kit on Android; `plugins/with-mlkit-ocr-model.js` has Google Play download the model at install), the number is found by `src/lib/receipt-scan.ts` (tested in the website's suite), and the photo copy is deleted straight after (`src/lib/scan.ts`). Nothing is uploaded. The person still checks the number and confirms consent. Needs a real build (EAS); Expo Go and the web preview don't have the text reader, so the scan buttons are hidden there.
- Sign-in is stored encrypted, with its key in the iPhone keychain or Android Keystore (`src/lib/secure-storage.ts`).
- Push alerts: the app asks permission after sign-in and registers the phone's Expo push token (`src/lib/push.ts`). Tapping an alert opens the case.
- Motion (`src/components/motion.tsx`): screens slide gently into place and feature icons drop in, once; then a highlight walks down the feature cards (`useSpotlight`, only while the screen is showing). With Reduce Motion on, nothing moves and the first card stays lit. Style pieces (tinted icon tiles, feature rows, two-tone titles, language switch) are in `src/components/feature.tsx`.
- Lint with `npm run lint` (Expo's ESLint config in `eslint.config.js`) and typecheck with `npm run typecheck`.
- Icons are SF Symbols on iPhone and Material Symbols on Android (`expo-symbols`). "New" badges are remembered on the phone only (`src/lib/seen.ts`).
- Stays in step with the website (same account, same data on the server): screens reload when opened, when you pull down, and when you come back to the app (`src/lib/use-refresh.ts`; only the screen that's showing, at most every 15 seconds).
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
