// Public facts used across the site and legal pages.

export const SITE = {
  /** Public brand. (The USCIS developer app and the repo keep the name ImmigrationCaseTracker.) */
  name: "CasePingo",
  /** Official tagline (brand kit v1). */
  tagline: "Never Miss a Case Update",
  /** Primary domain once purchased; the live address comes from NEXT_PUBLIC_SITE_URL. */
  domain: "casepingo.com",
  company: "TSN TECH & STRATEGY NETWORK LLC",
  /** Shown on legal pages. Set NEXT_PUBLIC_CONTACT_EMAIL once the company mailbox exists. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "[contact email — to be added]",
  /** Date the current legal drafts were written. */
  legalUpdated: "November 6, 2026",
  disclaimer:
    "CasePingo is an independent service. It is not affiliated with or endorsed by U.S. Citizenship and Immigration Services (USCIS) or the Department of Homeland Security (DHS), and it does not provide legal advice.",
  uscisStatusUrl: "https://egov.uscis.gov/",
} as const;
