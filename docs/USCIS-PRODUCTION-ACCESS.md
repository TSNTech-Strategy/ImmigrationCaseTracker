# USCIS production access: requirements, demo and request

How CasePingo meets the Case Status API's production-access rules, how to run the demo, and the request email. Sources (read Nov 10, 2026): the Case Status API spec (`https://developer.uscis.gov/sites/default/files/apidoc_specs/swagger_3.yaml`) and the developer portal's *Get started* pages (request, affidavit, demo ID, demo, go-live).

## 1. Before requesting

| USCIS prerequisite | Status |
|---|---|
| Registered developer account and a Case Status API sandbox app | Done (credentials in `.env` / Vercel) |
| Actively implemented and tested in sandbox | Done: the whole app, plus `npm run uscis:smoke` |
| **Minimum of 5 consecutive calendar days of API traffic** | `docs/uscis-evidence/`. The sandbox is closed on weekends (503 outside M-F 7:00 AM to 8:00 PM ET), so the only unbroken 5-day run is Monday to Friday of one week. A missed day restarts the count. |
| 200 and 4xx responses tested | The smoke test covers 200 (with and without history, token reuse), 422 (bad format), 404 (unknown receipt) and 401 (bad credentials) every run |

Request by email to **developersupport@uscis.dhs.gov** (draft in §5). USCIS replies with the Developer Portal Affidavit (print, wet signature), then issues a 4-digit demo ID, then a scheduler link. **Demo slots are booked through February 2027** (next openings March 2027), so request as soon as the five days are complete.

## 2. Demo criteria (Pass/Fail) and where we meet them

| Criterion | How CasePingo meets it |
|---|---|
| **User input**: easy to enter, explained, helper text and validation | `/cases/new`: label, placeholder, "3 letters and 10 digits, from the top of your USCIS receipt notice (Form I-797C)", format check before anything is sent, consent statement. Mobile app also scans the notice. |
| **JSON conversion** matching the API definition | GET `/case-status/{receiptNumber}`; the receipt is normalized (uppercase, no spaces or dashes) and sent in the path, as the spec defines. The JSON response is validated with a schema (`src/lib/uscis/normalize.ts`). |
| **Authentication**: OAuth 2.0 client credentials, secrets on our servers, no client-side calls | `src/lib/uscis/token.ts`: token from `/oauth/accesstoken`, cached in server memory, never stored or logged. Browser and mobile app only call CasePingo's own API. |
| **Responses** shown in the UI (backend logging may be acceptable) | Case page shows the status (EN/ES), history and dates. On failure it shows our explanation **and USCIS's own message**: `USCIS said (HTTP 404): "…"`. Every failure is also logged as one JSON line, `uscis.check_failed` (status, USCIS code, message, traceId, receipt masked), and stored on the check run. |
| **Case status** clearly presented | Current status, plain-language guide, USCIS history, "last checked" vs "last change observed", line map. |

### Error handling: every documented response

| HTTP | USCIS meaning | What the user sees (plus USCIS's message) |
|---|---|---|
| 200 | OK | The status |
| 401 | Invalid or expired token, keys not enabled | We drop the token and retry once with a new one; if it still fails: "CasePingo couldn't sign in to USCIS…" |
| 404 | Receipt not recognized (also returned for people protected under 8 U.S.C. 1367) | "USCIS doesn't recognize this receipt number… call the USCIS Contact Center at 1-800-375-5283." |
| 422 | Not 13 characters, or invalid prefix | "This receipt number isn't in USCIS's format…" (most are caught by our own check before sending) |
| 429 | Over 5 TPS / 1,000 a day (sandbox) | "USCIS is busy right now…"; retried later by the scheduler, never in a tight loop |
| 503 | Sandbox closed / service unavailable | "USCIS's case status service is unavailable right now…"; retried with backoff |

USCIS error bodies come in several shapes (`{ message }`, `{ code, message }`, `{ error: { code, message } }`, RFC 9457 with `reference` and `traceId`, OAuth `{ ErrorCode, Error }`); `parseErrorDetails` reads all of them. USCIS's message is shown and stored with the receipt number masked.

Limits: sandbox spike arrest is 1 call per 200 ms (the smoke test waits 300 ms between tests; scheduled checks are spaced); production allows 10 TPS and 400,000 a day.

## 3. Demo ID

When USCIS sends the 4-digit demo ID:

1. Set `USCIS_DEMO_ID=####` in Vercel (and `.env` for local runs) and redeploy.
2. It's sent as the `demo_id` request header on every case-status call: `src/lib/uscis/client.ts`, `if (config.demoId) headers.demo_id = config.demoId;`. Send USCIS that line (or a screenshot) as confirmation.
3. Remove `USCIS_DEMO_ID` once production access is granted.

## 4. Demo script (30 minutes, staging environment, no PII)

1. Introductions: name, title, company (TSN Tech & Strategy Network LLC), application (CasePingo), one line on the use case.
2. Sign in on casepingo.com (sandbox mode, test account).
3. **Add a case** with a staging receipt with history, e.g. `EAC9999103403`: show the helper text, a typo rejected by our validation, the consent statement, then the live result (status, history, dates).
4. Add a second staging receipt without history, e.g. `EAC9999103402` ("Case Approval Was Affirmed"). Any of the 50 staging receipts work (`SANDBOX_STAGING_RECEIPTS` in `src/lib/receipt.ts`).
5. **Errors, live from the sandbox**:
   - 404: `npm run uscis:smoke` uses `EAC0000000001`; show the case page message with USCIS's text.
   - 422: the smoke test's `INVALID` receipt.
   - 401: `npm run uscis:smoke -- --with-auth-error`.
6. **Errors that can't be produced on demand** (429, 503): show the handling with mock mode (`MOCK_USCIS=true` locally). Receipts ending `0401`, `0404`, `0422`, `0429` and `0500` return each documented error with USCIS's documented message (`src/lib/uscis/mock.ts`). Also show the `uscis.check_failed` log lines and the backoff.
7. Show where secrets live (server environment only) and the token cache.
8. Questions and feedback.

## 5. Request email (send after the fifth consecutive day)

> **To:** developersupport@uscis.dhs.gov
> **Subject:** Production access request: Case Status API (CasePingo)
>
> Hello USCIS Torch API Developer Support,
>
> We'd like to request production access to the Case Status API for our application, CasePingo.
>
> - Organization: TSN Tech & Strategy Network LLC
> - Application: CasePingo (https://casepingo.com), which lets applicants and their attorneys track their own USCIS cases, with the applicant's consent
> - Developer account / sandbox app: [developer account email] / [sandbox app name]
> - Sandbox traffic: 5 consecutive calendar days, [first day] to [last day], with 200, 401, 404 and 422 responses tested
> - Authentication: OAuth 2.0 client credentials, called only from our servers
>
> Please let us know the next steps for the Developer Portal Affidavit.
>
> Thank you,
> [Name, title]
> [Phone]
