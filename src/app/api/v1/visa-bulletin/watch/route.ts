import { getMobileUser, readJson, respond, unauthorized } from "@/lib/mobile";
import { bulletinApi } from "@/lib/visa-bulletin";

/** {category, area, chart}: the Visa Bulletin category this person follows. */
export async function PUT(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await bulletinApi().setWatch(user.id, await readJson(request)));
}

export async function DELETE(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await bulletinApi().removeWatch(user.id));
}
