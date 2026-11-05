import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";
import { DEFAULT_AFTER_LOGIN, isAuthPage, isProtectedPath } from "@/lib/auth/paths";
import { needsSecondFactor } from "@/lib/auth/profile";
import { prisma } from "@/lib/db";

/**
 * Runs on every page request: refreshes the Supabase session cookies (Server
 * Components can't), and redirects between protected pages and sign-in pages.
 * This is the optimistic first gate only — every page, action and API route
 * checks the user again on the server.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { url, publishableKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Don't put code between createServerClient and getClaims — it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (target: URL) => {
    const r = NextResponse.redirect(target);
    // Keep any refreshed session cookies on the redirect.
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (!signedIn && isProtectedPath(pathname)) {
    const target = new URL("/login", request.url);
    target.searchParams.set("next", pathname + search);
    return redirectTo(target);
  }
  // Two-factor users who haven't entered their code yet go straight to the
  // code page (a real redirect). Decided from our database flag — the same
  // authoritative source pages and actions use — never the editable cookie.
  if (signedIn && isProtectedPath(pathname)) {
    const profile = await prisma.user.findUnique({ where: { id: String(data!.claims.sub) }, select: { mfaEnrolledAt: true } });
    if (profile && needsSecondFactor(profile, data!.claims.aal as string | undefined)) {
      const target = new URL("/login/mfa", request.url);
      target.searchParams.set("next", pathname + search);
      return redirectTo(target);
    }
  }
  if (signedIn && isAuthPage(pathname)) {
    return redirectTo(new URL(DEFAULT_AFTER_LOGIN, request.url));
  }
  return response;
}
