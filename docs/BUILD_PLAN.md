# ImmigrationCaseTracker — Build Plan

**Based on:** *Master Development Guide v2.0* (Nov 4, 2026)
**Status:** Proposed. Nothing below is built yet unless it's marked ✅.
**Owner:** TSN TECH & STRATEGY NETWORK LLC

This plan turns the guide into a build order. It keeps the guide's product scope, security rules and stack. It changes a few infrastructure choices to cut vendors and risk early on (see §2). The guiding rule: **USCIS sandbox integration comes first, because a five-day clock is running.**

---

## 1. The critical path: five consecutive days of sandbox traffic

USCIS production access needs at least 5 consecutive calendar days of sandbox traffic **from our own application**, covering both `200` and `4xx` responses. Day 1 (Nov 4) so far has only a portal *Try It Out* call. The guide warns that this alone may not count.

**So the first thing we build is the USCIS adapter plus a smoke-test command, not the UI.**

| Day | Date | Goal |
|---|---|---|
| 1 | Wed Nov 4 | Run the backend smoke test tonight, if possible: `EAC9999103402` (200) plus an invalid receipt (4xx) |
| 2 | Thu Nov 5 | Smoke test plus error-handling test |
| 3 | Fri Nov 6 | `EAC9999103403` (history) and no-history comparison |
| 4 | Sat Nov 7 | Token reuse/expiry, throttling behaviour |
| 5 | Sun Nov 8 | End-to-end through the API endpoint (`POST /v1/cases/:id/refresh`) |

If Day 1 backend traffic can't happen today, the clock restarts at Nov 5 → Nov 9.

**Where the tests run:** the Claude cloud environment can't reach `api-int.uscis.gov` (blocked by network policy). The USCIS Client Secret also shouldn't be stored there. Options, in order of preference:

1. **Your own computer:** `pnpm uscis:smoke`, with credentials in a local `.env` that is never committed.
2. **GitHub Actions, scheduled once a day:** credentials stored as repository secrets. The job runs the real adapter against sandbox fixtures. It is genuine use of our integration, and it never runs on every pull request.

Every run appends a **sanitized** line to `docs/uscis-evidence/YYYY-MM.jsonl`: timestamp, test category, staging receipt, HTTP status, outcome class and app behaviour. It never records tokens, secrets or raw payloads. That file becomes the evidence log from guide §4.

---

## 2. Architecture decisions (changes from the guide are marked 🔁)

| Area | Decision | Why |
|---|---|---|
| Repo | pnpm workspace monorepo in **this** repo (`TSNTech-Strategy/ImmigrationCaseTracker`) | As in the guide (§16) |
| Web | Next.js 16.4.x App Router + Tailwind 4 + shadcn/ui, in `apps/web` | As in the guide. `/firm/*` lives in the same app |
| API | Node + Fastify + TypeScript, in `apps/api`. It is the **only** holder of USCIS, DB and Stripe secrets | As in the guide. Web and mobile both call it, so authorization logic lives in one place |
| Mobile | Expo SDK 58 / RN 0.88, in `apps/mobile` | As in the guide, but 🔁 **scaffolded in Milestone 5**, after web proves the API (the guide's own advice in §10) |
| Auth | Supabase Auth (email/password, MFA for staff and admins later). API verifies Supabase JWTs via JWKS | As in the guide |
| Data access | 🔁 Clients use Supabase **only for Auth**. All data goes through the API. The Supabase Data API is locked down: RLS enabled with **no `anon` grants** | One authorization path, smaller attack surface |
| RLS | 🔁 The API runs each request's queries **as the user**: in a transaction, `set local role authenticated` plus `request.jwt.claims`. That means RLS is actually enforced on API traffic and isn't bypassed by a service role | Real defense in depth (guide §19.2), not just policies on paper |
| ORM / migrations | 🔁 Drizzle ORM for typed queries. SQL migrations, including RLS policies, in `supabase/migrations`, applied with the Supabase CLI | Versioned, reviewable SQL. Supabase-native |
| Jobs / polling | 🔁 **No Redis at first.** A Postgres job table (`next_check_at` + `FOR UPDATE SKIP LOCKED`, or `pg-boss`) and a worker process on a schedule | Polling is 1–2× per case per day, so Redis isn't needed yet. We can move to BullMQ later without changing the domain code |
| USCIS token | Cached in API/worker memory with an expiry skew (~30 min lifetime). Never written to user records | Guide §18.2 |
| Receipt numbers | AES-256-GCM encrypted at the application layer, plus an HMAC-SHA256 digest for dedupe and lookup. Logs use opaque case IDs | Guide §19.2 and §22.3 |
| Validation | Zod everywhere: env, request bodies, USCIS responses. Shared schemas in `packages/contracts` | As in the guide |
| Tests | Vitest (unit and integration with recorded sandbox fixtures), RLS isolation tests against local Supabase, Playwright for web E2E | Guide §22 |
| Hosting | **New** Vercel project for `apps/web`. **New** Supabase project for DB/Auth. API and worker on a persistent Node host (choose at Milestone 3). **Nothing shared with Scanvio** | Your instruction. Separate accounts and keys |
| Node | Node 24 LTS minimum, declared in `engines` and `.nvmrc`. Move to 26 once Vercel/EAS support it | Guide §14.1 |

**Out of scope for now** (not in the guide's MVP): document uploads, deadline calendars, legal advice features, an "AI attorney".

---

## 3. Repository layout

```text
ImmigrationCaseTracker/
├── apps/
│   ├── api/                 # Fastify — USCIS adapter host, REST API
│   ├── worker/              # scheduled polling + notifications       (M3)
│   ├── web/                 # Next.js — public, consumer, firm, admin  (M2)
│   └── mobile/              # Expo Router                              (M5)
├── packages/
│   ├── contracts/           # Zod schemas + DTOs (receipt, case, status, API)
│   ├── uscis/               # USCIS client: OAuth, token cache, errors, normalize
│   ├── core/                # pure domain logic (change detection, cooldowns)
│   └── config/              # tsconfig / eslint presets
├── supabase/
│   ├── migrations/          # SQL schema + RLS
│   ├── tests/               # RLS isolation tests
│   └── seed.sql             # fake data + staging receipts only
├── docs/
│   ├── BUILD_PLAN.md        # this file
│   ├── decisions/           # ADRs
│   ├── runbooks/
│   └── uscis-evidence/      # sanitized sandbox test log
├── .github/workflows/       # CI + daily sandbox smoke
├── .env.example             # names only
└── pnpm-workspace.yaml
```

`packages/uscis` is a separate package, so the smoke CLI, the API and the worker share one adapter. It's server-only and is never imported by web or mobile.

---

## 4. Milestones

### M0 — Monorepo + USCIS adapter (now; needed for the 5-day clock)
- pnpm workspace, TS strict, ESLint, Prettier, Vitest, `.env.example`, `.gitignore`.
- `packages/contracts`: receipt-number format validation (3 letters + 10 digits), normalized `CaseStatusSnapshot` schema.
- `packages/uscis`:
  - Zod-validated config (`USCIS_ENV`, `USCIS_BASE_URL`, `USCIS_CLIENT_ID`, `USCIS_CLIENT_SECRET`, optional `USCIS_DEMO_ID` header).
  - OAuth client-credentials flow, token cache with skew, single-flight refresh.
  - `getCaseStatus(receipt)` with timeout, bounded retry with jitter for `5xx`/network errors only, and a `401` refresh-once.
  - Error classes: `validation_4xx`, `auth_401_403`, `not_found`, `rate_limited_429`, `server_5xx`, `timeout`, `network`.
  - Normalizer: keeps USCIS-reported dates separate from our `observed_at`, and handles `hist_case_status: null`.
  - Redaction: never logs the token, secret or full receipt.
- Unit tests driven by fixtures shaped like the documented sample responses. No live calls in CI.
- `pnpm uscis:smoke` CLI plus the sanitized evidence log, and an optional scheduled GitHub Action.
- **Done when:** you can run the smoke test locally and get a 200 for `EAC9999103402`, history for `EAC9999103403` and a classified 4xx for an invalid receipt, with log lines written.

### M1 — Database, auth and API core
- Local Supabase (CLI + Docker). Migrations for `profiles`, `cases`, `case_consents`, `case_events`, `case_check_runs`, `audit_logs`, `deletion_requests`. Firm tables are stubbed so ownership is modelled from day one: a case is owned by a user **xor** a firm (CHECK constraint).
- RLS on every table, plus isolation tests (guide §19.3 cases 1, 5 and 6).
- Fastify: `/health`, `/v1/me`, `GET/POST /v1/cases`, `GET/DELETE /v1/cases/:id`, `POST /v1/cases/:id/refresh` (consent check + cooldown + daily budget), `GET /v1/cases/:id/events`. Supabase JWT verification, per-user and per-IP rate limits, request IDs, redacted structured logs (pino).
- **Done when:** an authenticated user can add a staging receipt with consent, refresh it and see events, and user B can't see it (tested).

### M2 — Consumer web MVP
- Public pages: `/`, `/how-it-works`, `/pricing`, `/privacy`, `/terms`, `/accessibility`, all with a "Not affiliated with USCIS/DHS" disclosure. Policy text is a placeholder marked *for counsel review*.
- `/login`, `/signup`, password reset (Supabase).
- `/cases` (list, add with consent gate), `/cases/[id]` (current status, **last checked** vs **last change observed**, timeline, refresh cooldown, remove), `/settings` (profile, alerts, data deletion request).
- Accessibility baseline: labels, focus, contrast, keyboard. Playwright E2E for the guide's signup → add → status → delete flow.

### M3 — Worker, polling and notifications
- Scheduled worker: picks eligible cases (consent active, not checked recently), respects USCIS quota (1,000/day sandbox, 5 TPS) with a global budget and circuit breaker, saves check runs, detects changes, writes events.
- Email notifications (provider chosen at this point) with idempotent `notification_deliveries`.
- Choose the API/worker host. Deploy dev web to the **new** Vercel project and DB to the **new** Supabase project.

### M4 — Law firm SaaS MVP
- `firms`, `firm_memberships` (owner/admin/staff), invitations with revocation, `clients`, consent evidence per case.
- `/firm`, `/firm/clients`, `/firm/cases` (filters + CSV import with row-level validation and dry run), `/firm/team`, `/firm/audit`.
- Cross-firm isolation tests (§19.3 cases 2–4), audit logging on every mutation, case limits per plan.

### M5 — Mobile (Expo)
- Onboarding → auth → consent explainer → cases list → add receipt → status and timeline → settings and deletion.
- Push via Expo Notifications (preference-gated). Same API, no secrets in the bundle.

### M6 — Billing and admin
- Stripe Checkout/Billing plus signed, idempotent webhooks → internal entitlements (Free 1 case / Premium / Firm Starter 100 cases).
- Store billing paths researched before any mobile paywall.
- `/admin`: sanitized job metrics, failed syncs, deletion requests, access revocation. MFA required.

### M7 — Production readiness and USCIS approval
- Company site, policies reviewed by counsel, accessibility statement, incident and deletion runbooks, restore drill.
- Email `developersupport@uscis.dhs.gov` **only after** the 5-day evidence is real. Then the affidavit, the `demo_id` header (already supported by the adapter) and the technical demo. Demo slots currently open in **Feb 2027**.
- Switch to production endpoints/credentials **only after approval**. They are configuration, never hardcoded.

---

## 5. What we need from you

| When | What | Notes |
|---|---|---|
| M0 (today) | Run `pnpm uscis:smoke` locally with your sandbox credentials, **or** add `USCIS_CLIENT_ID` / `USCIS_CLIENT_SECRET` as GitHub repository secrets for the daily Action | Never paste secrets into chat |
| M1 | Docker on your machine for local Supabase (optional; CI can run it too) | |
| M3 | Create a **new** Supabase project and a **new** Vercel project under company accounts (not Scanvio) | I'll give exact settings |
| M3 | Choose an email provider and a host for the API/worker | I'll recommend options |
| M6 | Stripe account for the LLC | |
| M7 | Lawyer review of the privacy policy, terms and consent wording | |

---

## 6. Risks to keep visible

- **The 5-day clock:** a missed day restarts the sequence. The daily Action reduces this risk.
- **Production approval isn't guaranteed**, and demos are booked out to Feb 2027. Don't promise customers a launch date.
- **Store billing rules** may affect mobile monetization. Resolve this before M5 ships a paywall.
- **Receipt numbers are sensitive:** encryption, redaction and consent checks are built in from M0/M1, not added later.
