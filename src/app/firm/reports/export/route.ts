import { getApiUser } from "@/lib/auth/session";
import { firmReportService } from "@/lib/firms";

/** One dashboard report (or all of them) as CSV, with the dashboard's filters. Recorded in the activity log. */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return new Response("Please sign in.", { status: 401 });
  const q = new URL(request.url).searchParams;
  const get = (k: string) => q.get(k) || undefined;
  const r = await firmReportService().exportReport(user.id, q.get("report") ?? "", { assignee: get("assignee"), from: get("from"), to: get("to"), matter: get("matter") });
  if (!r.ok) return new Response(r.error, { status: r.error === "Unknown report." ? 400 : 403 });
  return new Response(r.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${r.filename}"`,
      "cache-control": "no-store",
    },
  });
}
