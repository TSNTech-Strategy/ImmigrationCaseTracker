import { getMobileUser, mobileApi, readJson, respond, unauthorized } from "@/lib/mobile";

export async function GET(request: Request, ctx: RouteContext<"/api/v1/cases/[id]">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().getCase(user.id, id));
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/v1/cases/[id]">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().removeCase(user.id, id));
}

/** {nickname: string | null}: rename the case (or clear the nickname). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/cases/[id]">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  return respond(await mobileApi().renameCase(user.id, id, await readJson(request)));
}
