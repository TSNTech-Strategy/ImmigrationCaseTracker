import { AUDIT_CATEGORIES, type AuditCategory, type AuditFilters } from "@/lib/firms/audit";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

/** Dates are whole UTC days: "from" inclusive, "to" inclusive (stored as the next midnight, exclusive). */
function day(v: string | undefined, plusOne = false): Date | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return plusOne ? new Date(d.getTime() + 86_400_000) : d;
}

export function readAuditFilters(sp: Params) {
  const category = one(sp.category);
  const raw = { category: category && category in AUDIT_CATEGORIES ? category : undefined, actor: one(sp.actor), from: one(sp.from), to: one(sp.to) };
  const filters: AuditFilters = {
    category: raw.category as AuditCategory | undefined,
    actorId: raw.actor,
    from: day(raw.from),
    to: day(raw.to, true),
    before: one(sp.before),
  };
  const query = new URLSearchParams(Object.entries(raw).filter(([, v]) => v) as [string, string][]);
  return { filters, raw, query };
}
