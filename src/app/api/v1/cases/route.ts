import { getMobileUser, mobileApi, readJson, respond, unauthorized } from "@/lib/mobile";

export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().listCases(user.id));
}

/** Body: {receipt, nickname?, basis: "SELF"|"AUTHORIZED_BY_APPLICANT", consent: true, statementVersion}. */
export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  return respond(await mobileApi().addCase(user.id, await readJson(request)));
}
