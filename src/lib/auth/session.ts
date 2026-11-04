import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { createSupabaseServerClient, createSupabaseTokenClient } from "@/lib/supabase/server";
import { bearerToken } from "./paths";
import { ensureProfile, isAdminEmail, needsSecondFactor, type AuthClaims } from "./profile";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  isAdmin: boolean;
  mfaEnabled: boolean;
  /** "aal2" once the user has passed their second factor this session. */
  aal: string;
};

/**
 * none         — not signed in
 * mfa_required — password accepted, but this user has two-factor on and
 *                hasn't entered a code this session: NOT signed in for any
 *                purpose except the /login/mfa page
 * ok           — fully signed in
 */
export type SessionState =
  | { state: "none" }
  | { state: "mfa_required"; user: AppUser }
  | { state: "ok"; user: AppUser };

type Claims = AuthClaims & { aal?: string };

async function stateFromClaims(claims: Claims): Promise<SessionState> {
  const u = await ensureProfile(prisma, claims);
  const user: AppUser = {
    id: u.id,
    email: u.email,
    name: u.name,
    locale: u.locale,
    isAdmin: isAdminEmail(u.email),
    mfaEnabled: Boolean(u.mfaEnrolledAt),
    aal: claims.aal ?? "aal1",
  };
  return needsSecondFactor(u, claims.aal) ? { state: "mfa_required", user } : { state: "ok", user };
}

/** Session for this request (cookie). getClaims() verifies the JWT signature. Cached per request. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  // Who's signed in is per request: never part of a prerender.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return { state: "none" };
  return stateFromClaims(data.claims as Claims);
});

/** The fully signed-in user, or null (including while a two-factor code is still owed). */
export async function getCurrentUser(): Promise<AppUser | null> {
  const s = await getSessionState();
  return s.state === "ok" ? s.user : null;
}

/** For pages: the signed-in user, or a redirect to sign-in / the two-factor step. */
export async function requireUser(nextPath?: string): Promise<AppUser> {
  const s = await getSessionState();
  const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
  if (s.state === "none") redirect(`/login${next}`);
  if (s.state === "mfa_required") redirect(`/login/mfa${next}`);
  return s.user;
}

/**
 * For API routes: a Bearer access token (the mobile app signs in with
 * Supabase directly) or, failing that, the web cookie session.
 */
export async function getApiUser(request: Request): Promise<AppUser | null> {
  const token = bearerToken(request.headers.get("authorization"));
  if (token) {
    const { data, error } = await createSupabaseTokenClient().auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    const s = await stateFromClaims(data.claims as Claims);
    return s.state === "ok" ? s.user : null;
  }
  return getCurrentUser();
}
