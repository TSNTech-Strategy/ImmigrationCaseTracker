# CasePingo for Firms: platform and business plan

Status: draft for the owner's review, November 2026. Each phase below is built, tested, merged and released on its own.

## 1. The business

### Who it is for
Immigration law firms with 1 to 25 people: solo attorneys, small firms, and the paralegals who keep their cases moving. They track dozens to hundreds of USCIS cases, answer "any news?" calls all day, and chase clients for documents by email and text.

### The problem
- Checking case status one receipt at a time on the USCIS website.
- Clients calling or texting for updates the firm already has.
- Missed RFE and NOID response dates, lost track of quiet cases.
- Documents arriving by email, WhatsApp and paper, with no list of what is still missing.
- Case management suites (Docketwise, Clio, others) are large, priced per seat, and still leave status tracking and client chasing to staff.

### What we sell
A case status and client communication desk that sits beside whatever case management software the firm already uses, or replaces spreadsheets for firms that have none:
1. Every USCIS change in one shared inbox, assigned and closed like email.
2. Clients told automatically, in English or Spanish, and able to see their own status page.
3. Deadlines and tasks no one misses.
4. Document requests: the firm asks, the client uploads from a phone, the firm checks the list.
5. A dashboard a managing attorney can read in a minute.

### Why firms choose us
| | CasePingo | Typical alternatives |
|---|---|---|
| Price model | Per firm, users included | Per seat ($49–$169 per user per month) |
| Client updates | Built in, bilingual, review-first or automatic | Add-on or manual |
| Client document requests | From case-type checklists, uploads from a phone, no client password | Portal with account sign-up |
| Plain-language status help and next step | On every status, English and Spanish | Raw USCIS text |
| Stuck-case and deadline alerts | Built in | Partly |
| Setup | Paste receipts or upload an export; working in minutes | Onboarding calls |

### Pricing (proposal, to confirm before Phase 7)
| Plan | For | Price per month | Includes |
|---|---|---|---|
| Solo | One attorney and an assistant | $49 | 2 users, 150 active cases, client updates, deadlines, tasks |
| Firm | Small firms | $129 | 10 users, 600 active cases, everything in Solo plus document requests, client portal, matters, dashboard |
| Firm Plus | Growing firms | $249 | Unlimited users, 2,000 active cases, priority support, data export on demand, SMS (when released) |

- 14-day free trial with no card; annual billing 2 months free.
- Founding offer kept: 50% off for 12 months for the first 25 firms.
- A 5-person firm pays $129 with us against $245–$845 per month per-seat elsewhere. That gap is the headline of every sales page.

### How we reach firms
1. Free tools that bring attorneys in: public status guide, Visa Bulletin guide, processing help pages (already live).
2. "Import your cases in 2 minutes" demo: paste receipts, see the inbox fill.
3. State bar and AILA chapter listings, immigration CLE sponsorships, referral credit (one free month per referred firm).
4. Spanish-first messaging for firms serving Spanish-speaking clients.

### What we measure
Trial-to-paid rate, weekly active firms, cases per firm, client emails sent per firm, document requests completed, churn, support tickets per firm.

### Rules we keep
- USCIS data only through the official USCIS API with consent recorded per case. No scraping of USCIS, CEAC (consular) or DOL websites, so consular and labor certification tracking waits until an official data source exists.
- No copying of USCIS processing times or competitors' branding.
- Client documents stored encrypted in Supabase Storage (private), only on the firm's own Supabase/Vercel projects, never shared with other products.
- Lawyer review of client-facing wording before launch.

## 2. The product, in working order

The order a firm meets the product: set up, bring in clients and cases, keep them in sync, work the inbox, plan the work, collect documents, keep clients informed, see the whole firm, adjust preferences, manage the team, pay.

| # | Area | What it does | Status |
|---|---|---|---|
| 1 | Workspace and settings | Firm profile (name, logo, time zone, default assignee), my profile, appearance; settings tabs: General, Team, Tags, Client updates and alerts, Activity, Plan and billing (Sync, Notifications, Legal and data come later) | Built in Phase 1 (logo in Phase 4) |
| 2 | Clients | Client list with search and filters; client profile: first and last name, date of birth, country of birth, citizenship, email, phone, preferred language, A-Number (encrypted), tags, family links; cases, documents, tasks and activity on one page | Profile, table and filters built (Phase 1); family links with matters (Phase 2) |
| 3 | Cases | Case table: receipt, client, form, category, assignee, status, tags, last change; side panel with details; new case form (receipt, client, assignee, matter, tags); bulk import (paste or file); export CSV | Built (matter added in Phase 2) |
| 4 | Sync | USCIS checks per plan schedule, "check now", last runs and health; consent records | Built (Phase 6 adds schedule settings and history page) |
| 5 | Inbox | Status changes, stuck cases, deadline and task reminders, document uploads; assign, snooze, done; "assigned to me" or "whole firm" | Built (later phases add task and document items) |
| 6 | Tasks and calendar | My tasks and team tasks; list and calendar views; status, type, priority, assignee, due date; linked to a case, client or matter; comments and @mentions | Phase 2 |
| 7 | Matters and groups | Group cases by family, employer, lawsuit or custom; filter every page by matter | Phase 2 |
| 8 | Documents | Upload files to a case or client; kind, visibility (internal or shared with the client), size, uploaded by; search and filters | Phase 3 |
| 9 | Document requests | Firm builds a request from the case-type checklist (or its own list), adds a due date and message; client gets a link (email now, SMS later) and uploads from a phone; firm accepts or asks again; reminders; progress on case and client pages | Phase 3 |
| 10 | Client portal | Client's status page plus open document requests, uploads, firm contact; English and Spanish; firm logo | Status page built; Phase 4 adds requests and branding |
| 11 | Dashboard | Case volume by form and category, status overview, cases by assignee, days waiting, stuck cases, upcoming deadlines, open document requests; filters by date, assignee, matter | Phase 5 |
| 12 | Notifications | Per person: inbox start view, backup colleague while away, which task updates appear, which case updates email me (by type: approvals, requests, appointments, denials, other) and for which cases (mine, matters, groups, tags) | Phase 6 |
| 13 | Team and roles | Members with role, active cases, last active; invitations; Owner, Admin, Staff, plus "Attorney" and "Paralegal" labels | Built (Phase 6 adds columns and labels) |
| 14 | Activity log | Every change in plain language, filters, CSV export; never logs sensitive values (A-Numbers, dates of birth, notes) | Built |
| 15 | Plan and billing | Plan, seats or users, cases used, next charge, invoices, change plan | Built on Stripe (Phase 7 new tiers) |
| 16 | Legal and data | Terms and privacy, export everything, delete everything, inactivity policy, analytics choice | Phase 7 |

## 3. Build phases

Every phase: database migration with row-level security, server logic with database tests, pages, a browser test with screenshots, docs, pull request, Vercel preview, merge, production check.

### Phase 1: Professional workspace (foundation) ✅ built
- New firm app layout: full-width workspace, top bar with firm switcher area, main tabs (Inbox, Dashboard placeholder, Tasks placeholder, Cases, Clients, Documents placeholder), settings area with tabs.
- Design system for the workspace: tables with sortable columns, filter chips, side panels, dialogs, empty states, badges; neutral colors, consistent spacing, dark mode. Built by hand, matched to CasePingo's brand, not copied from any product.
- Firm settings: General (name, time zone, default assignee). Logo upload moves to Phase 4 with the client portal branding, since it needs file storage (Phase 3).
- Clients: structured profile (first and last name, date of birth, country of birth, citizenship, phone, preferred language, A-Number encrypted, tags), client table with filters, client page with tabs (Overview, Cases, Activity).
- Cases: assignee and category on every case, case table with filters (status, form, client, assignee, tags), side panel, new case dialog, export CSV.

### Phase 2: Tasks, calendar, matters
- Tasks with status, type, priority, assignee, due date, links to case, client or matter; comments with @mentions; list and calendar views; my tasks and team tasks; task reminders in the inbox.
- Matters and groups: create, add cases, filter cases, tasks and documents by matter.
- Deadlines appear on the calendar beside tasks.

### Phase 3: Documents and client document requests
- Private file storage (Supabase Storage, encrypted, signed short-lived links, virus-type and size checks, 25 MB limit).
- Documents page and per-case/per-client document lists.
- Document requests built from the case-type checklists already in CasePingo, editable per request; due date; message to the client in English or Spanish.
- Client upload page by secure link (no password), works on phones, camera photo or file; firm reviews: accept, or ask again with a reason.
- Request progress on case and client pages, inbox items when a client uploads, reminders before the due date.

### Phase 4: Client portal
- One portal per client: status of every case, open requests, uploads, firm contact, English and Spanish.
- Firm branding: logo on portal and client emails, firm portal address.

### Phase 5: Dashboard and reports
- Charts from the firm's own data only: volume by form or category, status overview, by assignee, days waiting, stuck cases, upcoming deadlines, open requests.
- Filters by date range, assignee and matter; CSV export of each report.

### Phase 6: Notifications, sync and team
- Personal notification settings (inbox view, backup while away, task updates, case update emails by type and by case set).
- Sync page: schedule by plan, check now, recent runs and health.
- Team page: role labels (Attorney, Paralegal), active cases, last active.

### Phase 7: Plans, billing, legal and data
- New plan tiers in Stripe, plan limits enforced, plan and billing page with usage.
- Legal and data page: export everything (archive), delete everything (request flow), inactivity policy, analytics choice.

### Technical items to build later (noted, not started)
| Item | What it needs | Notes |
|---|---|---|
| SMS to clients | Twilio account and phone number, A2P 10DLC registration | Request links and status updates by text; opt-in and STOP handling |
| Email at scale | Transactional email provider (Postmark, Resend or Amazon SES) with the firm's domain verified (SPF, DKIM, DMARC) | Today email goes through SMTP |
| Google Calendar | Google OAuth app and verification | Read-only view of meetings beside tasks |
| Outlook calendar | Microsoft app registration | Same as Google |
| File scanning | Malware scanning service for uploads | Before Phase 3 goes to all firms |
| Consular (CEAC) and DOL tracking | An official data source or API | Not built while the only way is scraping |
| E-signature | Provider such as Dropbox Sign | For engagement letters, later |

## 4. Technology
- Website and API: Next.js on Node.js (TypeScript), already running in production on Vercel. We stay on it: switching to Angular would mean rebuilding everything that is live today for no gain to firms.
- Database and files: Supabase Postgres with row-level security, Supabase Storage for documents, Supabase Auth.
- Background jobs: Inngest (own project).
- Payments: Stripe.
- Mobile app (individuals): Expo.
