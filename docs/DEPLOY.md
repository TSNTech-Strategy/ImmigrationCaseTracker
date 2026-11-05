# Deploying CasePingo

Everything here is **new and separate from Scanvio**: a new Vercel project, a new Inngest app and a new email sender, all pointing at the ImmigrationCaseTracker Supabase project. Never reuse Scanvio's projects or keys.

The deployed app stays on the **USCIS sandbox** until USCIS approves production access. Its daily automatic checks are genuine sandbox traffic from our application.

---

## 0. Domains

Buy **casepingo.com** (main site) and **casepingo.app** (redirects to it). The simplest place is the new Vercel project: **Settings → Domains → Buy**, so DNS is set up automatically. Make `casepingo.com` the primary domain, and set `casepingo.app` and `www.casepingo.com` to redirect to it. Use `https://casepingo.com` as `NEXT_PUBLIC_SITE_URL`.

## 1. Email sender (Resend recommended)

Supabase's built-in sender only reaches your own team, so real users need this for sign-up emails and alerts.

1. Create a Resend account for the company at https://resend.com.
2. **Domains → Add domain.** Add `casepingo.com` and create the DNS records it shows (SPF/DKIM) in Vercel → Domains → DNS. Wait until it reads **Verified**.
3. **API Keys → Create.** Copy the key; it's the SMTP password.
4. SMTP settings for everything below:
   - Host `smtp.resend.com`, port `465`, user `resend`, password = the API key.
   - From: `CasePingo <alerts@casepingo.com>`.

**Supabase sign-up and reset emails:** in Supabase → **Project Settings → Authentication → SMTP Settings**, turn on custom SMTP with the same details.

## 2. Inngest (background jobs): a new app, not Scanvio's

1. At https://www.inngest.com, create a **new account or organization** for CasePingo.
2. You'll copy two keys from it: the **Event key** (Manage → Event keys) and the **Signing key** (Manage → Signing key).
3. The app registers itself as `casepingo` when you sync it (step 5).

## 3. Vercel project (new)

1. In Vercel: **Add New → Project**, then import `TSNTech-Strategy/ImmigrationCaseTracker`, under the company team.
2. Framework: Next.js. Leave the build settings at their defaults. The `build` script runs `prisma generate`, applies migrations on **production** deploys only, then `next build`.
3. **Region:** pick the one closest to your Supabase region (Project Settings → General → Region in Supabase):
   - Supabase `us-east-2` (Ohio) → Vercel `cle1`
   - Supabase `us-east-1` (N. Virginia) → Vercel `iad1`
   - Supabase `us-west-1` → Vercel `sfo1`

   Set it under Project → Settings → Functions → Region.

## 4. Environment variables

Set these in Vercel → Project → Settings → **Environment Variables**. Use **Production** for all of them; add them to **Preview** too if you use preview deployments.

| Variable | Value | Secret? |
|---|---|---|
| `DATABASE_URL` | Supabase transaction pooler (port 6543), ending `?pgbouncer=true&connection_limit=1` | Yes |
| `DIRECT_URL` | Supabase session pooler (port 5432) | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | No |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **Yes** |
| `NEXT_PUBLIC_SITE_URL` | `https://casepingo.com` (the stable production address, no trailing slash) | No |
| `ENCRYPTION_KEY` | **The same key as your local `.env`.** Receipts already stored were encrypted with it | **Yes** |
| `USCIS_ENV` | `sandbox` | No |
| `USCIS_CLIENT_ID` / `USCIS_CLIENT_SECRET` | Sandbox credentials | **Yes** |
| `USCIS_DAILY_BUDGET` | `800` | No |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | From step 1 | `SMTP_PASS` yes |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | From step 2 | **Yes** |
| `ADMIN_EMAILS` | Your email(s) | No |
| `NEXT_PUBLIC_CONTACT_EMAIL` | The public contact address for the legal pages | No |

**Do not set** `INNGEST_DEV` or `MOCK_USCIS` on Vercel. The app refuses mock mode on production.

Deploy. Environment changes apply only to new deployments, so redeploy after changing any of them.

## 5. Connect Inngest to the deployment

In Inngest → **Apps → Sync new app**, enter `https://<your-production-domain>/api/inngest`. Alternatively, install the Inngest integration from the Vercel Marketplace on **this** project only. You should see three functions: `schedule-case-checks`, `check-case`, `notify-status-change`.

Scheduled checks run **only on the production deployment**. Previews share the production database, so they never start their own polling.

## 6. Point Supabase at the live site

In Supabase → **Authentication → URL Configuration**:
- **Site URL:** your production address.
- **Redirect URLs:** add `https://<production-domain>/**`. Keep `http://localhost:3000/**` for local development.

## 7. Check it works

1. Open the site in a private window. The home, Privacy and Terms pages load without signing in, and `/cases` sends you to sign-in.
2. Sign up with a real address. The confirmation email arrives (via Resend), and the link signs you in.
3. Add `EAC9999103402`. It's checked immediately (sandbox).
4. In Inngest → Runs, `schedule-case-checks` runs every 15 minutes, and `check-case` runs when a case is due.
5. In Supabase → Table Editor → `CaseCheckRun`, rows appear with `trigger = SCHEDULED`.

## Local development

```bash
npm run dev
```
```bash
npm run dev:inngest
```

The second command starts the local Inngest dev server at http://localhost:8288 and needs `INNGEST_DEV=1` in `.env`. Without SMTP settings, emails are printed in the `npm run dev` terminal.
