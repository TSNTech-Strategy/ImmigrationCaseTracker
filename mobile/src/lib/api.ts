import { config } from "./config";
import { supabase } from "./supabase";
import type { Tag } from "./tags";

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

/** The steps this kind of case goes through and where it is (server: src/lib/journeys.ts). */
export type LineMapTone = "progress" | "action" | "done" | "stop";
export type LineMapStep = { key: string; label: Bilingual; state: "done" | "current" | "upcoming"; /** "YYYY-MM-DD" */ date: string | null };
export type LineMap = {
  scenario: string;
  name: Bilingual;
  steps: LineMapStep[];
  current: number;
  tone: LineMapTone;
  marker: Bilingual | null;
  outcome: "approved" | "denied" | "rejected" | "withdrawn" | "closed" | null;
  finished: boolean;
};
export type CaseDays = { filed: string | null; lastUpdate: string | null; total: number | null; sinceUpdate: number | null };

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
  /** The person's own tags on this case, A to Z. */
  tags: Tag[];
  /** Missing from servers older than the line map. */
  lineMap?: LineMap;
  days?: CaseDays;
};
export type CaseDetail = Omit<CaseSummary, "recentApprovalAt"> & {
  /** The document checklist for this case's form (older servers don't send it). */
  checklist?: { key: string; form: string; title: Bilingual } | null;
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

/** One status change in the Updates tab. `first` is the status when tracking started. */
export type UpdateItem = {
  id: string;
  caseId: string;
  nickname: string | null;
  receiptMasked: string;
  form: { code: string; name: Bilingual | null } | null;
  statusTitleEn: string | null;
  statusTitleEs: string | null;
  category: StatusCategory;
  at: string;
  reportedDate: string | null;
  first: boolean;
};

/** All of the person's cases on one timeline. */
export type JourneyResponse = {
  start: string | null;
  end: string | null;
  totalDays: number | null;
  cases: {
    id: string;
    nickname: string | null;
    receiptMasked: string;
    form: { code: string; name: Bilingual | null } | null;
    office: { code: string; name: Bilingual | null } | null;
    statusTitleEn: string | null;
    statusTitleEs: string | null;
    start: string;
    end: string;
    days: number;
    finished: boolean;
    tone: LineMapTone;
  }[];
  milestones: { date: string; day: number; caseId: string; form: string | null; titleEn: string | null; titleEs: string | null; category: StatusCategory }[];
};

export type InsightsKind = "card" | "approved" | "processing" | "interview" | "evidence" | "denied" | "other";
export type InsightsWindow = "day" | "month" | "year";
/** GET /api/v1/cases/:id/insights: anonymous totals from CasePingo cases like this one (null sections: not enough cases yet). */
export type Insights = {
  form: { code: string; name: Bilingual | null } | null;
  mode: "mock" | "sandbox" | "production";
  minGroup: number;
  similarWindowDays: number;
  poolSize: number | null;
  dataAsOf?: string | null;
  monthly?: { month: string; lastMonth: string; today: number; daysInMonth: number; thisMonth: number[]; last: number[]; thisTotal: number; lastTotal: number } | null;
  yourCase: { filed: string | null; days: number | null; finished: boolean; daysAtStatus: number | null; lastUpdate?: string | null; office: { code: string; name: Bilingual | null } | null; status: Bilingual | null };
  guideNext: Bilingual | null;
  next: { cases: number; options: { title: Bilingual; share: number; cases: number; medianDays: number | null; avgDays?: number | null }[] } | null;
  similar: { cases: number; steps: { key: string; label: Bilingual; cases: number; you: boolean }[]; aheadOf: number; approvedShare: number; rank?: number; of?: number } | null;
  offices: { overallMedianDays: number | null; cases: number; rows: { code: string; name: Bilingual | null; medianDays: number; cases: number; yours: boolean }[] } | null;
  rates: { approval: { rate: number; decided: number } | null; rfe: { rate: number; cases: number } | null } | null;
  activity: { window: InsightsWindow; from?: string; cases: number | null; kinds: { key: InsightsKind; label: Bilingual; cases: number; share: number }[] }[];
  trend: { months: { month: string; approved: number; evidence: number; denied: number }[]; total: number } | null;
  processingTimesUrl: string;
};

export type ChecklistItem = { key: string; title: Bilingual; detail?: Bilingual; required: boolean };
export type Checklist = { key: string; form: string; title: Bilingual; summary: Bilingual; groups: { key: string; title: Bilingual; items: ChecklistItem[] }[]; tips: Bilingual[]; links: { label: Bilingual; url: string }[] };
/** GET /api/v1/checklists */
export type ChecklistsResponse = { reviewed: string; tips: Bilingual[]; checklists: { key: string; form: string; title: Bilingual; summary: Bilingual; total: number; required: number; done: number; requiredDone: number }[] };
/** GET /api/v1/checklists/:key */
export type ChecklistResponse = { checklist: Checklist; done: string[]; tips: Bilingual[]; reviewed: string };
