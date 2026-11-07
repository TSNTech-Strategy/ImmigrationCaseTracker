import { getMobileUser, mobileApi, readJson, respond, unauthorized } from "@/lib/mobile";

/** The signed-in person's tags (A to Z) with case counts, the colors and the limits. */
export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().listTags(user.id));
}

/** {name, color?}: create a tag. */
export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().createTag(user.id, await readJson(request)));
}
