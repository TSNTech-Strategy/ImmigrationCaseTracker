# CasePingo mobile API (v1)

Used by the Expo app in `mobile/` (Step 9B). Personal cases only; law-firm features stay on the website. No purchasing in the app: it shows the plan, and upgrades happen on casepingo.com.

**Sign-in:** the app signs in with Supabase Auth directly and sends `Authorization: Bearer <access token>` on every request. Requests that change data accept only the token, never the website's cookies. Two-factor users need a token from after their code (aal2). Responses are JSON with `cache-control: no-store`; errors look like `{"error": "code", "message": "Readable text", "field"?: "receipt"}`.

| Method | Path | What it does |
|---|---|---|
| GET | `/api/v1/config` | Consent wording and version, receipt hint (no sign-in needed) |
| GET | `/api/v1/me` | Profile, plan, case counts, alert settings |
| PATCH | `/api/v1/me` | `{name?, locale?: "en"\|"es", emailOnChange?, pushOnChange?}` |
| DELETE | `/api/v1/me` | `{"confirm": "DELETE"}`: deletes the account (cancels billing first). 409 `firm_owner` if they own a firm |
| GET | `/api/v1/cases` | The person's cases (masked receipts only) |
| POST | `/api/v1/cases` | `{receipt, nickname?, basis: "SELF"\|"AUTHORIZED_BY_APPLICANT", consent: true, statementVersion}` → 201 `{caseId, check}`. 400 `invalid_receipt`, 409 `duplicate` / `consent_outdated`, 403 `plan_limit` |
| GET | `/api/v1/cases/:id` | Status, our observed changes, USCIS history, consent |
| DELETE | `/api/v1/cases/:id` | Remove the case and stop checks |
| POST | `/api/v1/cases/:id/refresh` | Refresh now. 429 `cooldown` / `limit` / `budget`, 409 `paused` / `no_consent`, 502 `failed` |
| POST | `/api/v1/cases/:id/check-instead` | Free plan: check this paused case instead |
| POST | `/api/v1/devices` | `{token: "ExponentPushToken[…]", platform: "ios"\|"android", appVersion?}`: turns push alerts on |
| DELETE | `/api/v1/devices` | `{token}`: stop pushes to this phone (sign-out) |

**Push alerts:** when a personal case's status changes, the owner's active phones get a push through Expo's push service (title "Case update", body "label: status", data `{caseId}`), in their language, with the masked receipt only. Each (status change, person) is pushed once. Tokens Expo reports as dead are switched off.
