import { describe, expect, it } from "vitest";
import { MIN_GROUP, buildInsights, kindOf, toPoolCase, type CaseForInsights, type PoolCase } from "../insights";

const NOW = new Date("2026-11-07T12:00:00Z");
const opts = { now: NOW, mode: "production" as const };
const add = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

let seq = 0;
type Mk = { owner?: string; office?: string; form?: string; history: [string, string][]; submitted?: string };
/** A stored case: USCIS's history (date, status), the current status is the last entry. */
function mk(o: Mk): CaseForInsights & { ownerUserId: string } {
  seq++;
  const last = o.history.at(-1)!;
  return {
    ownerUserId: o.owner ?? `user-${seq}`,
    receiptMasked: `${o.office ?? "LIN"}*******${String(seq % 1000).padStart(3, "0")}`,
    formType: o.form ?? "I-485",
    statusTitleEn: last[1],
    statusTitleEs: null,
    uscisHistory: o.history.map(([d, t]) => ({ date: { raw: d, local: `${d}T00:00:00` }, textEn: t, textEs: null })),
    uscisSubmittedRaw: o.submitted ?? null,
    uscisModifiedRaw: last[0],
    lastChangeObservedAt: null,
  };
}
const poolOf = (cases: (CaseForInsights & { ownerUserId: string })[]): PoolCase[] => cases.map((c) => toPoolCase(c, NOW)!);
const times = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

const RECEIVED = "Case Was Received";
const FINGERPRINTS = "Fingerprints Were Taken";
const REVIEW = "Case Is Being Actively Reviewed By USCIS";
const INTERVIEW = "Interview Was Scheduled";
const APPROVED = "Case Was Approved";
const DENIED = "Case Was Denied";
const RFE = "Request for Additional Evidence Was Sent";

describe("kinds of updates", () => {
  it("groups USCIS statuses into the activity kinds", () => {
    expect(kindOf(RECEIVED)).toBe("processing");
    expect(kindOf(FINGERPRINTS)).toBe("processing");
    expect(kindOf(RFE)).toBe("evidence");
    expect(kindOf("Response To USCIS' Request For Evidence Was Received")).toBe("processing");
    expect(kindOf(INTERVIEW)).toBe("interview");
    expect(kindOf(APPROVED)).toBe("approved");
    expect(kindOf("Card Was Mailed To Me")).toBe("card");
    expect(kindOf(DENIED)).toBe("denied");
    expect(kindOf("Case Was Transferred And A New Office Has Jurisdiction")).toBe("other");
  });
});

describe("buildInsights", () => {
  const viewer = mk({ owner: "me", history: [["2026-09-01", RECEIVED], ["2026-09-20", FINGERPRINTS]] });

  it("always has the person's own numbers and the status library's next step, even with no other cases", () => {
    const r = buildInsights(viewer, [], opts);
    expect(r.form).toMatchObject({ code: "I-485" });
    expect(r.yourCase).toMatchObject({ filed: "2026-09-01", days: 67, finished: false, daysAtStatus: 48, lastUpdate: "2026-09-20", office: { code: "LIN" } });
    expect(r.guideNext?.en).toBeTruthy();
    expect(r).toMatchObject({ poolSize: null, next: null, similar: null, offices: null, rates: null, trend: null, minGroup: MIN_GROUP });
    expect(r.activity.every((a) => a.cases === null)).toBe(true);
  });

  it("what usually comes next: the status other cases got right after this one, with shares and median days", () => {
    const moved = [
      ...times(8, (i) => mk({ history: [[add("2026-01-01", i), RECEIVED], [add("2026-01-21", i), FINGERPRINTS], [add("2026-02-20", i), REVIEW]] })),
      ...times(4, (i) => mk({ history: [[add("2026-01-01", i), RECEIVED], [add("2026-01-21", i), FINGERPRINTS], [add("2026-04-21", i), INTERVIEW]] })),
    ];
    const r = buildInsights(viewer, poolOf(moved), opts);
    expect(r.next).toEqual({
      cases: 12,
      options: [
        { title: { en: REVIEW, es: REVIEW }, share: 67, cases: 8, medianDays: 30, avgDays: 30 },
        { title: { en: INTERVIEW, es: INTERVIEW }, share: 33, cases: 4, medianDays: 90, avgDays: 90 },
      ],
    });
  });

  it("shows nothing for a group under the minimum, and leaves the viewer's own cases out of comparisons", () => {
    const nine = times(9, (i) => mk({ history: [[add("2026-01-01", i), RECEIVED], [add("2026-01-21", i), FINGERPRINTS], [add("2026-02-20", i), REVIEW]] }));
    // The viewer's other cases don't count as "others".
    const mine = times(3, (i) => mk({ owner: "me", history: [[add("2026-01-01", i), RECEIVED], [add("2026-01-21", i), FINGERPRINTS], [add("2026-02-20", i), REVIEW]] }));
    expect(buildInsights(viewer, poolOf([...nine, ...mine]), opts).next).toBeNull();
    const ten = [...nine, mk({ history: [["2026-01-05", RECEIVED], ["2026-01-25", FINGERPRINTS], ["2026-02-24", REVIEW]] })];
    expect(buildInsights(viewer, poolOf([...ten, ...mine]), opts).next?.cases).toBe(10);
  });

  it("cases filed near yours: where they are on the line map and how many you're ahead of", () => {
    const filed = "2026-06-01";
    const near = [
      ...times(3, (i) => mk({ history: [[add(filed, i - 10), RECEIVED]] })),
      ...times(4, (i) => mk({ history: [[add(filed, i + 5), RECEIVED], [add(filed, i + 25), FINGERPRINTS]] })),
      ...times(3, (i) => mk({ history: [[add(filed, -i - 20), RECEIVED], [add(filed, 60), APPROVED]] })),
    ];
    const far = times(5, (i) => mk({ history: [[add("2025-01-01", i), RECEIVED]] }));
    const mineNear = mk({ owner: "me", history: [[filed, RECEIVED]] });
    const me = mk({ owner: "me", history: [[filed, RECEIVED], ["2026-06-20", FINGERPRINTS]] });
    const r = buildInsights(me, poolOf([...near, ...far, mineNear]), opts);
    // 3 cases are further along (approved), so this case ranks 4th of 11 (the 10 others and itself).
    expect(r.similar).toMatchObject({ cases: 10, aheadOf: 30, approvedShare: 30, rank: 4, of: 11 });
    expect(r.similar!.steps.map((s) => [s.key, s.cases, s.you])).toEqual([
      ["received", 3, false],
      ["biometrics", 4, true],
      ["review", 0, false],
      ["decision", 3, false],
      ["card-mailed", 0, false],
      ["card-delivered", 0, false],
    ]);
  });

  it("time to approval by office: medians for offices with enough approvals, longest first; small offices only count in the overall median", () => {
    const approvedAfter = (office: string, days: number, n: number) =>
      times(n, (i) => mk({ office, history: [[add("2025-06-01", i), RECEIVED], [add(add("2025-06-01", i), days), APPROVED]] }));
    const pool = poolOf([...approvedAfter("LIN", 200, 12), ...approvedAfter("NBC", 300, 10), ...approvedAfter("MSC", 100, 5)]);
    const r = buildInsights(viewer, pool, opts);
    expect(r.offices).toEqual({
      overallMedianDays: 200,
      cases: 27,
      rows: [
        { code: "NBC", name: expect.anything(), medianDays: 300, cases: 10, yours: false },
        { code: "LIN", name: expect.anything(), medianDays: 200, cases: 12, yours: true },
      ],
    });
  });

  it("approval rate among decided cases and the share that got an evidence request", () => {
    const pool = poolOf([
      ...times(9, (i) => mk({ history: [[add("2026-01-01", i), RECEIVED], [add("2026-05-01", i), APPROVED]] })),
      ...times(3, (i) => mk({ history: [[add("2026-01-01", i), RECEIVED], [add("2026-03-01", i), RFE], [add("2026-06-01", i), APPROVED]] })),
      ...times(3, (i) => mk({ history: [[add("2026-01-01", i), RECEIVED], [add("2026-06-01", i), DENIED]] })),
      ...times(5, (i) => mk({ history: [[add("2026-02-01", i), RECEIVED], [add("2026-04-01", i), RFE]] })),
    ]);
    const r = buildInsights(viewer, pool, opts);
    expect(r.rates).toEqual({ approval: { rate: 80, decided: 15 }, rfe: { rate: 40, cases: 20 } });
    expect(r.poolSize).toBe(20);
  });

  it("updates by kind today, this month and this year (small groups fold into Others), monthly approvals and the trend", () => {
    const pool = poolOf([
      ...times(10, (i) => mk({ history: [[add("2026-03-01", i), RECEIVED], ["2026-11-05", APPROVED]] })),
      ...times(2, (i) => mk({ history: [[add("2026-03-01", i), RECEIVED], ["2026-11-06", DENIED]] })),
    ]);
    const r = buildInsights(viewer, pool, opts);
    const by = (w: string) => r.activity.find((a) => a.window === w)!;
    expect(by("day")).toMatchObject({ from: "2026-11-07", cases: null, kinds: [] });
    expect(by("month").cases).toBe(12);
    expect(by("month").from).toBe("2026-11-01");
    expect(by("month").kinds.map((k) => [k.key, k.cases, k.share])).toEqual([
      ["approved", 10, 83.3],
      ["other", 2, 16.7],
    ]);
    expect(by("year").kinds.map((k) => [k.key, k.cases, k.share])).toEqual([
      ["processing", 12, 50],
      ["approved", 10, 41.7],
      ["other", 2, 8.3],
    ]);
    expect(r.monthly).toMatchObject({ month: "2026-11", lastMonth: "2026-10", today: 7, daysInMonth: 30, thisTotal: 10, lastTotal: 0 });
    expect(r.monthly!.thisMonth).toEqual([0, 0, 0, 0, 10, 10, 10]);
    expect(r.monthly!.last).toHaveLength(31);
    expect(r.trend?.total).toBe(12);
    expect(r.trend?.months).toHaveLength(12);
    expect(r.trend?.months.at(-1)).toEqual({ month: "2026-11", approved: 10, evidence: 0, denied: 2 });
    expect(r.trend?.months[0].month).toBe("2025-12");
    expect(r.dataAsOf).toBe("2026-11-06");
  });

  it("only compares with the same form", () => {
    const others = times(12, (i) => mk({ form: "I-765", history: [[add("2026-01-01", i), RECEIVED], [add("2026-01-21", i), FINGERPRINTS], [add("2026-02-20", i), REVIEW]] }));
    const r = buildInsights(viewer, poolOf(others), opts);
    expect(r).toMatchObject({ poolSize: null, next: null });
  });
});
