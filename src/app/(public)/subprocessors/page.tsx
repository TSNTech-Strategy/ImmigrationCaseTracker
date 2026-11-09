import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, Prose } from "@/components/public-chrome";
import { SUBPROCESSORS_UPDATED, subprocessors } from "@/lib/legal/subprocessors";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Subprocessors · CasePingo",
  description: "The outside companies that process customer data for CasePingo, what each one receives, and where.",
};

export default function SubprocessorsPage() {
  const all = subprocessors();
  const active = all.filter((s) => s.active);
  const inactive = all.filter((s) => !s.active);
  return (
    <Prose>
      <h1>Subprocessors</h1>
      <p className="text-sm text-[var(--muted)]">Last updated {SUBPROCESSORS_UPDATED}</p>
      <DraftNotice />
      <p>
        These are the companies that process customer data on behalf of {SITE.company} to run {SITE.name}. Each works under a written
        agreement that limits it to providing its service to us. All of them process data in the United States. For law firms, this list
        is part of our <Link href="/dpa">Data Processing Agreement</Link>.
      </p>
      <p>
        <strong>Not a subprocessor:</strong> USCIS. We send a receipt number to the official USCIS Case Status API to get its status;
        USCIS is the government source of the data, not a provider working for us.
      </p>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Company</th>
              <th className="px-3 py-2.5 font-semibold">What it does for us</th>
              <th className="px-3 py-2.5 font-semibold">Data it receives</th>
              <th className="px-3 py-2.5 font-semibold">Who it applies to</th>
              <th className="px-3 py-2.5 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] align-top">
            {active.map((s) => (
              <tr key={s.name}>
                <td className="px-3 py-3">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold">
                    {s.name}
                  </a>
                  <span className="block text-xs text-[var(--muted)]">{s.entity}</span>
                </td>
                <td className="px-3 py-3">{s.purpose}</td>
                <td className="px-3 py-3">{s.data}</td>
                <td className="whitespace-nowrap px-3 py-3">{s.scope}</td>
                <td className="px-3 py-3">{s.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inactive.length > 0 && (
        <>
          <h2>Listed but not in use</h2>
          <p>These are set up for features that are switched off. They receive no data until the feature is turned on, and we&apos;ll update this page first.</p>
          <ul>
            {inactive.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong> ({s.entity}): {s.purpose}.
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>How we protect data sent to them</h2>
      <ul>
        <li>Receipt numbers, A-Numbers, dates of birth and every uploaded file are encrypted by CasePingo before they reach our database or file storage.</li>
        <li>Each provider gets only what its job needs: our scheduler sees record IDs, not names or documents; card numbers go to Stripe and never to us.</li>
        <li>Data moves over encrypted connections (TLS).</li>
      </ul>

      <h2>Changes to this list</h2>
      <p>
        Before a new subprocessor starts receiving customer data, we update this page and email the Owners of law-firm workspaces at least 30
        days ahead. A firm that objects on reasonable data-protection grounds can tell us at {SITE.contactEmail}; if we can&apos;t resolve
        it, the firm may cancel and receive a refund of prepaid fees for the unused period.
      </p>
    </Prose>
  );
}
