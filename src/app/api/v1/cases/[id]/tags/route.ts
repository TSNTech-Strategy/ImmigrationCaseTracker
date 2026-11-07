import { getMobileUser, mobileApi, readJson, respond, unauthorized } from "@/lib/mobile";

/** {tagIds: string[]}: put exactly these tags on the case. */
export async function PUT(request: Request, ctx: RouteContext<"/api/v1/cases/[id]/tags">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().setCaseTags(user.id, id, await readJson(request)));
}
