import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, Prose } from "@/components/public-chrome";
import { subprocessors } from "@/lib/legal/subprocessors";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Data Processing Agreement · CasePingo",
  description: "How CasePingo processes law firms' client data: on the firm's instructions only, with confidentiality, security, breach notice, subprocessor controls, and return or deletion.",
};

/** Bumped when the agreement text changes; firms are told before material changes. */
const DPA_VERSION = "Draft 1 · November 9, 2026";

export default function DpaPage() {
  const active = subprocessors().filter((s) => s.active);
  return (
    <Prose>
      <h1>Data Processing Agreement</h1>
      <p className="text-sm text-[var(--muted)]">{DPA_VERSION}</p>
      <DraftNotice />
      <p>
        This Data Processing Agreement (&quot;DPA&quot;) is part of the agreement between {SITE.company} (&quot;CasePingo&quot;, &quot;we&quot;) and a
        law firm or other organization that uses CasePingo Pro (&quot;the Firm&quot;). It applies to personal information the Firm and its team
        put into CasePingo Pro, including information about the Firm&apos;s clients (&quot;Firm Data&quot;). If this DPA and the{" "}
        <Link href="/terms">Terms of Service</Link> disagree about Firm Data, this DPA wins. A countersigned copy is available on request at{" "}
        {SITE.contactEmail}.
      </p>

      <h2>1. Roles</h2>
      <ul>
        <li>The Firm decides why and how Firm Data is used. It is the &quot;business&quot; or &quot;controller&quot; under privacy laws.</li>
        <li>
          CasePingo processes Firm Data only to provide CasePingo Pro to the Firm. It is the Firm&apos;s &quot;service provider&quot; or
          &quot;processor&quot;, including under the California Consumer Privacy Act (CCPA/CPRA) and similar state laws.
        </li>
        <li>Firm Data belongs to the Firm. CasePingo claims no ownership of it.</li>
      </ul>

      <h2>2. Processing only on the Firm&apos;s instructions</h2>
      <ul>
        <li>
          We process Firm Data only to run the service the Firm uses (case status checks, its inbox, client updates and status pages,
          document requests, tasks, reports and support the Firm asks for), and as the law requires.
        </li>
        <li>
          We do not sell or share Firm Data, use it for advertising, combine it with other customers&apos; data, or use it to train AI models.
          We don&apos;t use it for any purpose outside our agreement with the Firm.
        </li>
        <li>If we believe an instruction breaks the law, we&apos;ll tell the Firm and won&apos;t follow it.</li>
      </ul>

      <h2>3. Confidentiality and attorney-client information</h2>
      <ul>
        <li>
          We treat Firm Data as confidential. We understand it may include information protected by the attorney-client privilege or the
          Firm&apos;s professional duty of confidentiality, and we act as the Firm&apos;s agent in holding it. Nothing in how we process it is
          intended to waive any privilege.
        </li>
        <li>
          Only CasePingo staff who need it to run or support the service can access Firm Data, under confidentiality obligations. Support
          access to a Firm&apos;s workspace happens only when the Firm asks for help.
        </li>
      </ul>

      <h2>4. Requests from governments and other third parties</h2>
      <ul>
        <li>
          If a government agency (including immigration or law-enforcement authorities), a court or anyone else asks us for Firm Data, we
          will direct them to the Firm, notify the Firm promptly unless the law forbids it, and disclose only what we are legally required
          to.
        </li>
        <li>Where the law allows, we will challenge requests that are unlawful or overly broad.</li>
      </ul>

      <h2>5. Security</h2>
      <p>We maintain the technical and organizational measures in Annex 2 and keep them at least at that level for the life of the agreement.</p>

      <h2>6. Subprocessors</h2>
      <ul>
        <li>
          The Firm authorizes the subprocessors on our <Link href="/subprocessors">Subprocessors page</Link>. Each is bound by a written
          agreement with data-protection obligations no less protective than this DPA, and we remain responsible for their work.
        </li>
        <li>
          We will email the Firm&apos;s Owners at least 30 days before a new subprocessor starts receiving Firm Data. If the Firm objects on
          reasonable data-protection grounds and we can&apos;t resolve it, the Firm may cancel and receive a refund of prepaid fees for the
          unused period.
        </li>
      </ul>

      <h2>7. Helping with clients&apos; privacy requests</h2>
      <p>
        The Firm can view, correct, export and delete Firm Data itself in CasePingo Pro. If a person contacts us directly about Firm Data,
        we&apos;ll refer them to the Firm and help the Firm respond.
      </p>

      <h2>8. Security incidents</h2>
      <ul>
        <li>
          If we confirm unauthorized access to, or loss of, Firm Data in our systems or our subprocessors&apos; systems, we will notify the
          Firm&apos;s Owners without undue delay and in any case within 72 hours of confirming it.
        </li>
        <li>
          The notice will say what happened, which data and people may be affected, what we&apos;ve done to contain it, and a contact for
          questions. We will keep the Firm updated and help it meet its own notification duties to clients and regulators.
        </li>
      </ul>

      <h2>9. Return and deletion</h2>
      <ul>
        <li>The Firm can export all Firm Data at any time from Settings → Legal &amp; data, and download its documents.</li>
        <li>
          When the Firm deletes its workspace, everything in it (clients, cases, documents and their files, tasks, requests, logs) is deleted
          14 days after the request, unless the Firm cancels. Remaining copies in encrypted backups expire on our database provider&apos;s
          backup schedule and are not restored except to recover from a disaster.
        </li>
        <li>We keep Firm Data longer only where the law requires it, and keep protecting it while we do.</li>
      </ul>

      <h2>10. Information and audits</h2>
      <p>
        On request, we&apos;ll answer the Firm&apos;s reasonable security questionnaire and provide information needed to show we meet this DPA.
        We don&apos;t yet have a third-party audit report (such as SOC 2); we&apos;ll tell customers when we do.
      </p>

      <h2>11. Location</h2>
      <p>Firm Data is stored and processed in the United States.</p>

      <h2>12. Term and changes</h2>
      <p>
        This DPA lasts as long as we process Firm Data. We&apos;ll notify Firm Owners before material changes take effect; changes won&apos;t
        reduce the protection of Firm Data during a paid term.
      </p>

      <h2>Annex 1: Details of processing</h2>
      <ul>
        <li>
          <strong>Whose data:</strong> the Firm&apos;s team members, and the Firm&apos;s clients and their family members (which can include
          minors).
        </li>
        <li>
          <strong>What data:</strong> names and contact details; preferred language; date of birth, country of birth, citizenship and
          A-Number; USCIS receipt numbers, case statuses and history; case deadlines, tasks and notes; documents the Firm or its clients upload
          (which can include identity, civil, financial and medical documents); consent records; activity logs.
        </li>
        <li>
          <strong>Sensitive data:</strong> citizenship and immigration status, A-Numbers and dates of birth, and the contents of uploaded
          documents. They are used only to provide the service.
        </li>
        <li>
          <strong>How long:</strong> for the life of the Firm&apos;s workspace, then deleted as in section 9.
        </li>
      </ul>

      <h2>Annex 2: Security measures</h2>
      <ul>
        <li>Encryption at rest by CasePingo (AES-256-GCM) of receipt numbers, A-Numbers, dates of birth and every uploaded file, on top of the database provider&apos;s own disk encryption. Encrypted connections (TLS) everywhere.</li>
        <li>Each firm&apos;s data separated in the database with row-level security; every request checks the person&apos;s firm and role (Owner, Admin, Staff).</li>
        <li>Two-factor sign-in available to every user. Sign-in handled by our authentication provider; we never see passwords.</li>
        <li>Every upload checked before storage: file type recognised by its content, hidden programs, macros and risky PDF actions refused, and a malware scan.</li>
        <li>An activity log of changes, exports, downloads and deletions in each workspace, visible to the Firm&apos;s Owners and Admins. Receipt numbers and other sensitive values are never written to it.</li>
        <li>Client links (status pages, upload links) are signed, unguessable, can be replaced or turned off by the Firm, and pages are hidden from search engines.</li>
        <li>Case statuses come only from the official USCIS Case Status API, with the Firm&apos;s consent record for each case; no scraping.</li>
        <li>Staff access limited to what&apos;s needed; secrets kept in our hosting provider&apos;s encrypted settings, never in code.</li>
      </ul>

      <h2>Annex 3: Subprocessors</h2>
      <p>As listed on the <Link href="/subprocessors">Subprocessors page</Link> on the date the Firm accepts this DPA. Currently:</p>
      <ul>
        {active.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong>: {s.purpose} ({s.location}).
          </li>
        ))}
      </ul>
    </Prose>
  );
}
