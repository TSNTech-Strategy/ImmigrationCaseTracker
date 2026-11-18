// Public facts used across the site and legal pages.

export const SITE = {
  /** Public brand. (The USCIS developer app and the repo keep the name ImmigrationCaseTracker.) */
  name: "CasePingo",
  /** Official tagline (brand kit v1). */
  tagline: "Never Miss a Case Update",
  /** Primary domain once purchased; the live address comes from NEXT_PUBLIC_SITE_URL. */
  domain: "casepingo.com",
  company: "TSN TECH & STRATEGY NETWORK LLC",
  /** Shown on legal pages. NEXT_PUBLIC_CONTACT_EMAIL overrides it. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "support@casepingo.com",
  /** Where security reports go (security.txt, the Security page). Forwarded by ImprovMX. */
  securityEmail: "security@casepingo.com",
  /** Date the current Terms and Privacy Policy were published. */
  legalUpdated: "November 18, 2026",
  /**
   * Version users accept (at sign-up, or on /legal/accept). Change it, and
   * legalChanges, only for a material change: every signed-in user is then
   * asked to accept again before using the app.
   */
  legalVersion: "2026-11-18",
  /** Plain-language summary of the latest material change, shown on /legal/accept. */
  legalChanges: [
    "Plans and billing: the Terms now explain the free plan, free trials (no card, no automatic charge), renewal, cancellation and refunds.",
    "Dormant accounts: if you don't sign in for 24 months, we email you, then delete the account 30 days later if you still don't sign in.",
    "Your choices: a new section explains your choices about sharing, and the risks and benefits.",
    "Third parties may never use or share your information for other purposes without your active consent. We never sell it.",
    "New sections on data breaches, California privacy rights, and what happens if the company changes owner or closes.",
    "From now on, we will ask you to accept any material change, like this one.",
  ],
  disclaimer:
    "CasePingo is an independent service. It is not affiliated with or endorsed by U.S. Citizenship and Immigration Services (USCIS) or the Department of Homeland Security (DHS), and it does not provide legal advice.",
  uscisStatusUrl: "https://egov.uscis.gov/",
} as const;
