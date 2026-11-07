import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { cardLang, journeyCardFor } from "@/lib/journey-card";

/** The website's copy of the "Share my journey" picture: signed in, own approved cases only. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  const { id } = await params;
  const card = await journeyCardFor(user.id, id, cardLang(new URL(request.url).searchParams.get("lang"), user.locale));
  return card ?? new NextResponse("Not found", { status: 404 });
}
