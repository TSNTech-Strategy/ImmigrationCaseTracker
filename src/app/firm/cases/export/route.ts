import { getApiUser } from "@/lib/auth/session";
import { firmCaseService } from "@/lib/firms";

/** Every firm case as CSV (Owner/Admin). Recorded in the activity log. */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return new Response("Please sign in.", { status: 401 });
  const r = await firmCaseService().exportCases(user.id);
  if (!r.ok) return new Response(r.error, { status: 403 });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(r.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="casepingo-cases-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
