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
| `EXPO_ACCESS_TOKEN` | *(Optional)* Expo → Account settings → Access tokens, if you turn on Expo's enhanced push security | **Yes** |
| `NEXT_PUBLIC_CONTACT_EMAIL` | The public contact address for the legal pages | No |

**Do not set** `INNGEST_DEV` or `MOCK_USCIS` on Vercel. The app refuses mock mode on production.

Deploy. Environment changes apply only to new deployments, so redeploy after changing any of them.

## 5. Connect Inngest to the deployment

In Inngest → **Apps → Sync new app**, enter `https://<your-production-domain>/api/inngest`. Alternatively, install the Inngest integration from the Vercel Marketplace on **this** project only. You should see four functions: `schedule-case-checks`, `check-case`, `notify-status-change`, `billing-reconcile`. Re-sync after a deploy that adds functions (Inngest → Apps → CasePingo → **Resync**).

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

## 8. Billing (Stripe)

Use a **new Stripe account for CasePingo** (same login is fine: Stripe → account menu → **New account**), never Scanvio's. Start in **test mode**: nothing is charged and test cards work.

1. **Business details.** In the CasePingo account, fill in the business profile for TSN TECH & STRATEGY NETWORK LLC (name, support email, statement descriptor, e.g. `CASEPINGO`).
2. **Stripe Tax.** Tax → **Get started**: add the business address, then a **registration** for each state where you collect sales tax (ask your accountant which). Checkout adds tax on top of the listed price.
3. **Keys → local `.env`.** Developers → API keys, test mode: copy the **Secret key** (`sk_test_…`) into your local `.env` as `STRIPE_SECRET_KEY`. Never paste it into chat.
4. **Run the setup once** (safe to re-run; it updates rather than duplicates):
   ```bash
   npm run stripe:setup
   ```
   It creates the 3 products and 4 prices (Premium $3.99/mo and $29/yr, Firm Solo $39/mo, Firm $99/mo), the founding-firm coupon (50% off for 12 months, 25 firms), the customer portal (cancel at period end, change card or plan) and the webhook for `https://casepingo.com/api/stripe/webhook`. It prints the webhook's **signing secret** once.
5. **Vercel** → casepingo → Settings → Environment Variables, **Production only** (previews share the production database, so they must not take payments):

   | Variable | Value | Secret? |
   |---|---|---|
   | `STRIPE_SECRET_KEY` | The same `sk_test_…` key | **Yes** |
   | `STRIPE_WEBHOOK_SECRET` | The `whsec_…` printed by the setup | **Yes** |

   Then **redeploy**. Paid plans appear only when `STRIPE_SECRET_KEY` is set.
6. **Renewal reminder.** Settings → Billing → **Subscriptions and emails**: set *Upcoming renewal events* to **7 days**, and turn on Stripe's emails for failed payments and expiring cards.
7. **Test** with card `4242 4242 4242 4242`, any future date, any CVC: Settings → Get Premium → pay → back on Settings it says "Premium is on". Then Manage billing → cancel → it shows when Premium ends.

**Going live** (only when you're ready to charge): switch Stripe to live mode, repeat steps 3–5 with the live key (`sk_live_…`) and the new webhook secret, and redeploy.

## 9. The assistant (Claude)

The assistant answers with Anthropic's Claude (model `claude-opus-5-5`), grounded in CasePingo's own guides. Until a key is set, the Assistant pages say it "isn't available yet".

1. **API key.** In the Anthropic Console (https://console.anthropic.com/): create an organization for CasePingo (separate from Scanvio's), add billing, then **API keys → Create key** named `casepingo-production`. Never paste it into chat.
2. **Spend limit.** Console → Settings → Limits: set a monthly spend limit you're comfortable with. Each question costs roughly one to two cents (the ~12k-token guide is cached between questions); daily limits per person are in `PLAN_LIMITS.assistantPerDay` (Free 5, Premium 50).
3. **Vercel** → casepingo → Settings → Environment Variables, **Production** (add Preview too only if you want to try it on previews; they count against the same key):

   | Variable | Value | Secret? |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | The `sk-ant-…` key | **Yes** |

   Then **redeploy**.
4. **Check:** sign in → Assistant → ask "What does Case Was Received mean?". Vercel → Logs shows one `assistant.answer` line per answer with token counts (never the question).

## Local development

```bash
npm run dev
```
```bash
npm run dev:inngest
```

The second command starts the local Inngest dev server at http://localhost:8288 and needs `INNGEST_DEV=1` in `.env`. Without SMTP settings, emails are printed in the `npm run dev` terminal.
