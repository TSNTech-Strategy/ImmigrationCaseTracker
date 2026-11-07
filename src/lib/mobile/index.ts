import "server-only";
import { NextResponse } from "next/server";
import { caseService } from "@/lib/cases";
import { prisma } from "@/lib/db";
import { insightsService } from "@/lib/insights-service";
import { bearerToken } from "@/lib/auth/paths";
import { getApiUser, type AppUser } from "@/lib/auth/session";
import { createMobileApi, type ApiResult } from "./handlers";

export const mobileApi = () => createMobileApi({ db: prisma, cases: caseService(), insights: insightsService() });

/**
 * The mobile app's user: a Supabase access token in "Authorization: Bearer".
 * Changes require the token (never the website's cookies), so a cross-site
 * request can't act on someone's account. Two-factor users need an aal2 token.
 */
export async function getMobileUser(request: Request): Promise<AppUser | null> {
  if (!bearerToken(request.headers.get("authorization"))) return null;
  return getApiUser(request);
}

export const unauthorized = () =>
  NextResponse.json({ error: "unauthorized", message: "Please sign in again." }, { status: 401, headers: { "cache-control": "no-store" } });

export const respond = (r: ApiResult) => NextResponse.json(r.body, { status: r.status, headers: { "cache-control": "no-store" } });

/** Parse a small JSON body; anything else counts as empty. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text || text.length > 10_000) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
