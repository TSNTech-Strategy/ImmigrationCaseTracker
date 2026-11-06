# CasePingo store listing (draft for Step 9C)

Draft text for the App Store and Google Play. Finalize at 9C, after USCIS production approval. The positioning comes from the Nov 6 competitor research: competitors are criticized for ads, expensive paywalls, wrong predictions and data used for advertising. We lead with trust.

## Name and short texts

| Field | Limit | Draft |
|---|---|---|
| App name | 30 | **CasePingo: Case Status Alerts** |
| iOS subtitle | 30 | Track USCIS cases, get alerts |
| Play short description | 80 | Check your USCIS case automatically and get an alert when the status changes. |
| iOS promotional text | 170 | No ads. No tracking. Plain-language explanations of every common USCIS status, in English and Spanish. |
| iOS keywords | 100 | uscis,case status,immigration,green card,receipt,i-485,i-130,n-400,i-765,tracker,alerts,visa |

Keep "USCIS" out of the app name: it can read as government affiliation. It's fine in the subtitle, keywords and description, alongside the disclaimer.

## Description

> Never miss a case update.
>
> Add the receipt number from your USCIS notice once. CasePingo checks your case with USCIS and tells you when the status changes. Every status comes with a plain explanation of what it means and what usually happens next.
>
> **Why people choose CasePingo**
> • No ads, and no tracking across apps or websites
> • Plain-language explanations of common USCIS statuses, in English and Spanish
> • The full history: every change we've seen, plus the history USCIS reports
> • Scan your receipt notice with the camera to add a case. It's read on your phone; the photo isn't uploaded
> • Your form, the office that received your case, and a link to USCIS's official processing times
> • An assistant that answers questions about your status, interviews and the civics test, in English or Spanish (general information, not legal advice)
> • Practice the citizenship civics test with USCIS's official questions: a mock test with the real pass and fail rules, or one section at a time, with the questions read aloud
> • Up to 10 family cases in one place (Premium)
> • Receipt numbers encrypted, and your account deletable in the app at any time
>
> **Plans**
> Free: 1 case, check it yourself up to 3 times a day.
> Premium: automatic checks twice a day, with email and phone alerts.
>
> **Important**
> CasePingo is an independent service. It is not affiliated with or endorsed by U.S. Citizenship and Immigration Services (USCIS), the Department of Homeland Security (DHS) or any government agency, and it does not provide legal advice. Case status information comes from USCIS. The official source is USCIS Case Status Online: https://egov.uscis.gov/

Google Play's misrepresentation policy requires the government disclaimer and the official source link in the description. Keep both.

Purchases: the app sells nothing. Before 9C, re-check Apple's current US rules on mentioning website purchases (guideline 3.1.3) before adding prices or "upgrade on casepingo.com" wording to the listing.

## Screenshots (6, iPhone 6.9" and Android phone)

1. My cases: status pills (In progress / Action may be needed / Approved)
2. Case details: USCIS wording, then "What this means / What usually happens next"
3. The approval moment: congratulations card with red and blue stars
4. Timeline: changes we've seen, with coloured dots
5. Spanish: the same screen in Spanish
6. Settings: alerts only on status changes, two-factor sign-in, delete account
7. (optional) Add a case: "Scan your receipt notice" with the number filled in
8. (optional) Civics test practice: a question with four choices and "Listen", or the "You passed" result

Caption ideas: "Know what your status means", "Celebrate the approval", "Your whole family's cases", "En español también", "No ads. No tracking."

## Apple App Privacy (draft answers)

- **Tracking:** No. CasePingo doesn't track people across other companies' apps or websites, and has no ad SDKs.
- **Data linked to the user, used only for App Functionality:**
  - Contact Info: email address (account), name (optional)
  - User Content: other user content (receipt numbers and nicknames, encrypted at rest; questions typed into the assistant, sent to our AI provider, Anthropic, to answer them and not stored by CasePingo)
  - Identifiers: user ID; device ID (the push-notification token, only when alerts are on)
- **Not collected:** location, contacts, browsing or search history, health, financial info (no purchases in the app), diagnostics or analytics SDKs, photos, audio.
- **Camera and photos:** the receipt scanner reads a photo of the USCIS notice on the device (Apple Vision) to find the receipt number. The photo is never uploaded, so "Photos or Videos" stays Not collected; only the receipt number the person confirms is sent, as when typed.

## Google Play Data safety (draft answers)

- Collected: personal info (email, name), other user-generated content (receipt numbers, nicknames, assistant questions), device or other IDs (push token).
- Purpose: app functionality and account management only. Not used for advertising.
- Shared: receipt numbers go to USCIS only to look up the status the user asked for. This is a user-initiated action, so per Google's definitions it's not "sharing"; confirm at 9C.
- Assistant: questions go to our AI provider (Anthropic) only to write the answer the user asked for, as a service provider; CasePingo doesn't store them. Confirm the "shared" answer at 9C.
- Camera / photos: used on the device only to read the receipt number from a notice (Google ML Kit, on-device); photos are not collected or shared.
- Encrypted in transit: yes. Users can delete their account and data in the app (Settings → Delete account) and on the website. Deletion link for the listing: `https://casepingo.com/settings` (sign in, then Delete account), plus the support email.

## Review notes (draft)

- Demo account with at least one case, for App Review. Production uses real USCIS data only (demo mode is blocked in production), so the review account needs a real, consented case. Decide which at 9C.
- Explain: no purchases in the app; upgrades are handled on the website.
- Explain the consent step: users confirm the case is theirs or that the applicant authorized them.
- Explain the camera: it's used only to read the receipt number from a USCIS notice the user photographs; text recognition runs on the device and nothing is uploaded.
