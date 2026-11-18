import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/public-chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service · CasePingo" };

export default function Terms() {
  return (
    <Prose>
      <h1>Terms of Service</h1>
      <p className="text-sm text-[var(--muted)]">Last updated {SITE.legalUpdated}</p>
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

      <h2>Plans, trials and billing</h2>
      <ul>
        <li>
          {SITE.name} has a free plan and paid plans. Current prices and what each plan includes are on our{" "}
          <Link href="/pricing">Pricing page</Link>.
        </li>
        <li>
          New personal accounts get a free 7-day Premium trial, and new law firms get a free 14-day trial. No card is needed. When a
          trial ends, you move to the free plan unless you choose a paid plan. We never charge you automatically after a trial.
        </li>
        <li>
          Payments are handled by Stripe. Paid plans renew automatically each month or year until you cancel. Prices may include tax
          where the law requires it.
        </li>
        <li>
          You can cancel at any time in Billing (law firms: Firm → Billing). You keep your paid features until the end of the period you paid for, and you
          won&apos;t be charged again.
        </li>
        <li>
          Payments are not refunded for partly used periods, except where the law requires it. If we charged you by mistake, contact
          us and we will refund it.
        </li>
        <li>We will email you at least 30 days before a price increase affects your plan.</li>
      </ul>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time in Settings. We may close accounts that violate these terms, with notice where
        appropriate.
      </p>

      <h2>Disclaimers and limitation of liability</h2>
      <p>
        The service is provided &quot;as is&quot;. To the extent the law allows, {SITE.company} is not liable for indirect or
        consequential losses, or for decisions made based on statuses shown in the service. Our total liability for any claim is
        limited to the greater of the amount you paid us in the 12 months before the claim, or $100.
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
      <p>
        We will post updates here and email you before material changes take effect, with a plain-language summary of what changed.
        We will ask you to accept the updated terms the next time you sign in. If you don&apos;t accept, you can delete your account.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of Ohio, United States.</p>

      <h2>Contact</h2>
      <p>
        {SITE.company} — {SITE.contactEmail}
      </p>
    </Prose>
  );
}
