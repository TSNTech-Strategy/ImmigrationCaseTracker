# ImmigrationCaseTracker

USCIS case-status tracking for individuals, families and immigration law firms.
TSN TECH & STRATEGY NETWORK LLC.

> Not affiliated with or endorsed by USCIS or DHS. Not legal advice.

The build plan is in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md).

## Stack

Built the same way as Scanvio: one Next.js 16 app (web + API routes), with Prisma and Inngest. Accounts use **Supabase Auth**; set up the dashboard with [`docs/SUPABASE-AUTH-SETUP.md`](docs/SUPABASE-AUTH-SETUP.md). It deploys to a new Vercel project. An Expo app in `mobile/` comes later.

**All data lives in the dedicated ImmigrationCaseTracker Supabase project**, never Scanvio's. There's no local or Docker database: local development points at a Supabase development database through `.env`.

## Getting started

```bash
npm install
cp .env.example .env   # Supabase connection strings, USCIS credentials, ENCRYPTION_KEY
npm run db:deploy      # create/update the tables in Supabase
npm run db:seed        # optional demo data (staging receipts only)
npm run dev
```

With empty USCIS credentials the app runs in **mock mode**, which returns deterministic fake statuses.

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app |
| `npm test` | Unit tests (no live USCIS calls). Add `TEST_DATABASE_URL=…` (a disposable database, never production) to also run the database tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run db:deploy` | Apply committed migrations to the Supabase database in `.env` |
| `npm run db:migrate` | *(Developers)* Create a new migration after changing `prisma/schema.prisma` |
| `npm run db:seed` | Demo data: Supabase Auth users `demo@ict.dev` and `firm@ict.dev`, password `ict-demo-1234` (needs `SUPABASE_SECRET_KEY`) |
| `npm run db:studio` | Browse the database (or use the Supabase Table Editor) |
| `npm run uscis:smoke` | Daily USCIS **sandbox** check. Writes sanitized evidence to `docs/uscis-evidence/`. Add `-- --show-errors` to print USCIS error bodies (console only) |

## Credentials

USCIS, encryption and (later) Stripe/SMTP secrets are **server-only environment variables**: `.env` locally, Vercel environment variables in production. They are read only in `src/lib/**` server code and never sent to the browser or mobile app. See `.env.example`.

## USCIS integration (`src/lib/uscis`)

- `getUscisClient()` is the single entry point. Mode is `mock`, `sandbox` or `production`, chosen by env only. Mock mode is refused on the production deployment.
- OAuth client-credentials token, cached in memory until 60 s before expiry. Concurrent callers share one request.
- Errors are classified as `auth`, `bad_request`, `not_found`, `rate_limited`, `server`, `timeout`, `network` or `bad_response`. Only 5xx, timeout and network errors are retried, with backoff. A 401 refreshes the token once.
- Responses are validated and normalized. USCIS-reported dates are kept separate from when we observed a change, and a fingerprint is computed for change detection.
- Receipt numbers are never logged in full (`maskReceiptNumber`), and are encrypted at rest with `src/lib/crypto.ts`.

## Data model (`prisma/schema.prisma`)

- A **TrackedCase** belongs to exactly one owner: an individual `User` **or** a `Firm`. This is enforced by a database CHECK constraint. A firm case can link to a `Client`, and a composite foreign key guarantees it's the same firm's client.
- Receipt numbers are stored only as AES-256-GCM ciphertext, a keyed HMAC digest (duplicate detection) and a masked hint (`EAC*******402`). See `src/lib/cases/receipt-store.ts`.
- **CaseConsent** records express consent: its basis, source, wording version, and withdrawal. Cases are polled only while consent is active.
- **CaseStatusEvent** records what *we* observed and when. USCIS's own history is kept separately on the case (`uscisHistory`).
- **CaseCheckRun** is a sanitized log of every USCIS call: status code, outcome and duration, with no payloads.
- `AuditLog`, `DeletionRequest`, `NotificationPreference` and `NotificationDelivery` (idempotent alerts) are also included.
- Row Level Security is enabled on every table, and Supabase's `anon`/`authenticated` API roles are revoked. The app reaches the data only through Prisma on the server.
- Migrations run automatically on production deploys (`scripts/migrate-on-deploy.mjs`), but not on previews, same as Scanvio.
