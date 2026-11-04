import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/public-chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "How it works · ImmigrationCaseTracker" };

export default function HowItWorks() {
  return (
    <Prose>
      <h1>How it works</h1>
      <h2>1. Add a receipt number you&apos;re authorized to track</h2>
      <p>
        Enter the 13-character receipt number from your USCIS notice (3 letters and 10 digits, such as EAC9999103402). You confirm
        it&apos;s your own case, or that the applicant has authorized you to track it. We record that consent with the date, and you
        can withdraw it at any time by removing the case.
      </p>
      <h2>2. We check the status with USCIS</h2>
      <p>
        We use the official USCIS Case Status API from our own secure servers. USCIS doesn&apos;t send updates on its own, so we
        ask: once when you add a case, about twice a day after that, and whenever you press &quot;Refresh now&quot; (at most once every
        10 minutes per case). That means a change appears here only after our next check.
      </p>
      <h2>3. See what changed and when</h2>
      <p>For every case we show:</p>
      <ul>
        <li>the current status, in English or Spanish, exactly as USCIS words it;</li>
        <li>
          <strong>last checked</strong>: when we last asked USCIS;
        </li>
        <li>
          <strong>last change seen</strong>: when we first noticed the status change;
        </li>
        <li>the history USCIS reports, kept separate from the changes we observed.</li>
      </ul>
      <h2>Your privacy</h2>
      <ul>
        <li>Receipt numbers are encrypted before they&apos;re stored, and never written to our logs.</li>
        <li>We send a receipt number only to USCIS, only to check its status.</li>
        <li>We never sell your information. Remove a case or delete your account, and the data is deleted.</li>
      </ul>
      <p>
        Read the <Link href="/privacy">Privacy Policy</Link> for details.
      </p>
      <h2>What we are not</h2>
      <p>
        {SITE.disclaimer} We show the status USCIS reports; we don&apos;t predict outcomes or processing times. For the official
        status, use{" "}
        <a href={SITE.uscisStatusUrl} target="_blank" rel="noopener noreferrer">
          USCIS Case Status Online
        </a>
        .
      </p>
    </Prose>
  );
}
