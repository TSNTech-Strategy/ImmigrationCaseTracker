import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/public-chrome";
import { FEATURES } from "@/lib/features";
import { MIN_GROUP } from "@/lib/insights";
import { SITE } from "@/lib/site";
import { subprocessors } from "@/lib/legal/subprocessors";

export const metadata: Metadata = { title: "Privacy Policy · CasePingo" };

export default function Privacy() {
  return (
    <Prose>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-[var(--muted)]">Last updated {SITE.legalUpdated}</p>
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
          <strong>Case information you add:</strong> USCIS receipt numbers, optional nicknames and tags (labels such as
          &quot;Family&quot; that only you see), and your confirmation that you are authorized to track each case (with its date
          and wording).
        </li>
        <li>
          <strong>Status information from USCIS:</strong> form type, status text, dates and history USCIS returns for those
          receipt numbers, and when we observed each change.
        </li>
        <li>
          <strong>Document checklists:</strong> which checklist items you tick as gathered (just the item, such as &quot;birth
          certificate&quot;). We never ask you to upload documents.
        </li>
        <li>
          <strong>Not collected: immigration court cases.</strong> If you add a court case in the app (your A-Number, court and
          next hearing, for reminders), it stays on your phone. We never receive your A-Number, and we don&apos;t look up court
          cases.
        </li>
        <li>
          <strong>Law firm clients:</strong> when a law firm uses CasePingo, the firm decides what to add about its clients:
          <ul>
            <li>Names, contact details, preferred language, and whether the client agreed to get case updates.</li>
            <li>
              Optionally, date of birth, country of birth, citizenship and A-Number. Date of birth and A-Number are stored encrypted.
              Lists show only the last four A-Number digits.
            </li>
            <li>
              Documents the firm uploads, or that its clients upload through a private request link. Each file is checked for harmful
              content, encrypted, and kept in private storage. Only members of that firm can open it, or the client, if the firm shares
              the file on the client&apos;s status page.
            </li>
          </ul>
          If the firm turns on client updates, we use the client&apos;s email address only to send status updates and document requests
          for the firm. The firm can also give its client a private status page link, and can replace or turn off that link at any
          time. Clients can ask the firm, or us, to stop.
        </li>
        <li>
          <strong>Operational records:</strong> when each status check ran and whether it succeeded (no case content), security
          and audit logs of account actions, and basic technical data such as IP address needed to keep the service secure.
        </li>
      </ul>
      <p>
        If you track your own cases, we do not ask you for passport numbers, A-numbers, documents or other immigration records. A law firm
        may record its own clients&apos; A-Numbers and dates of birth in its workspace, and its clients may upload documents the firm asks
        for, as described above.
      </p>
      {FEATURES.assistant && (
        <p>
          If you use the assistant, what you write and its replies are sent to our AI provider to produce the answers. If you ask from a
          case, it also receives that case&apos;s form type and status text, never the receipt number. We don&apos;t store the
          conversation: it stays on your screen. We keep only how many questions you asked each day, to apply your plan&apos;s limit.
          Please don&apos;t include A-numbers or other ID numbers in your questions.
        </p>
      )}
      <p>
        If you use the app&apos;s receipt scanner, the photo of your notice is read on your phone to find the receipt number. The photo
        isn&apos;t sent to us, and the app deletes its own copy as soon as it has been read.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To check the status of cases you&apos;re authorized to track, and show you the results.</li>
        <li>To notify you about status changes, if you turn alerts on.</li>
        <li>
          To show Case insights: anonymous totals combined from many personal cases, such as how long cases like yours took at an
          office or which status usually comes next. Insights never show one person&apos;s case, a receipt number, a name or a
          nickname. A number appears only when at least {MIN_GROUP} cases are behind it, each case counts once, and law-firm cases
          are never included. Removing a case takes it out of the totals.
        </li>
        {FEATURES.assistant && <li>To answer the questions you ask the assistant.</li>}
        <li>To secure accounts, prevent abuse, and meet legal obligations.</li>
      </ul>
      <p>
        We do not use your case information for advertising. <strong>We do not sell, rent or trade personal information</strong>,
        for money or anything else. This includes de-identified, anonymized or pseudonymized data.
      </p>

      <h2>Consent</h2>
      <p>
        We check a case only after you confirm it&apos;s your own case or that the applicant authorized you. Removing the case
        withdraws that consent and stops all checks immediately.
      </p>

      <h2>Who we share it with</h2>
      <p>
        We share information only with service providers who process it on our behalf, under contract, and only for the job they do for us.
        The full, current list with what each one receives is on our <Link href="/subprocessors">Subprocessors page</Link>:
      </p>
      <ul>
        <li>
          <strong>USCIS</strong>: we send a receipt number to the official USCIS Case Status API to retrieve its status.
        </li>
        {subprocessors()
          .filter((p) => p.active)
          .map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong>: {p.purpose}. It receives: {p.data.charAt(0).toLowerCase() + p.data.slice(1)}.
            </li>
          ))}
        {FEATURES.assistant && (
          <li>Our AI provider doesn&apos;t use assistant conversations to train its models under its commercial terms.</li>
        )}
      </ul>
      <p>
        Every provider is bound by a written contract to protect your information as this policy requires, and may use it only to
        provide its service to us. <strong>No third party may use or disclose your information</strong>, including de-identified,
        anonymized or pseudonymized data, for any other purpose without your active consent.
      </p>
      <p>
        Law firms: how we process your clients&apos; information is set out in our <Link href="/dpa">Data Processing Agreement</Link>.
      </p>
      <p>We may also disclose information if the law requires it. We will tell you unless the law forbids us to.</p>

      <h2>Your choices about sharing</h2>
      <ul>
        <li>
          <strong>Which cases to add.</strong> We only contact USCIS about receipt numbers you add. Removing a case stops all checks.
        </li>
        <li>
          <strong>Alerts.</strong> You can turn email and phone alerts on or off. Alerts can show a case nickname and status on your
          lock screen or in your inbox, so anyone who can see your phone or email may see them. Using a nickname that doesn&apos;t
          name the person lowers this risk.
        </li>
        <li>
          <strong>Case insights.</strong> Your personal cases count toward anonymous totals that help everyone see typical timelines.
          The benefit is better information for all users. The limit is that totals are never shown for fewer than {MIN_GROUP} cases,
          so no one can be singled out. To leave the totals, remove the case.
        </li>
        <li>
          <strong>Sharing a case with others.</strong> Information about an immigration case can also concern family members on the
          same application. Only add a case, or share its details, with the permission of the people it is about.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Receipt numbers are encrypted before they&apos;re stored and are never written to logs. Data is encrypted in transit. Access
        is limited to what each part of the service needs. Two-factor sign-in is available for every account.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Case information: until you remove the case or delete your account.</li>
        <li>Case insights: not stored; they are calculated from the cases being tracked at that moment.</li>
        <li>Account information: until you delete your account.</li>
        <li>
          Dormant accounts: if you don&apos;t sign in for 24 months, we email you. If you still don&apos;t sign in within 30 days of
          that email, we delete the account and everything in it. This doesn&apos;t apply while you have a paid plan or belong to a law
          firm workspace.
        </li>
        {FEATURES.assistant && (
          <li>Assistant: conversations aren&apos;t stored by CasePingo; daily question counts (no content) are kept for 30 days.</li>
        )}
        <li>Records of deletion requests and security logs: 12 months, without case content.</li>
        <li>
          Free-trial records: a one-way fingerprint of the email address and of receipt numbers used during a free trial (never the
          email or receipt number itself), kept for 12 months so each person and each case gets one trial. They are kept even if you
          delete your account, and can&apos;t be used to identify you or your case.
        </li>
        <li>Backups: deleted data may remain in encrypted backups for up to 30 days before being overwritten.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Remove any case from its page. To delete everything, use <strong>Settings → Delete account</strong>; your account, cases,
        history and consent records are deleted immediately. You can also email {SITE.contactEmail}.
      </p>
      <p>
        Law firms: an Owner can download everything the firm has in CasePingo from <strong>Settings → Legal &amp; data</strong>, and
        delete the whole workspace there. Deletion happens 14 days after it is requested (the firm can cancel it until then) and removes
        the firm&apos;s clients, cases, documents and their files, tasks, requests and logs. A law firm&apos;s client can ask the firm, or us,
        to remove their information.
      </p>

      <h2>Data breaches</h2>
      <p>
        If a security incident affects your personal information, we will notify you and any authorities as the law requires,
        without undue delay. Our notice will say what happened, what information was involved, what we are doing about it, and
        what you can do to protect yourself, such as changing your password or watching for suspicious emails. We will never ask
        for your password by email.
      </p>

      <h2>California residents</h2>
      <p>If you live in California, you have the right to:</p>
      <ul>
        <li>Know what personal information we collect, use and share (this policy describes it).</li>
        <li>Ask for a copy of your personal information, or ask us to correct or delete it.</li>
        <li>Not have your personal information sold or shared. We don&apos;t sell or share it.</li>
        <li>Not be treated differently for using these rights.</li>
      </ul>
      <p>
        To make a request, email {SITE.contactEmail}. We will confirm it&apos;s you and reply within 45 days. We give the same rights
        to every user, wherever they live.
      </p>

      <h2>Children</h2>
      <p>Accounts are for adults (18+). A parent or guardian may track a child&apos;s case they are authorized to follow.</p>

      <h2>Changes of ownership</h2>
      <p>
        If {SITE.company} is involved in a merger, acquisition or sale of assets, personal information may transfer to the new
        owner. The new owner must follow this policy. We will notify you before the transfer, and you can delete your account
        before it happens. If {SITE.company} closes without a new owner, we will delete all personal information.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We will post updates here and email you before material changes take effect, with a plain-language summary of what changed.
        We will ask you to accept the updated policy the next time you sign in. We won&apos;t apply a material change to your
        information until you accept it. If you don&apos;t accept, you can delete your account.
      </p>

      <h2>Contact</h2>
      <p>
        {SITE.company} — {SITE.contactEmail}. See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </Prose>
  );
}
