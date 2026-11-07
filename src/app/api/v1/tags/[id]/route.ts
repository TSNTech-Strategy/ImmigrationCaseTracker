import { getMobileUser, mobileApi, readJson, respond, unauthorized } from "@/lib/mobile";

/** {name?, color?}: rename or recolor one of the person's tags. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/tags/[id]">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().updateTag(user.id, id, await readJson(request)));
}

/** Delete a tag (it comes off every case; the cases stay). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/tags/[id]">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().deleteTag(user.id, id));
}
