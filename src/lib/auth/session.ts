import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSupabaseServerClient, createSupabaseTokenClient } from "@/lib/supabase/server";
import { bearerToken } from "./paths";
import { ensureProfile, isAdminEmail, type AuthClaims } from "./profile";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  isAdmin: boolean;
  /** "aal2" once the user has passed a second factor (MFA) this session. */
  aal: string;
};

async function toAppUser(claims: AuthClaims & { aal?: string }): Promise<AppUser> {
  const u = await ensureProfile(prisma, claims);
  return { id: u.id, email: u.email, name: u.name, locale: u.locale, isAdmin: isAdminEmail(u.email), aal: claims.aal ?? "aal1" };
}

/**
 * The signed-in user for this request (cookie session), or null.
 * getClaims() verifies the JWT signature — never trust getSession() alone.
 * Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return toAppUser(data.claims as AuthClaims & { aal?: string });
});

/** For pages: the signed-in user, or a redirect to /login (back here afterwards). */
export async function requireUser(nextPath?: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
}

/**
 * For API routes: a Bearer access token (the mobile app signs in with Supabase
 * directly and sends it) or, failing that, the web cookie session.
 */
export async function getApiUser(request: Request): Promise<AppUser | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (token) {
    const { data, error } = await createSupabaseTokenClient().auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return toAppUser(data.claims as AuthClaims & { aal?: string });
  }
  return getCurrentUser();
}
