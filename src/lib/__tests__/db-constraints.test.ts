/**
 * Database-level guarantees, run against a real Postgres.
 * Skipped unless TEST_DATABASE_URL points at a migrated database:
 *
 *   TEST_DATABASE_URL=postgresql://ict:ict@localhost:5433/ict_dev npm test
 *
 * Every record is created with a unique suffix and removed afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { protectReceipt } from "../cases/receipt-store";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("database constraints", () => {
  const prisma = new PrismaClient({ datasourceUrl: url });
  const tag = `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  let userA: string, userB: string, firmA: string, firmB: string, clientOfB: string;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 3).toString("base64");
    userA = (await prisma.user.create({ data: { email: `a-${tag}@test.dev`, passwordHash: "x" } })).id;
    userB = (await prisma.user.create({ data: { email: `b-${tag}@test.dev`, passwordHash: "x" } })).id;
    firmA = (await prisma.firm.create({ data: { name: `Firm A ${tag}` } })).id;
    firmB = (await prisma.firm.create({ data: { name: `Firm B ${tag}` } })).id;
    clientOfB = (await prisma.client.create({ data: { firmId: firmB, displayName: "Client of B" } })).id;
  });

  afterAll(async () => {
    await prisma.firm.deleteMany({ where: { id: { in: [firmA, firmB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await prisma.$disconnect();
  });

  const receipt = (n: number) => protectReceipt(`EAC99991034${String(n).padStart(2, "0")}`);

  it("rejects a case with no owner", async () => {
    await expect(prisma.trackedCase.create({ data: { ...receipt(1) } })).rejects.toThrow(/exactly_one_owner/);
  });

  it("rejects a case owned by both a user and a firm", async () => {
    await expect(
      prisma.trackedCase.create({ data: { ...receipt(2), ownerUserId: userA, firmId: firmA } }),
    ).rejects.toThrow(/exactly_one_owner/);
  });

  it("rejects linking a firm case to another firm's client", async () => {
    await expect(
      prisma.trackedCase.create({ data: { ...receipt(3), firmId: firmA, clientId: clientOfB } }),
    ).rejects.toThrow(/clientId_firmId_fkey|Foreign key/i);
  });

  it("rejects a client on an individual's case", async () => {
    await expect(
      prisma.trackedCase.create({ data: { ...receipt(4), ownerUserId: userA, clientId: clientOfB } }),
    ).rejects.toThrow();
  });

  it("allows the same receipt once per owner, but for different owners", async () => {
    const r = receipt(5);
    await prisma.trackedCase.create({ data: { ...r, ownerUserId: userA } });
    await expect(prisma.trackedCase.create({ data: { ...protectReceipt("EAC9999103405"), ownerUserId: userA } })).rejects.toThrow(
      /Unique constraint/,
    );
    await prisma.trackedCase.create({ data: { ...protectReceipt("EAC9999103405"), ownerUserId: userB } });
    await prisma.trackedCase.create({ data: { ...protectReceipt("EAC9999103405"), firmId: firmA } });
  });

  it("stores no plain receipt number anywhere in the row", async () => {
    const c = await prisma.trackedCase.create({ data: { ...receipt(6), ownerUserId: userB } });
    const row = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM "TrackedCase" WHERE id = ${c.id}`;
    expect(JSON.stringify(row)).not.toContain("EAC9999103406");
    expect(row[0].receiptMasked).toBe("EAC*******406");
  });

  it("rejects uppercase emails and unsupported locales", async () => {
    await expect(prisma.user.create({ data: { email: `Upper-${tag}@test.dev`, passwordHash: "x" } })).rejects.toThrow(
      /email_lowercase/,
    );
    await expect(prisma.user.create({ data: { email: `l-${tag}@test.dev`, passwordHash: "x", locale: "fr" } })).rejects.toThrow(
      /locale_supported/,
    );
  });

  it("deleting a firm removes its clients, cases and consents", async () => {
    const f = await prisma.firm.create({ data: { name: `Temp ${tag}` } });
    const cl = await prisma.client.create({ data: { firmId: f.id, displayName: "Temp client" } });
    const c = await prisma.trackedCase.create({
      data: {
        ...receipt(7),
        firmId: f.id,
        clientId: cl.id,
        consents: { create: { basis: "LEGAL_REPRESENTATIVE", source: "FIRM_ATTESTATION", statementVersion: "test" } },
      },
    });
    await prisma.firm.delete({ where: { id: f.id } });
    expect(await prisma.trackedCase.findUnique({ where: { id: c.id } })).toBeNull();
    expect(await prisma.caseConsent.count({ where: { caseId: c.id } })).toBe(0);
    expect(await prisma.client.findUnique({ where: { id: cl.id } })).toBeNull();
  });

  it("deleting a user removes their own cases", async () => {
    const u = await prisma.user.create({ data: { email: `temp-${tag}@test.dev`, passwordHash: "x" } });
    const c = await prisma.trackedCase.create({ data: { ...receipt(8), ownerUserId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    expect(await prisma.trackedCase.findUnique({ where: { id: c.id } })).toBeNull();
  });

  it("has row level security enabled on every table", async () => {
    const rows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'`;
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });
});
