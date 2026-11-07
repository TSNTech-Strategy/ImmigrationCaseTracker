import { NextResponse } from "next/server";
import { getMobileUser, unauthorized } from "@/lib/mobile";
import { cardLang, journeyCardFor } from "@/lib/journey-card";

/** "Share my journey" picture (PNG) for one of the person's approved cases. 404 for anyone else's case or a case that isn't approved. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getMobileUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  const card = await journeyCardFor(user.id, id, cardLang(new URL(request.url).searchParams.get("lang"), user.locale));
  return card ?? NextResponse.json({ error: "not_found", message: "Case not found." }, { status: 404 });
}
