import "server-only";
import { prisma } from "@/lib/db";
import { formInfo } from "@/lib/case-insights";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@/lib/firms/tasks";

const opts = (r: Record<string, string>) => Object.entries(r).map(([value, label]) => ({ value, label }));

/** Choices for the task form: statuses, types, priorities, teammates, the firm's cases and clients. */
export async function taskFormOptions(firmId: string) {
  const [members, cases, clients] = await Promise.all([
    prisma.firmMembership.findMany({ where: { firmId, revokedAt: null }, select: { userId: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.trackedCase.findMany({ where: { firmId }, select: { id: true, receiptMasked: true, nickname: true, formType: true, client: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.client.findMany({ where: { firmId, archivedAt: null }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" }, take: 500 }),
  ]);
  return {
    statuses: opts(TASK_STATUSES),
    types: opts(TASK_TYPES),
    priorities: opts(TASK_PRIORITIES),
    members: members.map((m) => ({ value: m.userId, label: m.user.name ?? m.user.email })),
    cases: cases.map((c) => ({ value: c.id, label: [c.client?.displayName, c.nickname ?? formInfo(c.formType)?.code, c.receiptMasked].filter(Boolean).join(" · ") })),
    clients: clients.map((c) => ({ value: c.id, label: c.displayName })),
  };
}
