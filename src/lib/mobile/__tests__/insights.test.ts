/** Case insights through the app API against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { createInsightsService } from "@/lib/insights";
import { createMobileApi } from "../handlers";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("app API: case insights", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = () => new Date("2026-11-07T12:00:00Z");
  const uscis: UscisPort = { mode: "mock", getCaseStatus: async () => ({ httpStatus: 500, attempts: 1, durationMs: 1 }) as never };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const users: string[] = [];
  const firms: string[] = [];
  const body = (r: { body: unknown }) => r.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const mkUser = async () => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `ins-${id}@test.dev`, name: "Insights", plan: "PREMIUM" } });
    users.push(id);
    return id;
  };
  const history = (rows: [string, string][]) => rows.map(([d, t]) => ({ date: { raw: d, local: `${d}T00:00:00` }, textEn: t, textEs: null }));
  /** A case with USCIS data set directly (as if checked): received, fingerprints, then the given next status. */
  const mkCase = async (owner: { ownerUserId: string } | { firmId: string }, o: { digest?: string; source: string | null; next?: string; i: number }) => {
    const rows: [string, string][] = [
      ["2026-01-01", "Case Was Received"],
      ["2026-01-21", "Fingerprints Were Taken"],
    ];
    if (o.next) rows.push([`2026-02-${String(10 + (o.i % 10)).padStart(2, "0")}`, o.next]);
    const c = await db.trackedCase.create({
      data: {
        ...owner,
        receiptEncrypted: "x",
        receiptDigest: o.digest ?? `ins-${randomUUID()}`,
        receiptMasked: "LIN*******123",
        formType: "I-485",
        statusTitleEn: rows.at(-1)![1],
        uscisHistory: history(rows),
        uscisModifiedRaw: rows.at(-1)![0],
        statusSource: o.source,
        lastCheckedAt: new Date(`2026-11-0${1 + (o.i % 5)}T00:00:00Z`),
      },
    });
    return c.id;
  };

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.firm.deleteMany({ where: { id: { in: firms } } });
    await db.$disconnect();
  });

  it("counts each real case once, leaves out firm cases and other connections, and only shows the person's own case", async () => {
    const viewer = await mkUser();
    const mine = await mkCase({ ownerUserId: viewer }, { source: "production", i: 0 });
    // 10 other people whose cases moved on from fingerprints to review…
    for (let i = 0; i < 10; i++) await mkCase({ ownerUserId: await mkUser() }, { source: "production", next: "Case Is Being Actively Reviewed By USCIS", i });
    // …one receipt that two people track (counted once)…
    const shared = `ins-shared-${randomUUID()}`;
    await mkCase({ ownerUserId: await mkUser() }, { digest: shared, source: "production", next: "Interview Was Scheduled", i: 1 });
    await mkCase({ ownerUserId: await mkUser() }, { digest: shared, source: "production", next: "Interview Was Scheduled", i: 2 });
    // …and cases that must not count: sandbox data, a case never checked, and a law firm's case.
    for (let i = 0; i < 3; i++) await mkCase({ ownerUserId: await mkUser() }, { source: "sandbox", next: "Case Was Denied", i });
    await mkCase({ ownerUserId: await mkUser() }, { source: null, next: "Case Was Denied", i: 3 });
    const firm = await db.firm.create({ data: { name: `Insights Firm ${randomUUID()}` } });
    firms.push(firm.id);
    for (let i = 0; i < 3; i++) await mkCase({ firmId: firm.id }, { source: "production", next: "Case Was Denied", i });

    const api = createMobileApi({ db, cases, now, insights: createInsightsService({ db, mode: "production", now }) });
    const r = await api.caseInsights(viewer, mine);
    expect(r.status).toBe(200);
    const ins = body(r).insights;
    expect(ins).toMatchObject({ mode: "production", poolSize: 12, form: { code: "I-485" }, yourCase: { office: { code: "LIN" } } });
    expect(ins.next).toEqual({
      cases: 11,
      options: [
        { title: { en: "Case Is Being Actively Reviewed By USCIS", es: "Case Is Being Actively Reviewed By USCIS" }, share: 91, cases: 10, medianDays: expect.any(Number), avgDays: expect.any(Number) },
        { title: { en: "Interview Was Scheduled", es: "Interview Was Scheduled" }, share: 9, cases: 1, medianDays: expect.any(Number), avgDays: expect.any(Number) },
      ],
    });
    // Nothing about any other case leaks: no receipts, owners or nicknames anywhere in the answer.
    expect(JSON.stringify(ins)).not.toMatch(/LIN\*{7}123|ins-|@test\.dev/);

    // Another person can't ask about this case.
    expect((await api.caseInsights(await mkUser(), mine)).status).toBe(404);
    // Under a different connection (simulated data) the real cases don't count.
    const mockApi = createMobileApi({ db, cases, now, insights: createInsightsService({ db, mode: "mock", now }) });
    expect(body(await mockApi.caseInsights(viewer, mine)).insights).toMatchObject({ poolSize: null, next: null });
  });
});
