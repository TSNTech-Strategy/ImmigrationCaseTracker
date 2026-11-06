import { CIVICS_LINKS, civicsTest, CURRENT } from "@/lib/civics";
import { FIRM_PLANS, formatUsd, PLAN_LIMITS, PREMIUM_TRIAL_DAYS, PRICES } from "@/lib/plans";
import { RESOURCES } from "@/lib/resources";
import { SITE } from "@/lib/site";
import { guideHeading, STATUS_GUIDE } from "@/lib/status-guide";
import { CATEGORIES, STATE_BULLETIN_URL, USCIS_CHARTS_URL } from "@/lib/visa-bulletin/model";

/**
 * The reference material the assistant answers from: CasePingo's own reviewed
 * content (status library, guides, civics test, Visa Bulletin guide, plans),
 * in English. Built from the same modules the website and app show, so the
 * assistant never drifts from them.
 *
 * Must be deterministic (no dates or random order): it's the cached prefix of
 * every request, and any change makes the next request pay to cache it again.
 */

const SITE_URL = `https://${SITE.domain}`;
const abs = (url: string) => (url.startsWith("/") ? `${SITE_URL}${url}` : url);

function casepingo(): string {
  const free = PLAN_LIMITS.FREE;
  const premium = PLAN_LIMITS.PREMIUM;
  return [
    "## CasePingo",
    `CasePingo (${SITE_URL}, and apps for iPhone and Android) tracks USCIS cases. ${SITE.disclaimer}`,
    "- Add a case with its 13-character USCIS receipt number (3 letters and 10 digits, for example IOE0123456789; common prefixes are IOE, EAC, WAC, LIN, SRC, NBC, MSC and YSC). It's printed on the receipt notice (Form I-797C), near the top left. In the app you can also scan the notice with the camera; the photo is read on the phone and isn't uploaded.",
    "- CasePingo gets the status from USCIS's official case status service, saves every change in a timeline next to the history USCIS reports, and explains each status in plain English and Spanish.",
    "- The official place to check a case is USCIS Case Status Online: https://egov.uscis.gov/ . A USCIS online account (https://my.uscis.gov/) can show more, such as notices, for cases filed online or linked to the account.",
    `- Free plan: ${free.maxCases} case, checked only when the person taps Check now (up to ${free.manualChecksPerDay} times a day); no automatic checks or alerts; ${free.assistantPerDay} assistant questions a day.`,
    `- Premium (${formatUsd(PRICES.premium.monthly)} a month or ${formatUsd(PRICES.premium.yearly)} a year): up to ${premium.maxCases} cases, checked automatically about twice a day, with email and phone alerts when a status changes; ${premium.assistantPerDay} assistant questions a day. New accounts get ${PREMIUM_TRIAL_DAYS} days of Premium free. Plans are managed on the website (Settings, Plan).`,
    `- Law firms: ${FIRM_PLANS.SOLO.label} (${formatUsd(FIRM_PLANS.SOLO.price)} a month, up to ${FIRM_PLANS.SOLO.maxCases} cases, ${FIRM_PLANS.SOLO.maxUsers} users) and ${FIRM_PLANS.FIRM.label} (${formatUsd(FIRM_PLANS.FIRM.price)} a month, up to ${FIRM_PLANS.FIRM.maxCases} cases), with a shared workspace, clients, CSV import and an activity log. Details: ${SITE_URL}/pricing`,
    `- Also in CasePingo: the status library (${SITE_URL}/status-guide), guides (${SITE_URL}/resources), civics test practice with USCIS's official questions (${SITE_URL}/civics-test; in the app: Resources, then Civics test practice), and a guide to the Visa Bulletin (${SITE_URL}/visa-bulletin; the app's Bulletin tab).`,
    "- Privacy: no ads and no tracking; receipt numbers are encrypted; two-factor sign-in is available; people can delete their account and data at any time in Settings. CasePingo never asks for A-numbers, passport numbers or documents.",
    "- CasePingo can't change a case, contact USCIS for someone, speed a case up, or predict a decision.",
  ].join("\n");
}

function statuses(): string {
  const lines = ["## USCIS case statuses (CasePingo's status library)", "USCIS's exact wording, then what it means, what usually happens next, and what the person can do."];
  for (const g of STATUS_GUIDE) {
    const names = [guideHeading(g), ...(g.heading ? [g.title] : []), ...(g.aliases ?? [])];
    lines.push(`### ${[...new Set(names)].join(" / ")}`);
    lines.push(`Means: ${g.meaning.en}`);
    lines.push(`Next: ${g.next.en}`);
    if (g.todo) lines.push(`To do: ${g.todo.en}`);
  }
  return lines.join("\n");
}

function guides(): string {
  const lines = ["## Guides (CasePingo's resource center)"];
  for (const r of RESOURCES) {
    lines.push(`### ${r.title.en} (${SITE_URL}/resources/${r.slug})`, r.intro.en);
    for (const s of r.sections) {
      lines.push(`${s.heading.en}:`);
      for (const p of s.paragraphs ?? []) lines.push(p.en);
      for (const b of s.bullets ?? []) lines.push(`- ${b.en}`);
    }
    for (const f of r.faq ?? []) {
      lines.push(`Q: ${f.q.en}`, `A: ${f.a.en}${(f.links ?? []).map((l) => ` ${abs(l.url)}`).join("")}`);
    }
    if (r.links.length) lines.push(`Links: ${r.links.map((l) => `${l.label.en} ${abs(l.url)}`).join("; ")}`);
  }
  return lines.join("\n");
}

function civics(): string {
  const t2025 = civicsTest("2025");
  const t2008 = civicsTest("2008");
  const lines = [
    "## The naturalization civics test",
    `- ${t2025.title.en}: ${t2025.who.en} ${t2025.format.en}`,
    `- ${t2008.title.en}: ${t2008.who.en} ${t2008.format.en}`,
    "- 65/20: people 65 or older who have been permanent residents for 20 years or more study only the 20 starred (*) questions; the officer asks 10 and 6 correct answers pass. They may also take the civics test in their own language.",
    "- The test is spoken, in English, at the naturalization interview, together with the English reading and writing tests (unless the person qualifies for an exception). People who fail a part are retested on that part, usually within 60 to 90 days.",
    `- Answers to "now" questions change with elections and appointments; USCIS lists them at ${CIVICS_LINKS.testUpdates}. As of ${CURRENT.asOf}: President ${CURRENT.president.answer}, Vice President ${CURRENT.vicePresident.answer}, Speaker of the House ${CURRENT.speaker.answer}, Chief Justice ${CURRENT.chiefJustice.answer}.`,
    `- Practice in CasePingo: ${SITE_URL}/civics-test (mock tests with the official pass and fail rules, practice by section, every answer). Official lists: ${t2025.listUrl} (2025) and ${t2008.listUrl} (2008).`,
    "### The 2025 test's 128 questions (* = 65/20), with USCIS's accepted answers",
  ];
  for (const q of t2025.questions) {
    const answers = q.kind === "local" ? `Answers vary by where the person lives.${q.note ? ` ${q.note}` : ""}` : q.answers.join("; ");
    lines.push(`${q.n}.${q.star ? "*" : ""} ${q.q} — ${answers}`);
  }
  return lines.join("\n");
}

function bulletin(): string {
  return [
    "## The Visa Bulletin",
    `The U.S. Department of State publishes it every month (${STATE_BULLETIN_URL}). It shows, for family and employment green card categories, which priority dates can move forward. CasePingo doesn't copy the dates; people read them on the official page.`,
    "- Priority date: on the I-797 approval or receipt notice for the petition (I-130 or I-140), or the labor certification filing date.",
    "- Find the category row and the country column (chargeability: usually the country of birth). \"C\" means current; a date means priority dates before it can move forward.",
    "- Final Action Dates: a green card can be approved. Dates for Filing: people may be able to file earlier. For adjustment of status in the U.S., USCIS says each month which chart to use: " + USCIS_CHARTS_URL,
    `- Categories: ${CATEGORIES.map((c) => `${c.code} (${c.en})`).join("; ")}. Immediate relatives of U.S. citizens (spouses, unmarried children under 21, and parents of citizens who are 21 or older) aren't in the bulletin: a visa is always available.`,
  ].join("\n");
}

/** The whole reference text. */
export function assistantKnowledge(): string {
  return ["# Reference material", casepingo(), statuses(), guides(), civics(), bulletin()].join("\n\n");
}
