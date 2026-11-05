import { getMobileUser, mobileApi, respond, unauthorized } from "@/lib/mobile";

/** "Refresh now": same cooldown and daily limits as the website. */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/cases/[id]/refresh">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().refreshCase(user.id, id));
}
