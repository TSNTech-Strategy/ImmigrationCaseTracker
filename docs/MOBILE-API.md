# CasePingo mobile API (v1)

Used by the Expo app in `mobile/` (Step 9B). Personal cases only; law-firm features stay on the website. No purchasing in the app: it shows the plan, and upgrades happen on casepingo.com.

**Sign-in:** the app signs in with Supabase Auth directly and sends `Authorization: Bearer <access token>` on every request. Requests that change data accept only the token, never the website's cookies. Two-factor users need a token from after their code (aal2). Responses are JSON with `cache-control: no-store`; errors look like `{"error": "code", "message": "Readable text", "field"?: "receipt"}`.

| Method | Path | What it does |
|---|---|---|
| GET | `/api/v1/config` | Consent wording and version, receipt hint (no sign-in needed) |
| GET | `/api/v1/assistant` | The assistant for this account: `{available, plan, limit, used, remaining}` (questions per UTC day; `available` is false until the server has `ANTHROPIC_API_KEY`) |
| POST | `/api/v1/assistant` | Ask: `{messages: [{role: "user"|"assistant", content}], caseId?}` (recent turns, ending with the question; nothing is stored). Errors before the answer are JSON with `error`: `unavailable` (503), `invalid`/`too_long` (400), `limit` (429, with `plan` and `limit`). Otherwise the answer streams as newline-delimited JSON (`application/x-ndjson`): `{"type":"text","text"}` pieces, `{"type":"reset"}` (discard the text so far), `{"type":"refusal"}`, `{"type":"error","error":"busy"|"failed","message"}`, and finally `{"type":"done","remaining","stop"}`. With `caseId` (the person's own case), the assistant also gets that case's form and status, never the receipt number |
| GET | `/api/v1/civics` | Civics test practice: `{defaultVersion, currentAsOf, practicePassShare, text, links, versions: [{version: "2025"|"2008", title, who, format, listUrl, total, rules: {standard, senior: {ask, pass, failAt}}, sections, questions: [{id, n, section, q, answers, note?, star, kind: "fixed"|"current"|"local", pick, right?, wrong?}]}]}`. Questions and answers are USCIS's official lists; `right`/`wrong` are practice choices (none for `local` questions); `senior` is the 65/20 format (no sign-in needed) |
| GET | `/api/v1/resources` | The resource center for the Resources tab: `{statusLibrary, resources: [{slug, title, summary, intro, sections, faq?, links}], contactEmail}` in English and Spanish; links are official pages or website paths (`/status-guide`, `/visa-bulletin`, `/civics-test`, `/resources/…`) the app maps to its own screens; `contactEmail` is `null` until `NEXT_PUBLIC_CONTACT_EMAIL` is set (no sign-in needed) |
| GET | `/api/v1/guide` | The status guide for the app's Status guide tab: `{stageCount, entries: [{slug, heading, wordings, category, stage, path, en, es}]}` (no sign-in needed) |
| GET | `/api/v1/me` | Profile, plan, case counts, alert settings |
| PATCH | `/api/v1/me` | `{name?, locale?: "en"\|"es", emailOnChange?, pushOnChange?}` |
| DELETE | `/api/v1/me` | `{"confirm": "DELETE"}`: deletes the account (cancels billing first). 409 `firm_owner` if they own a firm |
| GET | `/api/v1/cases` | The person's cases (masked receipts only), each with `category`, `stage`, `form` and `recentApprovalAt`; plus `stageCount` |
| POST | `/api/v1/cases` | `{receipt, nickname?, basis: "SELF"\|"AUTHORIZED_BY_APPLICANT", consent: true, statementVersion}` → 201 `{caseId, check}`. 400 `invalid_receipt`, 409 `duplicate` / `consent_outdated`, 403 `plan_limit` |
| GET | `/api/v1/cases/:id` | Status, plain-language guide, form and office, our observed changes, USCIS history, consent, congratulations |
| PATCH | `/api/v1/cases/:id` | `{nickname: string \| null}` (up to 60 characters): rename the case or clear the nickname |
| DELETE | `/api/v1/cases/:id` | Remove the case and stop checks |
| POST | `/api/v1/cases/:id/refresh` | Refresh now → `{status: "updated", changed, message}`. 429 `cooldown` / `limit` / `budget`, 409 `paused` / `no_consent`, 502 `failed` |
| POST | `/api/v1/cases/:id/check-instead` | Free plan: check this paused case instead |
| POST | `/api/v1/devices` | `{token: "ExponentPushToken[…]", platform: "ios"\|"android", appVersion?}`: turns push alerts on |
| DELETE | `/api/v1/devices` | `{token}`: stop pushes to this phone (sign-out) |

**Case fields added for the status guide and the approval moment:**

| Field | Where | Meaning |
|---|---|---|
| `category` | list, detail, each `events[]` and `uscisHistory[]` item | `"progress"`, `"action"`, `"done"` (approved), `"stop"` (decision) or `"none"`; drives the coloured pill and timeline dot |
| `recentApprovalAt` | list | When CasePingo saw the case become approved, if within the last 30 days; else `null` |
| `stage` | list, detail | Step on the progress line, 0–3: Received, In review, Decision, After the decision (`null` before the first check). Side statuses such as a transfer count as In review |
| `form` | list, detail | `{code: "I-485", name: {en, es} \| null}` or `null` |
| `guide` | detail | `{slug, path, en, es}`, each language `{meaning, next, todo}` (todo may be `null`); `null` when the status isn't in the guide. Open `path` on the website for the full page |
| `office` | detail | Office that received the case, from the receipt prefix: `{code: "LIN", name: {en, es} \| null}` |
| `processingTimesUrl` | detail | USCIS's official processing-times page (USCIS offers no API for it) |
| `celebration` | detail | `{approvedAt, nextStep: {en, es} \| null}` while the approval is recent; the app shows the congratulations card and plays the star burst once per phone |

Only approvals CasePingo watched happen count (an approved status after an earlier one), so adding a case that was already approved doesn't trigger the celebration. The guide text comes from the server, so its wording can improve without an app release.

**Push alerts:** when a personal case's status changes, the owner's active phones get a push through Expo's push service (title "Case update", body "label: status", data `{caseId}`), in their language, with the masked receipt only. Each (status change, person) is pushed once. Tokens Expo reports as dead are switched off.
