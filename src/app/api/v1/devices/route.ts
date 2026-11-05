import { getMobileUser, mobileApi, readJson, respond, unauthorized } from "@/lib/mobile";

/** Register this phone for push alerts. Body: {token: "ExponentPushToken[…]", platform, appVersion?}. */
export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().registerDevice(user.id, await readJson(request)));
}

/** Stop push alerts to this phone (sign-out). Body: {token}. */
export async function DELETE(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().unregisterDevice(user.id, await readJson(request)));
}
