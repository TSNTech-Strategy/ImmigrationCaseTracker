import type { PrismaClient, User } from "@prisma/client";

/** The parts of a verified Supabase JWT we use. */
export type AuthClaims = {
  sub: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export class ProfileConflictError extends Error {
  constructor() {
    super("This email is already linked to a different account. Contact support.");
    this.name = "ProfileConflictError";
  }
}

const SUPPORTED_LOCALES = new Set(["en", "es"]);

/**
 * Our profile row for a Supabase Auth user, created on first sign-in and kept
 * in sync if the email changes. Reads first so a normal request costs one
 * SELECT, not a write.
 */
export async function ensureProfile(db: Pick<PrismaClient, "user">, claims: AuthClaims): Promise<User> {
  const email = claims.email?.trim().toLowerCase();
  if (!email) throw new Error("Authenticated user has no email address.");

  const existing = await db.user.findUnique({ where: { id: claims.sub } });
  if (existing) {
    if (existing.email === email) return existing;
    return db.user.update({ where: { id: claims.sub }, data: { email } });
  }

  const meta = claims.user_metadata ?? {};
  const name = typeof meta.name === "string" && meta.name.trim() ? meta.name.trim().slice(0, 120) : null;
  const locale = typeof meta.locale === "string" && SUPPORTED_LOCALES.has(meta.locale) ? meta.locale : "en";

  const clash = await db.user.findUnique({ where: { email } });
  if (clash) throw new ProfileConflictError();

  return db.user.create({
    data: { id: claims.sub, email, name, locale, notificationPreference: { create: {} } },
  });
}

/** Comma-separated ADMIN_EMAILS (case-insensitive), as in Scanvio. */
export function isAdminEmail(email: string, env: Record<string, string | undefined> = process.env): boolean {
  const admins = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/**
 * True when this user has two-factor turned on but the session hasn't passed
 * it yet. Uses our database flag, not the client-editable session cookie.
 */
export function needsSecondFactor(user: Pick<User, "mfaEnrolledAt">, aal: string | undefined): boolean {
  return Boolean(user.mfaEnrolledAt) && aal !== "aal2";
}
