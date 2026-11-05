import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/session";

/**
 * The signed-in user's profile. Accepts the web session cookie or
 * "Authorization: Bearer <Supabase access token>" (mobile app).
 */
export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ id: user.id, email: user.email, name: user.name, locale: user.locale });
}
