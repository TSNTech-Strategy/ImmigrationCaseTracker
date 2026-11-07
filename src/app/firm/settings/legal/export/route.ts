import { getApiUser } from "@/lib/auth/session";
import { firmDataService } from "@/lib/firms";

/** Everything the firm has, as one JSON file (Owner only). Recorded in the activity log. */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return new Response("Please sign in.", { status: 401 });
  const r = await firmDataService().exportAll(user.id);
  if (!r.ok) return new Response(r.error, { status: 403 });
  return new Response(r.json, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${r.filename}"`,
      "cache-control": "no-store",
    },
  });
}
