import { config } from "./config";
import { supabase } from "./supabase";

/** Calls the CasePingo mobile API (docs/MOBILE-API.md) with the signed-in user's token. */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "offline", "We couldn't reach CasePingo. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(json.error ?? "error"), String(json.message ?? "Something went wrong."), json.field as string | undefined);
  return json as T;
}

// ---- Shapes returned by the API -------------------------------------------------

export type Plan = {
  id: "FREE" | "PREMIUM";
  name: string;
  maxCases: number;
  cadence: string;
  autoChecks: boolean;
  alerts: boolean;
  manualChecksPerDay: number;
  trialEndsAt: string | null;
};
export type Me = {
  id: string;
  email: string;
  name: string | null;
  locale: "en" | "es";
  twoFactor: boolean;
  plan: Plan;
  cases: { count: number; pausedByPlan: number };
  alerts: { email: boolean; push: boolean };
};
export type StatusCategory = "progress" | "action" | "done" | "stop" | "none";
export type GuideText = { meaning: string; next: string; todo: string | null };
type Bilingual = { en: string; es: string };

export type CaseSummary = {
  id: string;
  receiptMasked: string;
  nickname: string | null;
  trackingStatus: "ACTIVE" | "PAUSED";
  pausedReason: string | null;
  formType: string | null;
  statusTitleEn: string | null;
  statusTitleEs: string | null;
  lastCheckedAt: string | null;
  lastChangeObservedAt: string | null;
  lastCheckOutcome: string | null;
  createdAt: string;
  category: StatusCategory;
  /** Step on the progress line (0–3), null before the first check. */
  stage: number | null;
  form: { code: string; name: Bilingual | null } | null;
  /** Set while CasePingo saw this case become approved in the last 30 days. */
  recentApprovalAt: string | null;
};
export type CaseDetail = Omit<CaseSummary, "recentApprovalAt"> & {
  statusDescriptionEn: string | null;
  statusDescriptionEs: string | null;
  uscisSubmittedRaw: string | null;
  uscisModifiedRaw: string | null;
  uscisHistory: { date?: { raw?: string } | null; textEn?: string | null; textEs?: string | null; category: StatusCategory }[] | null;
  events: { id: string; statusTitleEn: string | null; statusTitleEs: string | null; uscisReportedRaw: string | null; firstObservedAt: string; category: StatusCategory }[];
  consent: { basis: string; capturedAt: string } | null;
  guide: { slug: string; path: string; en: GuideText; es: GuideText } | null;
  office: { code: string; name: Bilingual | null } | null;
  processingTimesUrl: string;
  celebration: { approvedAt: string; nextStep: Bilingual | null } | null;
};
export type AppConfig = {
  consent: { version: string; options: { basis: "SELF" | "AUTHORIZED_BY_APPLICANT"; label: string; statement: string }[]; footnote: string };
  receiptHint: string;
  uscisCaseStatusUrl: string;
};

export type GuideEntry = {
  slug: string;
  heading: string;
  wordings: string[];
  category: StatusCategory;
  stage: number | null;
  path: string;
  en: GuideText;
  es: GuideText;
};

// ---- Visa Bulletin ---------------------------------------------------------------

export type BulletinArea = "ALL" | "CHINA" | "INDIA" | "MEXICO" | "PHILIPPINES";
export type BulletinChartKey = "familyFinal" | "familyFiling" | "employmentFinal" | "employmentFiling";
/** `move` is null for the first month on record; `changed` is false for "No change". */
export type BulletinCell = { value: Bilingual; move: ({ tone: "good" | "bad" | "neutral"; changed: boolean } & Bilingual) | null };
export type BulletinRow = { category: string; code: string; en: string; es: string; cells: Partial<Record<BulletinArea, BulletinCell>> };
export type BulletinWatch = { category: string; area: BulletinArea; chart: "final" | "filing" };
export type BulletinCategory = { key: string; kind: "family" | "employment"; code: string; en: string; es: string };
export type BulletinResponse = {
  bulletin: {
    month: string;
    label: Bilingual;
    previousMonth: string | null;
    sourceUrl: string | null;
    importedAt: string;
    rows: Partial<Record<BulletinChartKey, BulletinRow[]>>;
  } | null;
  catalog: { areas: ({ key: BulletinArea } & Bilingual)[]; categories: BulletinCategory[] };
  watch: BulletinWatch | null;
  /** The person's plan includes alerts (Premium). */
  alerts: boolean;
  links: { bulletin: string; uscisCharts: string };
};

export const bulletinChartKey = (kind: "family" | "employment", type: "final" | "filing"): BulletinChartKey =>
  `${kind}${type === "final" ? "Final" : "Filing"}` as BulletinChartKey;
