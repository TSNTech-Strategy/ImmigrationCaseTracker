import type { PrismaClient } from "@prisma/client";
import { csvCell } from "@/lib/csv";
import { createFirmDashboardService, type DashboardFilters, type FirmDashboard } from "./dashboard";
import { DEADLINE_KINDS } from "./alerts";

/**
 * Dashboard reports as CSV: the same numbers and filters as the dashboard, with every row
 * (the dashboard shows the top 8). Any member can export; receipts are masked; every export
 * is in the activity log.
 */

type BarReport = { kind: "bars"; title: string; unit: string; rows: (d: FirmDashboard) => { label: string; value: number }[] };
type TableReport = { kind: "table"; title: string; header: string[]; rows: (d: FirmDashboard) => (string | number | null)[][] };

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export const REPORTS = {
  status: { kind: "bars", title: "Status overview", unit: "Cases", rows: (d) => d.byStatus },
  assignee: { kind: "bars", title: "Cases by assignee", unit: "Cases", rows: (d) => d.byAssignee },
  form: { kind: "bars", title: "Case volume by form", unit: "Cases", rows: (d) => d.byForm },
  category: { kind: "bars", title: "Case categories", unit: "Cases", rows: (d) => d.byCategory },
  waiting: { kind: "bars", title: "Time since last USCIS change", unit: "Cases", rows: (d) => d.waiting },
  country: { kind: "bars", title: "Clients by country of birth", unit: "Clients", rows: (d) => d.byCountry },
  deadlines: {
    kind: "table",
    title: "Upcoming deadlines",
    header: ["Due", "Days left", "Deadline", "Client", "Case", "Note"],
    rows: (d) => d.deadlines.map((x) => [day(x.dueOn), x.daysLeft, DEADLINE_KINDS[x.kind].label, x.case.client?.displayName ?? "", x.case.nickname ?? x.case.receiptMasked, x.note ?? ""]),
  },
  requests: {
    kind: "table",
    title: "Open document requests",
    header: ["Request", "Client", "Case", "Due", "Days left", "Required accepted", "Required", "To review", "Waiting for client", "Emailed", "Created"],
    rows: (d) => d.requests.map((r) => [r.title, r.client.displayName, r.receiptMasked ?? "", day(r.dueOn), r.daysLeft, r.accepted, r.required, r.toReview, r.waiting, r.sent ? "Yes" : "No", day(r.createdAt)]),
  },
} satisfies Record<string, BarReport | TableReport>;

export type ReportKey = keyof typeof REPORTS | "all";
export const isReportKey = (k: string): k is ReportKey => k === "all" || k in REPORTS;

const line = (cells: (string | number | null)[]) => cells.map(csvCell).join(",");

export function reportCsv(d: FirmDashboard, key: ReportKey): string {
  const lines: string[] = [];
  if (key === "all") {
    // Every chart in one file: Report, Item, Count.
    lines.push(line(["Report", "Item", "Count"]));
    lines.push(line(["Summary", "Cases", d.kpis.cases]));
    for (const r of Object.values(REPORTS)) {
      if (r.kind !== "bars") continue;
      const rows = r.rows(d);
      // Every section is in the file, even when nothing matches the filters.
      if (rows.length === 0) lines.push(line([r.title, "None", 0]));
      for (const row of rows) lines.push(line([r.title, row.label, row.value]));
    }
    lines.push(line(["Summary", "Open document requests", d.kpis.openRequests]));
    lines.push(line(["Summary", "Deadlines in 7 days", d.kpis.dueSoon]));
    lines.push(line(["Summary", "Open in Inbox", d.kpis.openItems]));
  } else {
    const r = REPORTS[key];
    if (r.kind === "bars") {
      lines.push(line(["Item", r.unit]));
      for (const row of r.rows(d)) lines.push(line([row.label, row.value]));
    } else {
      lines.push(line(r.header));
      for (const row of r.rows(d)) lines.push(line(row));
    }
  }
  // A BOM so Excel opens accented names correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function createFirmReportService({ db, now = () => new Date() }: { db: PrismaClient; now?: () => Date }) {
  const dashboard = createFirmDashboardService({ db, now });

  async function exportReport(userId: string, key: string, filters: DashboardFilters): Promise<{ ok: true; csv: string; filename: string } | { ok: false; error: string }> {
    if (!isReportKey(key)) return { ok: false, error: "Unknown report." };
    const d = await dashboard.getDashboard(userId, filters, { full: true });
    if (!d) return { ok: false, error: "You're not part of a firm workspace." };
    const csv = reportCsv(d, key);
    const used = Object.fromEntries(Object.entries(d.filters).filter(([, v]) => v));
    await db.auditLog.create({ data: { firmId: d.ctx.firm.id, actorUserId: userId, action: "report.exported", targetType: "Firm", targetId: d.ctx.firm.id, metadata: { report: key, filters: used } } });
    return { ok: true, csv, filename: `casepingo-${key === "all" ? "reports" : `report-${key}`}-${now().toISOString().slice(0, 10)}.csv` };
  }

  return { exportReport };
}
