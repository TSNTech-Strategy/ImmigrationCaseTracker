/** Document checklists through the app API against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createCaseService, type UscisPort } from "@/lib/cases/service";
import { createMobileApi } from "../handlers";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("app API: document checklists", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const uscis: UscisPort = { mode: "mock", getCaseStatus: async () => ({ httpStatus: 500, attempts: 1, durationMs: 1 }) as never };
  const api = createMobileApi({ db, cases: createCaseService({ db, uscis, env: {} }) });
  const users: string[] = [];
  const body = (r: { body: unknown }) => r.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const mkUser = async () => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `cl-${id}@test.dev`, name: "Checklists" } });
    users.push(id);
    return id;
  };
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("ticks and unticks items per person, counts progress, and refuses unknown checklists or items", async () => {
    const a = await mkUser();
    const b = await mkUser();
    expect(body(await api.setChecklistItem(a, "i-485", { item: "form", done: true })).done).toEqual(["form"]);
    expect(body(await api.setChecklistItem(a, "i-485", { item: "i693", done: true })).done).toEqual(["form", "i693"]);
    // Ticking twice is fine; unticking removes it.
    expect(body(await api.setChecklistItem(a, "i-485", { item: "form", done: true })).done).toEqual(["form", "i693"]);
    expect(body(await api.setChecklistItem(a, "i-485", { item: "i693", done: false })).done).toEqual(["form"]);

    const one = body(await api.getChecklist(a, "i-485"));
    expect(one.done).toEqual(["form"]);
    expect(one.checklist).toMatchObject({ key: "i-485", form: "I-485" });
    expect(one.tips.length).toBeGreaterThan(0);

    const list = body(await api.listChecklists(a)).checklists as { key: string; done: number; requiredDone: number; total: number }[];
    expect(list.find((c) => c.key === "i-485")).toMatchObject({ done: 1, requiredDone: 1 });
    expect(list.find((c) => c.key === "n-400")).toMatchObject({ done: 0 });

    // Another person sees none of it.
    expect(body(await api.getChecklist(b, "i-485")).done).toEqual([]);

    expect((await api.getChecklist(a, "nope")).status).toBe(404);
    expect((await api.setChecklistItem(a, "i-485", { item: "nope", done: true })).status).toBe(404);
    expect((await api.setChecklistItem(a, "i-485", { item: "form" })).status).toBe(400);

    // The case list shows each case's checklist progress (the "ready" ring on the card).
    await db.trackedCase.create({
      data: { ownerUserId: a, receiptEncrypted: "test", receiptDigest: `cl-${a}`, receiptMasked: "LIN*******777", formType: "I485", statusTitleEn: "Case Was Received" },
    });
    await db.trackedCase.create({
      data: { ownerUserId: a, receiptEncrypted: "test", receiptDigest: `cl2-${a}`, receiptMasked: "LIN*******778", formType: "I-129", statusTitleEn: "Case Was Received" },
    });
    const cases = body(await api.listCases(a)).cases as { formType: string; checklist: { key: string; required: number; requiredDone: number } | null }[];
    const gc = cases.find((x) => x.formType === "I485")!;
    expect(gc.checklist).toMatchObject({ key: "i-485", requiredDone: 1 });
    expect(gc.checklist!.required).toBeGreaterThan(3);
    expect(cases.find((x) => x.formType === "I-129")!.checklist).toBeNull();

    // Deleting the account deletes the ticks.
    await db.user.delete({ where: { id: a } });
    expect(await db.checklistCheck.count({ where: { userId: a } })).toBe(0);
  });
});
