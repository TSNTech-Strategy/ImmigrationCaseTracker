/**
 * Demo data — fake people, USCIS *staging* receipts only.
 *
 *   npm run db:seed
 *
 * Creates two real Supabase Auth users (already email-confirmed) plus their
 * profiles and cases:
 *   demo@ict.dev  / ict-demo-1234  — individual with two tracked staging cases
 *   firm@ict.dev  / ict-demo-1234  — owner of "Demo Immigration Law" with one client + case
 * Needs SUPABASE_SECRET_KEY in .env. Safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { protectReceipt } from "../src/lib/cases/receipt-store";
import { SANDBOX_RECEIPTS } from "../src/lib/receipt";

const prisma = new PrismaClient();
const PASSWORD = "ict-demo-1234";
const CONSENT_VERSION = "2026-11-04";

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env to seed.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Find or create a confirmed Supabase Auth user; returns its id. */
async function authUser(admin: SupabaseClient, email: string, name: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name, locale: "en" },
  });
  if (created.data.user) return created.data.user.id;
  // Already exists: look it up.
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  throw created.error ?? new Error(`Could not create or find ${email}`);
}

async function main() {
  if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to seed the production database.");
  const admin = adminClient();

  const demoId = await authUser(admin, "demo@ict.dev", "Demo Applicant");
  const demo = await prisma.user.upsert({
    where: { id: demoId },
    update: {},
    create: { id: demoId, email: "demo@ict.dev", name: "Demo Applicant", notificationPreference: { create: {} } },
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
        consents: { create: { basis: "SELF", source: "WEB", statementVersion: CONSENT_VERSION, grantedById: demo.id } },
      },
    });
  }

  const ownerId = await authUser(admin, "firm@ict.dev", "Demo Attorney");
  const owner = await prisma.user.upsert({
    where: { id: ownerId },
    update: {},
    create: { id: ownerId, email: "firm@ict.dev", name: "Demo Attorney", notificationPreference: { create: {} } },
  });

  let firm = await prisma.firm.findFirst({ where: { memberships: { some: { userId: owner.id } } } });
  firm ??= await prisma.firm.create({
    data: { name: "Demo Immigration Law", memberships: { create: { userId: owner.id, role: "OWNER" } } },
  });

  let client = await prisma.client.findFirst({ where: { firmId: firm.id } });
  client ??= await prisma.client.create({
    data: { firmId: firm.id, displayName: "Sample Client", externalRef: "MATTER-001", createdById: owner.id },
  });

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

  console.log(`Seeded. Sign in as demo@ict.dev or firm@ict.dev with password "${PASSWORD}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
