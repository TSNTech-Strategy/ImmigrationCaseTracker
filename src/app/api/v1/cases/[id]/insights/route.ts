import { getMobileUser, mobileApi, respond, unauthorized } from "@/lib/mobile";

/** How the case compares with others like it: anonymous totals from cases tracked in CasePingo. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/cases/[id]/insights">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().caseInsights(user.id, id));
}
