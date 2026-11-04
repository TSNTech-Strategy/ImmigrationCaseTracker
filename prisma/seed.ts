/**
 * Local demo data — fake people, USCIS *staging* receipts only.
 *
 *   npm run db:seed
 *
 * Creates:
 *   demo@ict.dev  / ict-demo-1234  — individual with two tracked staging cases
 *   firm@ict.dev  / ict-demo-1234  — owner of "Demo Immigration Law" with one client + case
 * Safe to re-run (upserts).
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { protectReceipt } from "../src/lib/cases/receipt-store";
import { SANDBOX_RECEIPTS } from "../src/lib/receipt";

const prisma = new PrismaClient();
const PASSWORD = "ict-demo-1234";
const CONSENT_VERSION = "2026-11-04";

async function main() {
  if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to seed the production database.");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const demo = await prisma.user.upsert({
    where: { email: "demo@ict.dev" },
    update: {},
    create: { email: "demo@ict.dev", name: "Demo Applicant", passwordHash, notificationPreference: { create: {} } },
  });

  for (const [receipt, nickname] of [
    [SANDBOX_RECEIPTS.noHistory, "My I-130 (sandbox sample)"],
    [SANDBOX_RECEIPTS.withHistory, "Sandbox sample with history"],
  ] as const) {
    const p = protectReceipt(receipt);
    const existing = await prisma.trackedCase.findUnique({
      where: { ownerUserId_receiptDigest: { ownerUserId: demo.id, receiptDigest: p.receiptDigest } },
    });
    if (existing) continue;
    await prisma.trackedCase.create({
      data: {
        ...p,
        nickname,
        ownerUserId: demo.id,
        addedById: demo.id,
        consents: {
          create: { basis: "SELF", source: "WEB", statementVersion: CONSENT_VERSION, grantedById: demo.id },
        },
      },
    });
  }

  const owner = await prisma.user.upsert({
    where: { email: "firm@ict.dev" },
    update: {},
    create: { email: "firm@ict.dev", name: "Demo Attorney", passwordHash, notificationPreference: { create: {} } },
  });

  let firm = await prisma.firm.findFirst({ where: { memberships: { some: { userId: owner.id } } } });
  if (!firm) {
    firm = await prisma.firm.create({
      data: { name: "Demo Immigration Law", memberships: { create: { userId: owner.id, role: "OWNER" } } },
    });
  }

  let client = await prisma.client.findFirst({ where: { firmId: firm.id } });
  if (!client) {
    client = await prisma.client.create({
      data: { firmId: firm.id, displayName: "Sample Client", externalRef: "MATTER-001", createdById: owner.id },
    });
  }

  const p = protectReceipt(SANDBOX_RECEIPTS.withHistory);
  const firmCase = await prisma.trackedCase.findUnique({
    where: { firmId_receiptDigest: { firmId: firm.id, receiptDigest: p.receiptDigest } },
  });
  if (!firmCase) {
    await prisma.trackedCase.create({
      data: {
        ...p,
        nickname: "Sample Client — I-130",
        firmId: firm.id,
        clientId: client.id,
        addedById: owner.id,
        consents: {
          create: {
            basis: "LEGAL_REPRESENTATIVE",
            source: "FIRM_ATTESTATION",
            statementVersion: CONSENT_VERSION,
            evidenceRef: "G-28 on file (demo)",
            grantedById: owner.id,
          },
        },
      },
    });
  }

  console.log(`Seeded. Log in as demo@ict.dev or firm@ict.dev with password "${PASSWORD}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
