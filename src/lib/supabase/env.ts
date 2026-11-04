// Supabase project URL + publishable key. Both are PUBLIC by design (they
// identify the project; Row Level Security and our server checks protect the
// data), so they use the NEXT_PUBLIC_ prefix. The secret key never does.

export function getSupabasePublicEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // Older projects call it the "anon" key; newer ones "publishable" (sb_publishable_…).
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return { url, publishableKey };
}

/**
 * The site's one public address, used in email links (confirm, reset).
 * Must match Supabase → Authentication → URL Configuration exactly — the
 * Scanvio lesson: a per-deployment or missing origin breaks every link.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    if (process.env.VERCEL_ENV === "production") throw new Error("NEXT_PUBLIC_SITE_URL is not set.");
    return "http://localhost:3000";
  }
  return new URL(raw).origin;
}
