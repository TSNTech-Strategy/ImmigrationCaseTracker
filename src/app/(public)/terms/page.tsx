import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, Prose } from "@/components/public-chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service · CasePingo" };

export default function Terms() {
  return (
    <Prose>
      <h1>Terms of Service</h1>
      <p className="text-sm text-[var(--muted)]">Last updated {SITE.legalUpdated}</p>
      <DraftNotice />
      <p>
        These terms are an agreement between you and {SITE.company} for use of {SITE.name}. By creating an account you agree to
        them.
      </p>

      <h2>The service</h2>
      <p>
        {SITE.name} retrieves case statuses from the official USCIS Case Status API for receipt numbers you are authorized to
        track, and shows them to you. {SITE.disclaimer}
      </p>

      <h2>Not legal advice; USCIS is authoritative</h2>
      <p>
        Statuses are shown as USCIS reports them and may be delayed until our next check. We do not predict decisions or
        processing times. Always confirm with{" "}
        <a href={SITE.uscisStatusUrl} target="_blank" rel="noopener noreferrer">
          USCIS
        </a>{" "}
        and consult a qualified attorney or accredited representative for legal advice.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Only add receipt numbers for your own cases or cases you are authorized to track.</li>
        <li>Never add receipt numbers you found, guessed or obtained without permission, or try to look up other people&apos;s cases.</li>
        <li>Keep your sign-in details secure, and tell us about unauthorized use.</li>
        <li>Don&apos;t misuse the service: no automated scraping, overloading, or attempts to get around limits or security.</li>
      </ul>
      <p>We may suspend accounts that break these rules.</p>

      <h2>Availability</h2>
      <p>
        The service depends on USCIS and other providers and may be unavailable at times. We may change or discontinue features,
        with notice where reasonable.
      </p>

      <h2>Paid plans</h2>
      <p>Paid plans are not yet available. When they are, prices, billing, renewal, cancellation and refunds will be described here.</p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in Settings. We may close accounts that violate these terms, with notice where
        appropriate.
      </p>

      <h2>Disclaimers and limitation of liability</h2>
      <p>
        The service is provided &quot;as is&quot;. To the extent the law allows, {SITE.company} is not liable for indirect or
        consequential losses, or for decisions made based on statuses shown in the service. [Liability cap and wording to be
        finalized with counsel.]
      </p>

      <h2>Privacy</h2>
      <p>
        Our <Link href="/privacy">Privacy Policy</Link> explains how we handle your information. For law firms using CasePingo Pro, our{" "}
        <Link href="/dpa">Data Processing Agreement</Link> is part of these terms and governs how we process the firm&apos;s client data;
        the companies that help us are listed on our <Link href="/subprocessors">Subprocessors page</Link>.
      </p>

      <h2>Changes of ownership</h2>
      <p>
        If {SITE.company} undergoes a merger, acquisition or sale of assets, these terms and your account may transfer to the new
        owner. We will notify you in advance.
      </p>

      <h2>Changes to these terms</h2>
      <p>We will post updates here and notify you of material changes before they take effect.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of [State to be confirmed], United States.</p>

      <h2>Contact</h2>
      <p>
        {SITE.company} — {SITE.contactEmail}
      </p>
    </Prose>
  );
}
