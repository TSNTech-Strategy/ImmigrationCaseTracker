import { formInfo } from "@/lib/case-insights";

/** ISO 3166-1 two-letter codes (current countries and territories). Names come from Intl, so they stay correct. */
const CODES =
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code: string | null | undefined) => (code ? (regionNames.of(code) ?? code) : null);
export const COUNTRIES = CODES.map((code) => ({ code, name: countryName(code)! })).sort((a, b) => a.name.localeCompare(b.name, "en"));
export const isCountryCode = (v: string) => CODES.includes(v);

/** US time zones first, then a few others firms ask for. */
export const TIME_ZONES = [
  { id: "America/New_York", label: "Eastern (New York)" },
  { id: "America/Chicago", label: "Central (Chicago)" },
  { id: "America/Denver", label: "Mountain (Denver)" },
  { id: "America/Phoenix", label: "Mountain, no daylight saving (Phoenix)" },
  { id: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { id: "America/Anchorage", label: "Alaska (Anchorage)" },
  { id: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { id: "America/Puerto_Rico", label: "Atlantic (Puerto Rico)" },
  { id: "Pacific/Guam", label: "Chamorro (Guam)" },
] as const;
export const isTimeZone = (v: string) => TIME_ZONES.some((z) => z.id === v);

/** Broad case categories, from the form type, for filters and the dashboard. */
export const CASE_CATEGORIES = {
  family: { label: "Family", forms: ["I-130", "I-129F", "I-600", "I-600A", "I-800", "I-800A"] },
  employment: { label: "Employment", forms: ["I-140", "I-129", "I-526", "I-526E", "I-907"] },
  green_card: { label: "Green card", forms: ["I-485", "I-90", "I-751", "I-829", "I-485J"] },
  citizenship: { label: "Citizenship", forms: ["N-400", "N-600", "N-600K", "N-565", "N-336", "N-470"] },
  humanitarian: { label: "Humanitarian", forms: ["I-589", "I-821", "I-821D", "I-914", "I-918", "I-360", "I-730", "I-590", "I-881"] },
  permits: { label: "Work & travel permits", forms: ["I-765", "I-131", "I-131A", "I-539", "I-824", "I-102"] },
  waivers: { label: "Waivers", forms: ["I-601", "I-601A", "I-212", "I-192", "I-612"] },
} as const;
export type CaseCategory = keyof typeof CASE_CATEGORIES | "other";
export const CATEGORY_LABEL = (c: CaseCategory) => (c === "other" ? "Other" : CASE_CATEGORIES[c].label);

export function caseCategory(formType: string | null | undefined): CaseCategory {
  const code = formInfo(formType)?.code;
  if (!code) return "other";
  for (const [k, v] of Object.entries(CASE_CATEGORIES)) if ((v.forms as readonly string[]).includes(code)) return k as CaseCategory;
  return "other";
}

/** The ways a form type can be stored ("I-130", "I130", "i-130"), for a database filter by category. */
export function categoryFormVariants(cat: keyof typeof CASE_CATEGORIES): string[] {
  return CASE_CATEGORIES[cat].forms.flatMap((f) => [f, f.replace("-", ""), f.toLowerCase(), f.replace("-", "").toLowerCase()]);
}

/** "A123-456-789", "123456789" or "A 12345678" → nine digits (8-digit numbers get a leading 0), or null. */
export function cleanANumber(input: string): string | null {
  const digits = input.trim().replace(/^a/i, "").replace(/[\s-]/g, "");
  if (!/^\d{7,9}$/.test(digits)) return null;
  return digits.padStart(9, "0");
}
/** "A•••-••6-789": the last four digits only, in the usual A-Number layout. */
export const maskANumber = (last4: string | null | undefined) => (last4 ? `A•••-••${last4[0]}-${last4.slice(1)}` : null);
/** "A123-456-789" from nine digits. */
export const formatANumber = (digits: string) => `A${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;

/** A real past date within 120 years, as "YYYY-MM-DD", or null. */
export function cleanBirthDate(input: string, now: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input) return null;
  const years = (now.getTime() - d.getTime()) / (365.25 * 86_400_000);
  return years >= 0 && years <= 120 ? input : null;
}
