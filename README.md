# ImmigrationCaseTracker

USCIS case-status tracking for individuals, families and immigration law firms.
TSN TECH & STRATEGY NETWORK LLC.

> Not affiliated with or endorsed by USCIS or DHS. Not legal advice.

The build plan is in [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md).

## Stack

Built the same way as Scanvio: one Next.js 16 app (web + API routes), with Prisma on a new Supabase Postgres, Auth.js and Inngest. It deploys to a new Vercel project. An Expo app in `mobile/` comes later.

## Getting started

```bash
npm install
cp .env.example .env   # fill in USCIS_CLIENT_ID / USCIS_CLIENT_SECRET for sandbox
npm run dev
```

With empty USCIS credentials the app runs in **mock mode**, which returns deterministic fake statuses.

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app |
| `npm test` | Unit tests (no live USCIS calls) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run uscis:smoke` | Daily USCIS **sandbox** check. Writes sanitized evidence to `docs/uscis-evidence/`. Add `-- --show-errors` to print USCIS error bodies (console only) |

## Credentials

USCIS, encryption and (later) Stripe/SMTP secrets are **server-only environment variables**: `.env` locally, Vercel environment variables in production. They are read only in `src/lib/**` server code and never sent to the browser or mobile app. See `.env.example`.

## USCIS integration (`src/lib/uscis`)

- `getUscisClient()` is the single entry point. Mode is `mock`, `sandbox` or `production`, chosen by env only. Mock mode is refused on the production deployment.
- OAuth client-credentials token, cached in memory until 60 s before expiry. Concurrent callers share one request.
- Errors are classified as `auth`, `bad_request`, `not_found`, `rate_limited`, `server`, `timeout`, `network` or `bad_response`. Only 5xx, timeout and network errors are retried, with backoff. A 401 refreshes the token once.
- Responses are validated and normalized. USCIS-reported dates are kept separate from when we observed a change, and a fingerprint is computed for change detection.
- Receipt numbers are never logged in full (`maskReceiptNumber`), and are encrypted at rest with `src/lib/crypto.ts`.
