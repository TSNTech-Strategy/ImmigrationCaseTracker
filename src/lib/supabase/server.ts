import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/** Supabase client bound to the request's auth cookies (pages, actions, routes). */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Stateless client for verifying a Bearer token (mobile app / API callers). */
export function createSupabaseTokenClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Admin client (SUPABASE_SECRET_KEY) — bypasses RLS and can manage auth users.
 * Server-only, for account deletion and similar privileged jobs.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
