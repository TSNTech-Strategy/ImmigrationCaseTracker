import { getApiUser } from "@/lib/auth/session";
import { firmAuditService } from "@/lib/firms";
import { readAuditFilters } from "../filters";

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return new Response("Please sign in.", { status: 401 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const { filters } = readAuditFilters(sp);
  const r = await firmAuditService().exportCsv(user.id, { ...filters, before: undefined });
  if (!r.ok) return new Response("Not found.", { status: 404 });
  return new Response(r.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${r.filename}"`,
      "cache-control": "no-store",
    },
  });
}
