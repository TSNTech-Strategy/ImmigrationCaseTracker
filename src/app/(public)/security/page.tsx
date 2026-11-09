import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/public-chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security · CasePingo",
  description: "How CasePingo protects immigration case data: encryption, access controls, safe uploads, official USCIS data only, and how to report a security problem.",
};

export default function SecurityPage() {
  return (
    <Prose>
      <h1>Security at {SITE.name}</h1>
      <p className="text-sm text-[var(--muted)]">Last updated November 9, 2026</p>
      <p>
        Immigration records are among the most sensitive information a person has. This page explains, in plain terms, how we protect them.
        It describes what is in place today; we don&apos;t list plans as if they were done.
      </p>

      <h2>Encryption</h2>
      <ul>
        <li>
          Receipt numbers, A-Numbers, dates of birth and every uploaded document are encrypted by {SITE.name} (AES-256-GCM) before they are
          stored, on top of our database provider&apos;s own disk encryption. A copy of our database or file storage alone doesn&apos;t reveal them.
        </li>
        <li>All connections use HTTPS (TLS). Receipt numbers are never written to our logs.</li>
      </ul>

      <h2>Access</h2>
      <ul>
        <li>Two-factor sign-in is available to every account. Passwords are handled by our sign-in provider; we never see them.</li>
        <li>
          Each law firm&apos;s data is kept separate in the database (row-level security), and every request checks the person&apos;s firm and role
          (Owner, Admin or Staff).
        </li>
        <li>Our staff can reach customer data only when needed to run or support the service. Secrets are kept in our hosting provider&apos;s encrypted settings, never in code.</li>
        <li>Each firm has an activity log of changes, exports, downloads and deletions, visible to its Owners and Admins.</li>
      </ul>

      <h2>Safe document uploads</h2>
      <ul>
        <li>Files are recognised by their contents, not their names; only PDFs, photos and Word documents are accepted, up to 4 MB.</li>
        <li>Files containing hidden programs, Word macros or embedded objects, or PDFs that try to open programs, are refused.</li>
        <li>Every file is scanned for malware before it is stored. Refused files are never stored.</li>
        <li>Links we give clients (status pages and upload links) are signed and unguessable, hidden from search engines, and can be replaced or turned off by the firm at any time.</li>
      </ul>

      <h2>Where case data comes from</h2>
      <p>
        Case statuses come only from the official USCIS Case Status API, and only for cases with a recorded consent (the person&apos;s own, or a law
        firm&apos;s Form G-28 or client agreement). We never scrape USCIS or other government websites.
      </p>

      <h2>Where data is kept</h2>
      <p>
        In the United States, with the providers on our <Link href="/subprocessors">Subprocessors page</Link>. Law firms get a{" "}
        <Link href="/dpa">Data Processing Agreement</Link> covering confidentiality, government requests and breach notice.
      </p>

      <h2>Your control</h2>
      <ul>
        <li>Individuals can delete their account and all their cases from Settings at any time.</li>
        <li>A law firm&apos;s Owner can export everything, or delete the whole workspace, from Settings → Legal &amp; data.</li>
      </ul>

      <h2>If something goes wrong</h2>
      <p>
        If we confirm unauthorized access to customer data, we notify affected customers without undue delay; for law firms, within 72 hours of
        confirming it, as our Data Processing Agreement says. Service status is published on our <Link href="/system-status">status page</Link>.
      </p>

      <h2>Certifications</h2>
      <p>
        We don&apos;t have a third-party audit report (such as SOC 2) yet. Law firms can ask us to complete their security questionnaire at{" "}
        {SITE.contactEmail}. We&apos;ll announce any certification here when we have it.
      </p>

      <h2 id="reporting">Report a security problem</h2>
      <p>
        If you believe you&apos;ve found a security issue, email <a href={`mailto:${SITE.securityEmail}`}>{SITE.securityEmail}</a> with the details
        and steps to reproduce it. We&apos;ll acknowledge your report, keep you updated, and won&apos;t take action against good-faith research that
        avoids privacy violations, data destruction and service disruption, and that doesn&apos;t access more data than needed to show the problem.
        Please don&apos;t test against other people&apos;s accounts or data. Our contact details are also in{" "}
        <a href="/.well-known/security.txt">security.txt</a>.
      </p>
    </Prose>
  );
}
