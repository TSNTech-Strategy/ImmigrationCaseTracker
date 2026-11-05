/**
 * One-time clean-up: mask full receipt numbers that USCIS embedded in status
 * text saved before the redaction fix. Safe to re-run (idempotent).
 *
 *   npm run db:redact-receipts
 *
 * Needs DATABASE_URL and ENCRYPTION_KEY in .env (the same key the site uses).
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { revealReceipt } from "../src/lib/cases/receipt-store";
import { redactReceiptInText } from "../src/lib/uscis/text";

const prisma = new PrismaClient();

type HistoryItem = { date?: unknown; textEn?: string | null; textEs?: string | null };

async function main() {
  let casesFixed = 0;
  let eventsFixed = 0;
  const cases = await prisma.trackedCase.findMany();
  for (const c of cases) {
    const receipt = revealReceipt(c);
    const red = (t: string | null) => redactReceiptInText(t, receipt);

    const history = Array.isArray(c.uscisHistory) ? (c.uscisHistory as HistoryItem[]) : null;
    const newHistory = history?.map((h) => ({ ...h, textEn: red(h.textEn ?? null), textEs: red(h.textEs ?? null) })) ?? null;
    const data = {
      statusTitleEn: red(c.statusTitleEn),
      statusTitleEs: red(c.statusTitleEs),
      statusDescriptionEn: red(c.statusDescriptionEn),
      statusDescriptionEs: red(c.statusDescriptionEs),
    };
    const caseChanged =
      Object.entries(data).some(([k, v]) => v !== c[k as keyof typeof data]) ||
      JSON.stringify(newHistory) !== JSON.stringify(history);
    if (caseChanged) {
      await prisma.trackedCase.update({
        where: { id: c.id },
        data: { ...data, ...(newHistory ? { uscisHistory: newHistory as unknown as Prisma.InputJsonValue } : {}) },
      });
      casesFixed++;
    }

    const events = await prisma.caseStatusEvent.findMany({ where: { caseId: c.id } });
    for (const e of events) {
      const ev = {
        statusTitleEn: red(e.statusTitleEn),
        statusTitleEs: red(e.statusTitleEs),
        statusDescriptionEn: red(e.statusDescriptionEn),
        statusDescriptionEs: red(e.statusDescriptionEs),
      };
      if (Object.entries(ev).some(([k, v]) => v !== e[k as keyof typeof ev])) {
        await prisma.caseStatusEvent.update({ where: { id: e.id }, data: ev });
        eventsFixed++;
      }
    }
  }
  console.log(`Checked ${cases.length} cases. Masked receipt numbers in ${casesFixed} cases and ${eventsFixed} status events.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
