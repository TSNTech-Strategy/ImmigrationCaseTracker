/** Line maps, the Updates feed and the journey against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { CONSENT_STATEMENT_VERSION } from "@/lib/cases/consent";
import { normalizeCaseStatus } from "@/lib/uscis/normalize";
import { createMobileApi } from "../handlers";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("app API: line maps, updates and journey", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = () => new Date("2026-11-03T12:00:00Z");
  const uscis: UscisPort = {
    mode: "mock",
    getCaseStatus: async (r) => ({ httpStatus: 200, attempts: 1, durationMs: 1, snapshot: normalizeCaseStatus({ case_status: { receiptNumber: r, current_case_status_text_en: "Case Was Received" } }, r) }),
  };
  const cases = createCaseService({ db, uscis, now, env: {} });
  const api = createMobileApi({ db, cases, now });
  const users: string[] = [];
  const body = (r: { body: unknown }) => r.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  let n = 103700;
  const mkUser = async () => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `j-${id}@test.dev`, name: "Journey", plan: "PREMIUM" } });
    users.push(id);
    return id;
  };
  /** A case with its USCIS state set directly (as if checked over time). */
  const mkCase = async (u: string, data: { formType: string; status: string; history: [string, string][]; submitted: string; modified: string; events: [string, string][] }) => {
    const r = await api.addCase(u, { receipt: `MSC2490${n++}`.padEnd(13, "0").slice(0, 13), basis: "SELF", consent: true, statementVersion: CONSENT_STATEMENT_VERSION });
    expect(r.status).toBe(201);
    const id = body(r).caseId as string;
    await db.caseStatusEvent.deleteMany({ where: { caseId: id } });
    await db.trackedCase.update({
      where: { id },
      data: {
        formType: data.formType,
        statusTitleEn: data.status,
        uscisSubmittedRaw: data.submitted,
        uscisModifiedRaw: data.modified,
        uscisHistory: data.history.map(([date, textEn]) => ({ date: { raw: date, local: `${date}T00:00:00` }, textEn, textEs: null })),
      },
    });
    for (const [title, at] of data.events) {
      await db.caseStatusEvent.create({ data: { caseId: id, formType: data.formType, statusTitleEn: title, fingerprint: `${title}-${at}`, firstObservedAt: new Date(at) } });
    }
    return id;
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 2).toString("base64");
  });
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("cases carry their line map and day counts; updates list changes newest first; the journey puts all cases on one timeline", async () => {
    const u = await mkUser();
    const asylee = await mkCase(u, {
      formType: "I-730",
      status: "Case Was Approved",
      submitted: "02-20-2020",
      modified: "02-08-2022",
      history: [["2020-02-20", "Case Was Received"]],
      events: [["Case Was Approved", "2022-02-09T10:00:00Z"]],
    });
    const greenCard = await mkCase(u, {
      formType: "I-485",
      status: "Card Was Delivered To Me By The Post Office",
      submitted: "02-26-2021",
      modified: "02-15-2023",
      history: [
        ["2021-02-26", "Case Was Received"],
        ["2021-03-11", "Fingerprints Were Taken"],
        ["2023-01-20", "Case Was Approved"],
      ],
      events: [
        ["Case Was Approved", "2023-01-21T10:00:00Z"],
        ["Card Was Delivered To Me By The Post Office", "2023-02-15T18:00:00Z"],
      ],
    });

    const list = body(await api.listCases(u)).cases as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const gc = list.find((c) => c.id === greenCard)!;
    expect(gc.uscisHistory).toBeUndefined();
    expect(gc.events).toBeUndefined();
    expect(gc.lineMap).toMatchObject({ scenario: "green-card", current: 5, finished: true, tone: "done" });
    expect(gc.lineMap.steps.map((s: { date: string | null }) => s.date)).toEqual(["2021-02-26", "2021-03-11", null, "2023-01-20", null, "2023-02-15"]);
    expect(gc.days).toEqual({ filed: "2021-02-26", lastUpdate: "2023-02-15", total: 719, sinceUpdate: daysTo("2023-02-15") });
    const detail = body(await api.getCase(u, asylee)).case;
    expect(detail.lineMap).toMatchObject({ scenario: "asylee-relative", current: 2, finished: true });
    expect(detail.days).toMatchObject({ filed: "2020-02-20", total: 719 });

    const updates = body(await api.updates(u)).updates as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(updates.map((x) => [x.statusTitleEn, x.first])).toEqual([
      ["Card Was Delivered To Me By The Post Office", false],
      ["Case Was Approved", true],
      ["Case Was Approved", true],
    ]);
    expect(updates[0]).toMatchObject({ caseId: greenCard, receiptMasked: expect.stringMatching(/^MSC\*+\d{3}$/), form: { code: "I-485" }, category: "done" });
    expect(await api.updates(await mkUser())).toEqual({ status: 200, body: { updates: [] } });

    const j = body(await api.journey(u));
    expect(j).toMatchObject({ start: "2020-02-20", end: "2023-02-15", totalDays: 1091 });
    expect(j.cases.map((c: { form: { code: string }; days: number; finished: boolean }) => [c.form.code, c.days, c.finished])).toEqual([
      ["I-730", 719, true],
      ["I-485", 719, true],
    ]);
    expect(j.cases[1].office).toMatchObject({ code: "MSC" });
    expect(j.milestones.map((m: { date: string; day: number; form: string; titleEn: string }) => `${m.date} D${m.day} ${m.form} ${m.titleEn}`)).toEqual([
      "2020-02-20 D0 I-730 Case Was Received",
      "2021-02-26 D372 I-485 Case Was Received",
      "2021-03-11 D385 I-485 Fingerprints Were Taken",
      "2022-02-09 D720 I-730 Case Was Approved",
      "2023-01-20 D1065 I-485 Case Was Approved",
      "2023-01-21 D1066 I-485 Case Was Approved",
      "2023-02-15 D1091 I-485 Card Was Delivered To Me By The Post Office",
    ]);
    expect(body(await api.journey(await mkUser()))).toEqual({ start: null, end: null, totalDays: null, cases: [], milestones: [] });
  });

  it("a case with no USCIS history or filing date takes its dates from the changes CasePingo saw, the same on My cases and My timeline", async () => {
    const u = await mkUser();
    const id = await mkCase(u, {
      formType: "I-765",
      status: "Case Was Approved",
      submitted: "",
      modified: "",
      history: [],
      events: [
        ["Case Was Received", "2026-06-01T10:00:00Z"],
        ["Case Was Approved", "2026-09-15T10:00:00Z"],
      ],
    });
    await db.trackedCase.update({ where: { id }, data: { uscisSubmittedRaw: null, uscisModifiedRaw: null, uscisHistory: [], lastChangeObservedAt: new Date("2026-09-15T10:00:00Z") } });
    const [listed] = body(await api.listCases(u)).cases as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(listed.lineMap.steps.map((s: { date: string | null }) => s.date)).toEqual(["2026-06-01", null, null, "2026-09-15", null, null]);
    expect(listed.days).toMatchObject({ filed: "2026-06-01", lastUpdate: "2026-09-15", total: 155 });
    const j = body(await api.journey(u));
    expect(j).toMatchObject({ start: listed.days.filed, totalDays: listed.days.total });
  });

  /** Days from a date to the test's "today" (2026-11-03). */
  function daysTo(d: string) {
    return Math.round((Date.parse("2026-11-03T00:00:00Z") - Date.parse(`${d}T00:00:00Z`)) / 86_400_000);
  }
});
