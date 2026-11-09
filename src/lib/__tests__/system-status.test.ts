/** The public status page: levels from real signals, no customer numbers. */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { protectReceipt } from "@/lib/cases/receipt-store";
import { getSystemStatus, worst } from "../system-status";

describe("overall level", () => {
  it("is the worst part, ignoring parts not set up", () => {
    expect(worst(["operational", "not_configured"])).toBe("operational");
    expect(worst(["operational", "degraded"])).toBe("degraded");
    expect(worst(["degraded", "down", "operational"])).toBe("down");
  });
});

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("live status", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const users: string[] = [];
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("reports USCIS answers and how recently the scheduler ran, as rates", async () => {
    // A far-future clock, so other tests' check runs don't fall inside the window.
    const now = new Date("2031-03-01T12:00:00Z");
    const config = { storage: true, email: false, jobs: true };
    const u = await db.user.create({ data: { id: randomUUID(), email: `status-${randomUUID()}@test.dev` } });
    users.push(u.id);
    const c = await db.trackedCase.create({ data: { ...protectReceipt("EAC9999100001"), ownerUserId: u.id } });
    const run = (hoursAgo: number, outcome: string, trigger: "SCHEDULED" | "MANUAL" = "SCHEDULED") =>
      db.caseCheckRun.create({ data: { caseId: c.id, trigger, uscisEnv: "sandbox", outcome, durationMs: 100, attemptedAt: new Date(now.getTime() - hoursAgo * 3_600_000) } });

    for (let i = 0; i < 9; i++) await run(2, "ok");
    await run(3, "server");
    let s = await getSystemStatus({ db, now: () => now, config });
    const byKey = Object.fromEntries(s.components.map((x) => [x.key, x]));
    expect(byKey.database!.level).toBe("operational");
    expect(byKey.uscis).toMatchObject({ level: "operational", detail: expect.stringContaining("90%") });
    expect(byKey.jobs!.level).toBe("operational");
    expect(byKey.email!.level).toBe("not_configured");
    expect(s.overall).toBe("operational");
    expect(JSON.stringify(s)).not.toMatch(/\b10\b checks|\b9\b of/); // rates, not counts

    // Mostly failing: degraded. Scheduler silent for a day: degraded too.
    for (let i = 0; i < 5; i++) await run(1, "timeout", "MANUAL");
    const later = new Date(now.getTime() + 20 * 3_600_000);
    s = await getSystemStatus({ db, now: () => later, config });
    expect(s.components.find((x) => x.key === "uscis")!.level).toBe("degraded");
    expect(s.components.find((x) => x.key === "jobs")!.level).toBe("degraded");
    expect(s.overall).toBe("degraded");
  });
});
