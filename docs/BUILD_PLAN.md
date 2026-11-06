# CasePingo — Build Plan

> Public brand **CasePingo** (decided Nov 5, 2026; domains casepingo.com + casepingo.app). The repo, the Supabase project and the USCIS developer app keep the name ImmigrationCaseTracker.

**Based on:** *Master Development Guide v2.0* (Nov 4, 2026), adapted to Scanvio's backend pattern
**Owner:** TSN TECH & STRATEGY NETWORK LLC
**Updated:** Nov 5, 2026

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

### Step 6 — Automatic checks, alerts, deploy (code ✅ · deploy pending)
- Plans (revised Nov 6 after a freemium review): **Free** 1 case, no automatic checks or alerts, 3 manual checks a day · **Premium** 10 cases, automatic checks twice a day, email and push alerts · new accounts get a **7-day Premium trial** (one per email and per receipt number; throwaway emails refused; one-way fingerprints kept 12 months). `User.plan`; set by hand until billing. Launch prices (revised Nov 5 after a competitor review): see Step 8.
- Inngest (ICT's own app, not Scanvio's): every 15 min find due cases (active consent required) → one `check-case` per case, throttled to 3 USCIS calls/second, evenly spaced (sandbox spike arrest: 1 call per 200 ms) → `notify-status-change` emails the owner once per change (idempotent), in their language, masked receipt only.
- Circuit breaker pauses ticks when USCIS calls fail in bulk; duplicate/late events never cause extra calls; scheduled jobs never run on preview deployments.
- Email via SMTP (Resend recommended), console in development — same structure as Scanvio.
- Deploy guide: `docs/DEPLOY.md` (new Vercel project + new Inngest app + Resend + Supabase URLs).

### Step 7 — Law firm workspace ✅
- **7A ✅ Firm accounts and team:** `/firm` creates a workspace (14-day trial, 10 cases), `/firm/team` lists members, invites by email (single-use link, stored hashed, expires in 7 days, re-invite replaces the old link), cancels invitations, changes roles and removes people. `/firm/invite/[token]` accepts, only when signed in with the invited email. Owner does everything; Admin invites and removes Staff; only an Owner changes roles; a firm always keeps one Owner. One firm per user. Every change is audit-logged. DB tests cover isolation between firms.
- **7B ✅ Clients and firm cases:** `/firm/clients` (add, edit, archive or restore), `/firm/cases` (list, client filter), `/firm/cases/new`, `/firm/cases/[id]`. Adding a case needs an attestation: G-28 on file (`LEGAL_REPRESENTATIVE`) or written client consent (`AUTHORIZED_BY_APPLICANT`), plus the firm's own evidence reference (no documents stored). Consent can be withdrawn, which stops all checks, and recorded again later, keeping a full history. Duplicates are blocked per firm. New cases stop at the case limit and when the trial ends. Any member can add and refresh (manual refreshes shared, 100 per firm per day); only Owner or Admin can archive clients or remove cases. Alerts go to the member who added the case, or to the Owners once that person has left. Suspended firms' cases aren't polled. Client contact details never go into the audit log. DB tests cover isolation (other firms, ex-members, outsiders).
- **7C ✅ Case dashboard and CSV import:** `/firm/cases` has views with counts (changed this week, check failed, no consent, not checked yet), search (client, reference, label, form, last digits, or a full receipt number matched by its keyed digest), client filter and sorting, showing up to 100 cases. `/firm/cases/import` takes a CSV file of up to 200 rows; it accepts commas or semicolons and flexible column names, and a template can be downloaded. **Preview first, nothing saved:** each row shows whether it will be added or why it's skipped (bad receipt, duplicate in the file or already tracked, ambiguous or archived client, missing evidence, over the case limit), and receipts are only ever shown masked. **Import** re-validates the same file on the server and saves the valid rows in one transaction with `CSV_IMPORT` consent and an audit entry per case plus a summary. A newly chosen file is always previewed first. Clients are matched by reference, then exact name, otherwise created once. Imported cases are checked by the throttled scheduler instead of inline.
- **7D ✅ Activity log:** `/firm/audit` (Owner and Admin only; Staff don't see the tab) lists every firm change in plain English: who, what, when, linked to the case or client where it still exists. Filter by type (team, clients, cases and consent, exports), person, and UTC date range; 50 per page with gap-free paging. **Export CSV** (`/firm/audit/export`, same filters, up to 10,000 entries, formula-safe cells, UTF-8 BOM for Excel) is recorded in the log itself. Read-only: no edit or delete in the app. Receipts are masked; client contact details are never logged.
- Firms, memberships (owner/admin/staff), invitations with revocation, clients, consent evidence.
- `/firm`, `/firm/clients`, `/firm/cases` (filters + CSV import with dry run), `/firm/team`, `/firm/audit`.
- Cross-firm isolation tests and an audit log entry for every change.

### Step 8 — Billing + admin ✅ (code; Stripe test-mode setup in progress)
- **8A ✅ Billing:** Stripe Checkout (hosted, card data never touches us) with **Stripe Tax** on, and the Stripe customer portal for two-click cancel at period end, card and plan changes. Webhook `/api/stripe/webhook`: signature-checked, processed once (`StripeEvent`), the subscription re-read from Stripe each time (`Subscription` table mirrors it). Entitlements: Premium → 10 checked cases; on downgrade the oldest case stays checked and the rest pause (`pausedReason = plan_limit`), with "Check this case instead" and automatic resume on upgrade. Past-due keeps access for a 7-day grace (daily `billing-reconcile` job). Firms: plan sets the case limit (Solo 50, Firm 300), Firm Solo caps the team at 2, and after the trial a firm's cases aren't checked until it subscribes. Founding coupon applied automatically while places last. Our own email 7 days before yearly renewals. Account deletion cancels Premium billing first. `npm run stripe:setup` creates products, prices, coupon, portal and webhook from `src/lib/plans.ts`. Setup steps: `docs/DEPLOY.md` §8.
- **8B ✅ Admin:** `/admin` for emails in `ADMIN_EMAILS`, only with two-factor on and passed this session (everyone else gets a 404). Shows USCIS calls today against the daily budget, last successful and last scheduled check (alert if the scheduler is quiet for 2 h), overdue cases, circuit breaker, results in the last 24 h, email alerts sent and failed (masked addresses), users, Premium, firms by plan, cases, subscriptions and failed payments. Open deletion requests can be retried (account), marked done or declined with a reason; every admin action is audit-logged. No receipt numbers or client details anywhere on the page.
- **Launch prices** (Nov 5, 2026; single source `src/lib/plans.ts`):

  | Plan | Price | Includes |
  |---|---|---|
  | Free | $0 | 1 case, daily checks, email alerts |
  | Premium | $3.99/mo or **$29/yr** (≈ $2.41/mo) | 10 cases (family), twice-daily checks |
  | Firm Solo | $39/mo | 50 cases, 2 users |
  | Firm | $99/mo | 300 cases, unlimited users |

  Firms: 14-day free trial (10 cases, no card). Founding offer: first 25 firms get 50% off for 12 months.
  Why: competitors charge $9.99–$14.99/mo; the cheapest major yearly plan we found was $29.99 (Lawfully $14.99/mo; Case Tracker for USCIS $12.99/mo or $39.99/yr; Silent Case Tracker $9.99/mo or $29.99/yr). Many users are new immigrants on tight budgets, and USCIS's own account sends free updates, so we aim to be the most affordable paid option and keep a real Free plan. Firm case-management suites cost about $55–$120 per user per month; we're one focused tool at a flat firm price.
- **Billing promise** (on the pricing page, must be honoured in Step 8): cancel in Settings in two clicks; an email before every yearly renewal; no hidden fees; on cancel, keep Premium to the end of the paid period, then drop to Free with cases kept.
- Stripe Checkout/Billing, signed idempotent webhooks, entitlements from `PLAN_LIMITS` / `FIRM_PLANS` (Firm Solo user cap enforced on invite), founding-firm coupon.
- `/admin`: sanitized job metrics, failed syncs, deletion requests (as in Scanvio's `ADMIN_EMAILS`).

### Step 9 — Mobile (Expo) (9A ✅ · 9B ✅ · pre-launch features ✅ · 9C store release after USCIS production approval)
- Decided Nov 6: no buying in the app (upgrades on the website), personal cases only, both store accounts exist.
- **9A ✅ Mobile API and push:** `/api/v1/*` (see `docs/MOBILE-API.md`): profile and settings, cases (add with consent, list, detail, refresh, remove, check-instead), push device registration, account deletion from the app. Changes accept only the Supabase Bearer token, never website cookies. Push alerts through Expo's push service for personal cases, once per change, in the person's language, masked receipt only; dead tokens are switched off. `PushDevice` table.
- **9B ✅ App screens** (`mobile/`, Expo SDK 58, Expo Router): welcome, sign in (show-password), create account, forgot password, two-factor code; My cases (trial/Free banner), add a case with the consent statement, case details (status, observed changes, USCIS history, Check now, check-instead, remove); settings (name, language, email and push alerts, plan without any buying, legal links, sign out, delete account). English and Spanish, light and dark like the website. Session encrypted with a keychain/Keystore key. Push permission after sign-in; tapping an alert opens the case. Checked as a web preview against the real API (16 steps); test builds via EAS (`mobile/README.md`).
- **Pre-launch features ✅ (Nov 6, from the competitor research):** plain-language status guide for 34 common USCIS statuses in English and Spanish (`src/lib/status-guide.ts`) shown on web and in the app, with a public library at `/status-guide` (sitemap and robots added); form name, receiving office from the receipt prefix, and a link to USCIS's official processing times (no official API exists, so no copied numbers); timelines with coloured dots; status pills in the app; "alerts only on status changes, never daily reminders or ads" in Settings; store listing draft in `docs/STORE-LISTING.md`. **Approval celebration:** when CasePingo sees a case become approved, personal users get a congratulations card (form-specific next step) and a short red-and-blue star burst, once per device, skipped for reduced motion; web uses `canvas-confetti`, the app uses React Native's own animation plus a success vibration (`expo-haptics`). Firm pages stay quiet.
- **App redesign ✅ (Nov 6, after comparing with a competitor's app):** system tab bar (Cases, Status guide, Settings); My cases with a large header, Check all with USCIS, search, filters by kind of status, cards with a coloured edge, a four-step progress line (Received → In review → Decision → After the decision), last change and a per-phone "New" badge; titles no longer repeat the receipt; rename a case from the app; the status guide as its own tab. API: `stage` and `form` on cases, `GET /api/v1/guide`, `PATCH /api/v1/cases/:id`, `changed` on refresh. No ads, nothing for sale in the app.
- **9C (deferred until USCIS production approval):** store screenshots, listing text from `docs/STORE-LISTING.md`, privacy labels, review notes, EAS production builds and submission.
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
| Step 6 | Create the **new** Vercel project, a **new** Inngest app and a Resend account (see `docs/DEPLOY.md`) |
| Step 8 | Stripe account for the LLC |
| Before launch | Company contact email (`NEXT_PUBLIC_CONTACT_EMAIL`), governing-law state, retention/backup periods, and lawyer review of the Privacy Policy, Terms and consent wording |
