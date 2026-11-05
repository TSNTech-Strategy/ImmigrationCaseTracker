/** Admin overview against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { protectReceipt } from "@/lib/cases/receipt-store";
import { createAdminService, maskEmail } from "../service";

const url = process.env.TEST_DATABASE_URL;

describe("maskEmail", () => {
  it("hides the mailbox but keeps the domain", () => {
    expect(maskEmail("amrullo@tsntech.org")).toBe("a******@tsntech.org");
    expect(maskEmail("ab@x.io")).toBe("a**@x.io");
    expect(maskEmail("nope")).toBe("***");
  });
});

describe.skipIf(!url)("admin service", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const clock = new Date("2030-01-10T15:00:00Z"); // far from other tests' data windows
  const admin = createAdminService({ db, now: () => clock, env: { USCIS_DAILY_BUDGET: "800" } });
  const users: string[] = [];

  beforeAll(() => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 3).toString("base64");
  });
  afterAll(async () => {
    await db.deletionRequest.deleteMany({ where: { requesterEmail: { endsWith: "@admin-test.dev" } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("reports USCIS usage, outcomes, overdue cases and failed alerts without receipts", async () => {
    const before = await admin.overview();
    const id = randomUUID();
    await db.user.create({ data: { id, email: `owner-${id}@admin-test.dev` } });
    users.push(id);
    const c = await db.trackedCase.create({
      data: {
        ...protectReceipt("EAC9999103402"),
        ownerUserId: id,
        nextCheckAt: new Date(clock.getTime() - 2 * 3600_000),
        consents: { create: { basis: "SELF", source: "WEB", statementVersion: "t" } },
      },
    });
    await db.caseCheckRun.createMany({
      data: [
        { caseId: c.id, trigger: "SCHEDULED", uscisEnv: "sandbox", httpStatus: 200, outcome: "ok", durationMs: 5, attemptedAt: new Date(clock.getTime() - 60_000) },
        { caseId: c.id, trigger: "MANUAL", uscisEnv: "sandbox", httpStatus: 503, outcome: "server", durationMs: 5, attemptedAt: new Date(clock.getTime() - 30_000) },
      ],
    });
    const ev = await db.caseStatusEvent.create({ data: { caseId: c.id, fingerprint: "f", firstObservedAt: clock } });
    await db.notificationDelivery.create({ data: { eventId: ev.id, userId: id, channel: "EMAIL", idempotencyKey: `${ev.id}:x`, status: "FAILED", error: "SMTP down", createdAt: clock } });

    const o = await admin.overview();
    expect(o.uscis.usedToday - before.uscis.usedToday).toBe(2);
    expect(o.uscis.budget).toBe(800);
    expect(o.uscis.outcomes24h.find((x) => x.outcome === "server")?.count).toBeGreaterThanOrEqual(1);
    expect(o.uscis.lastScheduledAt?.getTime()).toBe(clock.getTime() - 60_000);
    expect(o.uscis.overdue - before.uscis.overdue).toBe(1);
    expect(o.notifications.failed7 - before.notifications.failed7).toBe(1);
    expect(o.notifications.recentFailures[0]).toMatchObject({ to: expect.stringMatching(/^o\*+@admin-test\.dev$/), error: "SMTP down" });
    expect(o.people.users - before.people.users).toBe(1);
    expect(JSON.stringify(o)).not.toMatch(/9999103402/);
  });

  it("closes deletion requests with a reason when declining, once, and logs who did it", async () => {
    const adminId = randomUUID();
    await db.user.create({ data: { id: adminId, email: `boss-${adminId}@admin-test.dev` } });
    users.push(adminId);
    const r = await db.deletionRequest.create({ data: { requesterEmail: "someone@admin-test.dev", scope: "ACCOUNT", status: "REQUESTED" } });
    expect((await admin.deletionRequests()).some((d) => d.id === r.id)).toBe(true);
    expect(await admin.closeDeletionRequest(adminId, r.id, "REJECTED", "")).toMatchObject({ ok: false });
    expect(await admin.closeDeletionRequest(adminId, r.id, "COMPLETED", "Handled by email")).toEqual({ ok: true });
    expect(await admin.closeDeletionRequest(adminId, r.id, "COMPLETED", "again")).toMatchObject({ ok: false });
    expect((await admin.deletionRequests()).some((d) => d.id === r.id)).toBe(false);
    expect(await db.auditLog.count({ where: { actorUserId: adminId, action: "admin.deletion_completed", targetId: r.id } })).toBe(1);
  });
});
