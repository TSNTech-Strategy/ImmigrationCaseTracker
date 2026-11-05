import { getMobileUser, mobileApi, respond, unauthorized } from "@/lib/mobile";

/** Free plan: check this case instead of the one currently checked. */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/cases/[id]/check-instead">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().checkInstead(user.id, id));
}
