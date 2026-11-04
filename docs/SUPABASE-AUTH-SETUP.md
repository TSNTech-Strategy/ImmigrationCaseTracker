# Supabase Auth setup

These settings are made once, in the **ImmigrationCaseTracker** Supabase project (never Scanvio's). They take about 10 minutes.

## 1. Keys → `.env`

Go to Supabase → **Project Settings → API Keys**.

| `.env` variable | Where to find it | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → Data API → Project URL** (`https://xxxx.supabase.co`) | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **API Keys → Publishable key** (`sb_publishable_…`). Older projects call it the "anon" key | No |
| `SUPABASE_SECRET_KEY` | **API Keys → Secret keys** (`sb_secret_…`). Create one if none exists | **Yes**: never share it or prefix it with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally. The real domain in production | No |

## 2. Email sign-in

Go to **Authentication → Sign In / Providers → Email**.

- **Enable Email provider**: on
- **Confirm email**: on. Users must click the link before they can sign in.
- **Minimum password length**: 10. The app enforces this too.
- *(Recommended)* **Prevent use of leaked passwords**: on, if your plan offers it.

## 3. URL configuration

Go to **Authentication → URL Configuration**.

- **Site URL**: `http://localhost:3000` for now. Change it to the production domain at deploy time (Step 6).
- **Redirect URLs**, add:
  - `http://localhost:3000/**`
  - Later, the production domain and Vercel preview URLs, e.g. `https://your-domain.com/**`

## 4. Email templates (recommended)

Go to **Authentication → Emails → Templates**. Replace the link in each template below so it points at our `/auth/confirm` route. This makes links work even when the email is opened on a different device or browser than the one used to sign up.

**Confirm signup**
```html
<h2>Confirm your email</h2>
<p>Thanks for signing up for ImmigrationCaseTracker.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/cases">Confirm your email address</a></p>
<p>If you didn't create an account, you can ignore this email.</p>
```

**Reset password**
```html
<h2>Reset your password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Set a new password</a></p>
<p>If you didn't ask for this, you can ignore this email. Your password won't change.</p>
```

**Change email address**
```html
<h2>Confirm your new email</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/settings">Confirm this email address</a></p>
```

If you skip this step, the default templates still work, but only when the link is opened in the same browser used to sign up.

## 5. Email delivery limits

Supabase's built-in email sender is for testing only:
- It only delivers to email addresses of **members of your Supabase organization**.
- It sends only a few emails per hour.

So while testing, sign up with an address that's on your Supabase team, or use the seeded demo accounts. Before real users arrive (Step 6), set up custom SMTP under **Project Settings → Authentication → SMTP Settings** (Resend, Postmark, SES, etc.).

## 6. Two-factor sign-in (MFA)

Go to **Authentication → Multi-Factor** (sometimes under **Sign In / Providers**) and make sure **TOTP (authenticator app)** is enabled. It's on by default. Users turn it on themselves in **Settings → Two-factor sign-in**.

## 7. Demo accounts

With `SUPABASE_SECRET_KEY` in `.env`, run:

```bash
npm run db:seed
```

This creates confirmed users `demo@ict.dev` and `firm@ict.dev` (password `ict-demo-1234`) in Supabase Auth, with their cases. No email is needed to sign in as them.

## How it fits together

- **Supabase Auth** stores passwords and handles sign-up, email confirmation, password reset, sessions and two-factor (TOTP).
- **Our `User` table** has the same `id` as the Supabase auth user. It's created automatically the first time the user signs in (`src/lib/auth/profile.ts`).
- **Every server page, action and API route** verifies the session with `getClaims()`, which checks the token's signature. `src/proxy.ts` only handles redirects.
- **The mobile app** (later) signs in with Supabase directly and sends `Authorization: Bearer <access token>` to `/api/v1/*`.
