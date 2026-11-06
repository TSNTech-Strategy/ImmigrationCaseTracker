/** Visa Bulletin import and alerts against a real Postgres (TEST_DATABASE_URL; skipped otherwise). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { EmailDriver, EmailMessage } from "@/lib/email";
import type { PushDriver, PushMessage } from "@/lib/push";
import type { Charts } from "../model";
import { createVisaBulletinService, isStateDeptUrl, isValidWatch } from "../service";

const url = process.env.TEST_DATABASE_URL;
const d = (date: string) => ({ t: "D" as const, date });
const charts = (f2aMexico: string, eb2India: string): Charts => ({
  familyFinal: { F2A: { ALL: d("2024-02-01"), MEXICO: d(f2aMexico) }, F4: { ALL: d("2008-01-08") } },
  familyFiling: { F2A: { ALL: d("2025-01-01"), MEXICO: d("2023-01-01") } },
  employmentFinal: { EB2: { ALL: { t: "C" }, INDIA: d(eb2India) } },
});

describe.skipIf(!url)("visa bulletin service", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const mail: EmailMessage[] = [];
  const pushes: PushMessage[] = [];
  const mailer = { name: "test", send: async (m: EmailMessage) => void mail.push(m) } as unknown as EmailDriver;
  const pusher: PushDriver = { name: "console", send: async (ms) => (pushes.push(...ms), ms.map(() => ({ status: "ok" as const }))) };
  const svc = createVisaBulletinService({ db, mailer, pusher, siteUrl: "https://casepingo.test" });
  const users: string[] = [];
  const months = ["2091-11", "2091-12", "2092-01"];
  const mkUser = async (plan: "FREE" | "PREMIUM", locale = "en") => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `vb-${id}@test.dev`, name: "Visa", plan, locale } });
    users.push(id);
    return id;
  };

  // The service compares with the latest earlier month, alerts only for the newest and alerts
  // every Premium follower, so this suite needs the (test database's) bulletin tables to itself.
  beforeAll(async () => {
    await db.visaBulletin.deleteMany({});
    await db.visaBulletinWatch.deleteMany({});
  });
  afterAll(async () => {
    await db.visaBulletin.deleteMany({ where: { month: { in: months } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("accepts only state.gov https links for the bulletin", () => {
    expect(isStateDeptUrl("https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-january-2027.html")).toBe(true);
    expect(isStateDeptUrl("http://travel.state.gov/x")).toBe(false);
    expect(isStateDeptUrl("https://travel.state.gov.evil.example/x")).toBe(false);
    expect(isStateDeptUrl("https://evilstate.gov/x")).toBe(false);
    expect(isStateDeptUrl("javascript:alert(1)")).toBe(false);
  });

  it("validates watches", () => {
    expect(isValidWatch({ category: "F2A", area: "MEXICO", chart: "final" })).toBe(true);
    expect(isValidWatch({ category: "F9", area: "MEXICO", chart: "final" })).toBe(false);
    expect(isValidWatch({ category: "F2A", area: "MARS", chart: "final" })).toBe(false);
    expect(isValidWatch({ category: "F2A", area: "ALL", chart: "soon" })).toBe(false);
  });

  it("imports months, alerts Premium watchers whose category moved, once per month", async () => {
    const premium = await mkUser("PREMIUM", "es");
    const free = await mkUser("FREE");
    const unchanged = await mkUser("PREMIUM");
    const quiet = await mkUser("PREMIUM");
    await db.notificationPreference.create({ data: { userId: quiet, emailOnChange: false } });
    await db.pushDevice.create({ data: { userId: premium, token: `ExponentPushToken[${randomUUID().slice(0, 20)}]`, platform: "ios" } });
    await db.notificationPreference.create({ data: { userId: premium, pushOnChange: true } });
    await svc.setWatch(premium, { category: "F2A", area: "MEXICO", chart: "final" });
    await svc.setWatch(free, { category: "F2A", area: "MEXICO", chart: "final" });
    await svc.setWatch(unchanged, { category: "F4", area: "ALL", chart: "final" });
    await svc.setWatch(quiet, { category: "F2A", area: "MEXICO", chart: "final" });
    expect(await svc.getWatch(premium)).toEqual({ category: "F2A", area: "MEXICO", chart: "final" });

    expect(await svc.importBulletin({ month: "2091-13", charts: charts("2021-02-01", "2013-01-01") })).toMatchObject({ ok: false });
    expect(await svc.importBulletin({ month: "2091-11", charts: { familyFinal: {} } })).toMatchObject({ ok: false });
    expect(await svc.importBulletin({ month: "2091-11", charts: charts("2021-02-01", "2013-01-01"), sourceUrl: "javascript:alert(1)" })).toMatchObject({ ok: false });

    // First month: nothing to compare with, so no alerts.
    const first = await svc.importBulletin({ month: "2091-11", charts: charts("2021-02-01", "2013-01-01"), sourceUrl: "https://travel.state.gov/x" });
    expect(first).toMatchObject({ ok: true, alerts: { sent: 0 } });

    // Next month: F2A Mexico moved ahead 2 months.
    mail.length = 0;
    pushes.length = 0;
    const second = await svc.importBulletin({ month: "2091-12", charts: charts("2021-04-01", "2013-01-01") });
    // Free plan, no change, and alerts turned off are all skipped.
    expect(second).toMatchObject({ ok: true, alerts: { sent: 1, failed: 0, skipped: 3 } });
    expect((await db.visaBulletinWatch.findUnique({ where: { userId: quiet } }))?.lastNotifiedMonth).toBeNull();
    expect(mail).toHaveLength(1);
    expect(mail[0].to).toContain("vb-");
    expect(mail[0].subject).toBe("Boletín de Visas de diciembre de 2091: F2A cambió");
    expect(mail[0].body).toContain("Fecha de acción final: 1 abr 2021 (avanzó 2 meses)");
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({ title: "Boletín de Visas: F2A cambió", data: { screen: "bulletin" } });

    // Importing the same month again (e.g. a correction) doesn't alert twice.
    mail.length = 0;
    expect(await svc.importBulletin({ month: "2091-12", charts: charts("2021-04-01", "2013-01-01") })).toMatchObject({ ok: true, alerts: { sent: 0 } });
    expect(mail).toHaveLength(0);

    // An older month imported later doesn't alert anyone.
    await db.visaBulletin.delete({ where: { month: "2091-11" } });
    expect(await svc.importBulletin({ month: "2091-11", charts: charts("2020-01-01", "2013-01-01") })).toMatchObject({ ok: true, alerts: null });

    const { current, previous } = await svc.latest();
    expect((current?.month ?? "") >= "2091-12").toBe(true);
    expect(previous).not.toBeNull();

    await svc.removeWatch(premium);
    expect(await svc.getWatch(premium)).toBeNull();
  });

  it("counts a failed email as failed and tries again on the next save", async () => {
    const id = await mkUser("PREMIUM");
    await svc.setWatch(id, { category: "F2A", area: "MEXICO", chart: "final" });
    const down = { name: "test", send: async () => Promise.reject(new Error("mail server down")) } as unknown as EmailDriver;
    const broken = createVisaBulletinService({ db, mailer: down, siteUrl: "https://casepingo.test" });
    expect(await broken.importBulletin({ month: "2092-01", charts: charts("2021-07-01", "2013-01-01") })).toMatchObject({ ok: true, alerts: { sent: 0, failed: 1 } });
    expect((await db.visaBulletinWatch.findUnique({ where: { userId: id } }))?.lastNotifiedMonth).toBeNull();
    mail.length = 0;
    expect(await svc.importBulletin({ month: "2092-01", charts: charts("2021-07-01", "2013-01-01") })).toMatchObject({ ok: true, alerts: { sent: 1, failed: 0 } });
    expect(mail.map((m) => m.to)).toEqual([`vb-${id}@test.dev`]);
  });
});

describe.skipIf(!url)("visa bulletin API", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const users: string[] = [];
  const quiet = { name: "test", send: async () => {} } as unknown as EmailDriver;
  const svc = createVisaBulletinService({ db, mailer: quiet, siteUrl: "https://casepingo.test" });
  afterAll(async () => {
    await db.visaBulletin.deleteMany({ where: { month: { in: ["2093-01", "2093-02"] } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("serves the bulletin with formatted values and movement, and saves the category", async () => {
    const { createBulletinApi } = await import("../api");
    const api = createBulletinApi({ db, svc });
    await svc.importBulletin({ month: "2093-01", charts: charts("2021-02-01", "2013-01-01") });
    await svc.importBulletin({ month: "2093-02", charts: charts("2021-05-01", "2012-12-01"), sourceUrl: "https://travel.state.gov/feb" });
    const anon = (await api.get(null)).body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(anon.bulletin.month).toBe("2093-02");
    expect(anon.bulletin.label).toEqual({ en: "February 2093", es: "febrero de 2093" });
    const f2a = anon.bulletin.rows.familyFinal.find((r: { category: string }) => r.category === "F2A");
    expect(f2a.cells.MEXICO).toEqual({ value: { en: "May 1, 2021", es: "1 may 2021" }, move: { tone: "good", changed: true, en: "Moved ahead 3 months", es: "Avanzó 3 meses" } });
    const eb2 = anon.bulletin.rows.employmentFinal.find((r: { category: string }) => r.category === "EB2");
    expect(eb2.cells.INDIA.move).toMatchObject({ tone: "bad", en: "Moved back 1 month" });
    expect(eb2.cells.ALL.move).toMatchObject({ tone: "neutral", changed: false, en: "No change" });
    expect(anon).toMatchObject({ watch: null, alerts: false, links: { bulletin: "https://travel.state.gov/feb" } });
    expect(anon.catalog.categories.length).toBe(15);

    const id = randomUUID();
    await db.user.create({ data: { id, email: `vb-api-${id}@test.dev`, plan: "PREMIUM" } });
    users.push(id);
    expect(await api.setWatch(id, { category: "F2A", area: "PLUTO", chart: "final" })).toMatchObject({ status: 400 });
    expect(await api.setWatch(id, { category: "EB2", area: "INDIA", chart: "filing" })).toMatchObject({ status: 200, body: { watch: { category: "EB2" } } });
    expect((await api.get(id)).body).toMatchObject({ watch: { category: "EB2", area: "INDIA", chart: "filing" }, alerts: true });
    expect(await api.removeWatch(id)).toMatchObject({ status: 200, body: { watch: null } });
  });
});
