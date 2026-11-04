# ImmigrationCaseTracker — Build Plan

**Based on:** *Master Development Guide v2.0* (Nov 4, 2026), adapted to Scanvio's backend pattern
**Owner:** TSN TECH & STRATEGY NETWORK LLC
**Updated:** Nov 4, 2026

The product scope, USCIS rules and security requirements come from the guide. The **architecture follows Scanvio**: one Next.js app on Vercel, Prisma on Supabase Postgres, server-only environment variables for credentials, Inngest for background jobs, and a mock mode for the external API.

---

## 1. Decisions

| Area | Decision |
|---|---|
| App | One Next.js 16 app at the repo root: public site, consumer area, `/firm/*`, and `/api/*` routes (including the mobile API) |
| Database | Prisma 6 + PostgreSQL on a **new** Supabase project, for local dev and production alike (no Docker). Pooled `DATABASE_URL` plus session `DIRECT_URL`. Migrations run on deploy, as in Scanvio |
| Credentials | **Server-only environment variables** (`.env` locally, Vercel env in production), read only in server code, as in Scanvio. Per-user sensitive data (receipt numbers) is stored **encrypted** in Supabase (AES-256-GCM, `ENCRYPTION_KEY`) |
| USCIS | `src/lib/uscis`: OAuth client-credentials, in-memory token cache, `mock` / `sandbox` / `production` modes, mock refused on production (`VERCEL_ENV`) |
| Auth | **Supabase Auth** (email + password, email confirmation, reset, MFA later). Mobile signs in with Supabase and sends a Bearer token |
| Authorization | Checked on every server entrypoint (page, action, route), with an owner-or-firm-membership check on every case query |
| Jobs | Inngest: scheduled polling with throttle under USCIS limits, retries and idempotent notifications |
| Email | SMTP (console driver in dev), as in Scanvio |
| Mobile | Expo app in `mobile/`, calling the same API (later milestone) |
| Billing | Stripe (later milestone) |
| Hosting | **New** Vercel project + **new** Supabase project. Nothing shared with Scanvio |
| Out of scope | Document uploads, deadline calendars, legal advice, an "AI attorney" |

---

## 2. The five-day sandbox clock

USCIS requires at least 5 consecutive calendar days of sandbox traffic **from our application**, covering 200 and 4xx responses, before you can request production access.

- `npm run uscis:smoke` runs on **your computer** once a day, with sandbox credentials in a local `.env`. It calls USCIS through the same adapter the app uses and appends sanitized evidence to `docs/uscis-evidence/YYYY-MM.jsonl`. Commit that file.
- Once the app is deployed (Step 6), the daily polling job and real use of the app also generate traffic.
- A missed day restarts the sequence. Never back-fill the log.

---

## 3. Steps

Each step is small enough to review on its own before the next one starts.

### Step 1 — Foundation + USCIS adapter ✅
- Next.js 16 app, TypeScript, Tailwind 4, ESLint, Vitest.
- `src/lib/uscis`: config, token cache, client with error classification and retries, normalizer, mock.
- `src/lib/receipt.ts` (validate, normalize, mask) and `src/lib/crypto.ts` (encrypt, decrypt, keyed digest).
- 40 unit tests driven by fake USCIS responses.
- `npm run uscis:smoke` plus the evidence log.

### Step 2 — Database schema ✅
- Prisma schema and first migration: `User`, `Firm`, `FirmMembership`, `Client`, `TrackedCase` (owned by a user **or** a firm, with encrypted receipt and digest), `CaseConsent`, `CaseStatusEvent`, `CaseCheckRun`, `AuditLog`, `DeletionRequest`, `NotificationPreference`.
- Database is the dedicated ICT Supabase project (no Docker or local Postgres). Seed data uses staging receipts only.
- DB-enforced rules: one owner per case, client must belong to the case's firm, per-owner receipt uniqueness, RLS on and Supabase API roles revoked. Covered by DB tests.

### Step 3 — Accounts and login (Supabase Auth) ✅
- Supabase Auth: sign-up with email confirmation, sign-in, forgot/reset password, sign-out.
- `User.id` = Supabase auth user id; profile created on first sign-in.
- `src/proxy.ts` refreshes sessions and guards `/cases`, `/settings`, `/firm`, `/admin`; every page/action/API re-checks with `getClaims()`.
- `/api/v1/me` accepts the web session or a Bearer token (mobile app).
- Dashboard setup: `docs/SUPABASE-AUTH-SETUP.md`. MFA (two-factor) is added with Settings in Step 5.

### Step 4 — Consumer case tracking ✅
- Add a case behind a consent statement (own case / authorized by the applicant, versioned wording). Receipt validated, encrypted, duplicate-checked by digest; first USCIS check runs immediately.
- Case list and detail: current status (EN/ES), **last checked** vs **last change observed**, our observed timeline, USCIS-reported history, consent record. Times shown in the viewer's time zone.
- Refresh now: 10-minute cooldown claimed atomically (double-clicks can't double-call USCIS), 30 manual refreshes/user/day, global `USCIS_DAILY_BUDGET` (default 800/day).
- Sandbox mode only ever sends USCIS's published sample receipts. Mock mode banner / sandbox banner.
- Remove case (with confirmation) + audit log entries.
- Tests: user isolation (list/read/refresh/remove), cooldown race, consent, budget, sandbox guard, change detection, failure backoff — against a real database; plus a browser click-through.

### Step 5 — Public pages + settings ✅
- Public site (static): home, How it works, Pricing ("coming soon" for paid plans), Privacy Policy, Terms of Service, Accessibility statement. Legal pages carry a "Draft for legal review" notice and cover the USCIS affidavit topics: readable policy, deletion, data sharing/subprocessors, breach notification, change of ownership, contact.
- Settings: profile + status language (EN/ES), email-alert preference, password change, **two-factor sign-in (TOTP)** with QR set-up, and self-service **account deletion** (recorded in DeletionRequest).
- Two-factor is enforced from our database flag (`User.mfaEnrolledAt`) on every page, action and API call — not from the client-editable cookie. Sign-in sends two-factor users straight to `/login/mfa`.
- Tested end to end (stand-in auth server): QR set-up, wrong codes rejected, pages/API blocked until the code is entered (HTTP 307 / 401), turn off, password change, account deletion.

### Step 6 — Background polling, alerts and first deploy
- Inngest scheduled function: eligible cases (active consent, not checked recently), throttled under the USCIS rate limit, global daily budget, circuit breaker, check-run log, change detection, events.
- Email alerts on change (SMTP), idempotent.
- **Create the new Vercel project** (pointing at the ICT Supabase project) and deploy. Migrations run on build.

### Step 7 — Law firm workspace
- Firms, memberships (owner/admin/staff), invitations with revocation, clients, consent evidence.
- `/firm`, `/firm/clients`, `/firm/cases` (filters + CSV import with dry run), `/firm/team`, `/firm/audit`.
- Cross-firm isolation tests and an audit log entry for every change.

### Step 8 — Billing + admin
- Stripe Checkout/Billing, signed idempotent webhooks, entitlements (Free 1 case / Premium / Firm Starter 100 cases).
- `/admin`: sanitized job metrics, failed syncs, deletion requests (as in Scanvio's `ADMIN_EMAILS`).

### Step 9 — Mobile (Expo)
- Onboarding → login → consent → cases → add receipt → status and timeline → settings and deletion. Push notifications.

### Step 10 — Production readiness and USCIS approval
- Counsel-reviewed policies, accessibility statement, incident and deletion runbooks.
- Email `developersupport@uscis.dhs.gov` once the 5-day evidence is real. Then the affidavit, the `USCIS_DEMO_ID` header (already supported) and the technical demo. Slots currently open **Feb 2027**.
- Switch `USCIS_ENV=production` with the USCIS-issued URL and keys **only after approval**.

---

## 4. What we need from you

| When | What |
|---|---|
| Now | Run `npm run uscis:smoke` daily with sandbox credentials in your local `.env` |
| Now | Create the **new** ImmigrationCaseTracker Supabase project and put its connection strings in your `.env` |
| Step 6 | Create a **new** Vercel project under the company account. Choose an SMTP provider |
| Step 8 | Stripe account for the LLC |
| Before launch | Company contact email (`NEXT_PUBLIC_CONTACT_EMAIL`), governing-law state, retention/backup periods, and lawyer review of the Privacy Policy, Terms and consent wording |
