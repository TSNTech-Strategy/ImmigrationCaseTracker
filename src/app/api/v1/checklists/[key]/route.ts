import { getMobileUser, mobileApi, readJson, respond, unauthorized } from "@/lib/mobile";

/** One checklist and the items this person ticked. */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/checklists/[key]">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { key } = await ctx.params;
  return respond(await mobileApi().getChecklist(user.id, key));
}

/** {item, done}: tick or untick one item. */
export async function PUT(request: Request, ctx: RouteContext<"/api/v1/checklists/[key]">) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { key } = await ctx.params;
  return respond(await mobileApi().setChecklistItem(user.id, key, await readJson(request)));
}
