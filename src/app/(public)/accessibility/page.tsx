import type { Metadata } from "next";
import { Prose } from "@/components/public-chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Accessibility · ImmigrationCaseTracker" };

export default function Accessibility() {
  return (
    <Prose>
      <h1>Accessibility statement</h1>
      <p className="text-sm text-[var(--muted)]">Last updated {SITE.legalUpdated}</p>
      <p>
        We want everyone to be able to follow their case. {SITE.name} aims to meet the Web Content Accessibility Guidelines (WCAG)
        2.1 Level AA, consistent with Section 508 expectations for services that use USCIS APIs.
      </p>
      <h2>What we do</h2>
      <ul>
        <li>Every form field has a visible label, and errors are announced to screen readers.</li>
        <li>Everything works with a keyboard, with a visible focus outline.</li>
        <li>Text and controls meet minimum contrast ratios, in both light and dark mode.</li>
        <li>Pages reflow on small screens and when zoomed to 200%.</li>
        <li>Case statuses are available in English and Spanish.</li>
      </ul>
      <h2>Known limitations</h2>
      <p>We are still testing with screen readers and will list any known issues here as we find them.</p>
      <h2>Feedback</h2>
      <p>
        If something is hard to use, email {SITE.contactEmail}. We aim to respond within five business days and can provide
        information in another format.
      </p>
    </Prose>
  );
}
