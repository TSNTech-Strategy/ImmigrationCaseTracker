import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, Prose } from "@/components/public-chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy · CasePingo" };

export default function Privacy() {
  return (
    <Prose>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-[var(--muted)]">Last updated {SITE.legalUpdated}</p>
      <DraftNotice />
      <p>
        This policy explains what {SITE.name} (&quot;we&quot;), operated by {SITE.company}, collects, why, who we share it with,
        how long we keep it, and how you can delete it. {SITE.disclaimer}
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and language preference. Your password is handled by our
          sign-in provider and we never see it.
        </li>
        <li>
          <strong>Case information you add:</strong> USCIS receipt numbers, optional nicknames, and your confirmation that you are
          authorized to track each case (with its date and wording).
        </li>
        <li>
          <strong>Status information from USCIS:</strong> form type, status text, dates and history USCIS returns for those
          receipt numbers, and when we observed each change.
        </li>
        <li>
          <strong>Operational records:</strong> when each status check ran and whether it succeeded (no case content), security
          and audit logs of account actions, and basic technical data such as IP address needed to keep the service secure.
        </li>
      </ul>
      <p>We do not ask for passport numbers, A-numbers, documents or other immigration records.</p>
      <p>
        If you use the app&apos;s receipt scanner, the photo of your notice is read on your phone to find the receipt number. The photo
        isn&apos;t sent to us, and the app deletes its own copy as soon as it has been read.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To check the status of cases you&apos;re authorized to track, and show you the results.</li>
        <li>To notify you about status changes, if you turn alerts on.</li>
        <li>To secure accounts, prevent abuse, and meet legal obligations.</li>
      </ul>
      <p>We do not use your case information for advertising, and we do not sell or rent personal information to anyone.</p>

      <h2>Consent</h2>
      <p>
        We check a case only after you confirm it&apos;s your own case or that the applicant authorized you. Removing the case
        withdraws that consent and stops all checks immediately.
      </p>

      <h2>Who we share it with</h2>
      <p>We share information only with service providers who process it on our behalf, under contract:</p>
      <ul>
        <li>
          <strong>USCIS</strong>: we send a receipt number to the official USCIS Case Status API to retrieve its status.
        </li>
        <li>
          <strong>Supabase</strong>: database and sign-in (United States).
        </li>
        <li>
          <strong>Vercel</strong>: website hosting.
        </li>
        <li>
          <strong>Email delivery provider</strong>: to send account and alert emails. [Provider to be named before launch.]
        </li>
      </ul>
      <p>We may also disclose information if the law requires it. We will tell you unless the law forbids us to.</p>

      <h2>Security</h2>
      <p>
        Receipt numbers are encrypted before they&apos;re stored and are never written to logs. Data is encrypted in transit. Access
        is limited to what each part of the service needs. Two-factor sign-in is available for every account.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Case information: until you remove the case or delete your account.</li>
        <li>Account information: until you delete your account.</li>
        <li>Records of deletion requests and security logs: [retention period to be confirmed with counsel], without case content.</li>
        <li>
          Free-trial records: a one-way fingerprint of the email address and of receipt numbers used during a free trial (never the
          email or receipt number itself), kept for 12 months so each person and each case gets one trial. They are kept even if you
          delete your account, and can&apos;t be used to identify you or your case.
        </li>
        <li>Backups: deleted data may remain in encrypted backups for up to [backup window] before being overwritten.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Remove any case from its page. To delete everything, use <strong>Settings → Delete account</strong>; your account, cases,
        history and consent records are deleted immediately. You can also email {SITE.contactEmail}.
      </p>

      <h2>Data breaches</h2>
      <p>
        If a security incident affects your personal information, we will notify you and any authorities as the law requires,
        without undue delay.
      </p>

      <h2>Children</h2>
      <p>Accounts are for adults (18+). A parent or guardian may track a child&apos;s case they are authorized to follow.</p>

      <h2>Changes of ownership</h2>
      <p>
        If {SITE.company} is involved in a merger, acquisition or sale of assets, personal information may transfer to the new
        owner, who must honor this policy. We will notify you before your information becomes subject to a different policy.
      </p>

      <h2>Changes to this policy</h2>
      <p>We will post updates here and email you about material changes before they take effect.</p>

      <h2>Contact</h2>
      <p>
        {SITE.company} — {SITE.contactEmail}. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </Prose>
  );
}
