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
| Database | Prisma 6 + PostgreSQL on a **new** Supabase project (pooled `DATABASE_URL` plus `DIRECT_URL`). Migrations run on deploy, as in Scanvio |
| Credentials | **Server-only environment variables** (`.env` locally, Vercel env in production), read only in server code, as in Scanvio. Per-user sensitive data (receipt numbers) is stored **encrypted** in Supabase (AES-256-GCM, `ENCRYPTION_KEY`) |
| USCIS | `src/lib/uscis`: OAuth client-credentials, in-memory token cache, `mock` / `sandbox` / `production` modes, mock refused on production (`VERCEL_ENV`) |
| Auth | Auth.js (next-auth v5), email + password, as in Scanvio. Mobile uses token auth via `/api/mobile` |
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
- Local Postgres via docker-compose on port 5433 (beside Scanvio). Seed data uses staging receipts only.
- DB-enforced rules: one owner per case, client must belong to the case's firm, per-owner receipt uniqueness, RLS on and Supabase API roles revoked. Covered by DB tests.

### Step 3 — Accounts and auth
- Auth.js credentials login, signup, password reset, session roles.
- Route protection (`proxy.ts`) plus server-side checks.
- Mobile token endpoint (stub until Step 9).

### Step 4 — Consumer case tracking
- Add a case behind a consent gate. Receipt is validated, encrypted and checked for duplicates by digest.
- Case list and detail: current status, **last checked** vs **last change observed**, USCIS history, our observed timeline.
- Manual refresh with a cooldown and a daily budget. Remove case.
- Every server call is authorized. Isolation tests confirm user B can't see user A's cases.

### Step 5 — Public pages + settings
- `/`, `/how-it-works`, `/pricing`, `/privacy`, `/terms`, `/accessibility`, with the non-affiliation disclosure. Legal text is a placeholder marked *for counsel review*.
- `/settings`: profile, alert preferences, data deletion request.

### Step 6 — Background polling, alerts and first deploy
- Inngest scheduled function: eligible cases (active consent, not checked recently), throttled under the USCIS rate limit, global daily budget, circuit breaker, check-run log, change detection, events.
- Email alerts on change (SMTP), idempotent.
- **Create the new Supabase and Vercel projects** and deploy. Migrations run on build.

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
| Step 6 | Create a **new** Supabase project and a **new** Vercel project under company accounts. Choose an SMTP provider |
| Step 8 | Stripe account for the LLC |
| Step 10 | Lawyer review of the privacy policy, terms and consent wording |
