import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { firmService, firmUpdateService } from "@/lib/firms";
import { CLIENT_UPDATE_MODES } from "@/lib/firms/updates";
import { ClientUpdateSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Client updates · CasePingo" };

export default async function ClientUpdateSettingsPage() {
  const user = await requireUser("/firm/updates/settings");
  const ctx = await firmService().getContext(user.id);
  if (!ctx) redirect("/firm");
  if (ctx.membership.role === "STAFF") redirect("/firm/updates");
  const { firm } = ctx;
  const samples = firmUpdateService().sampleEmails(firm);
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/firm/updates" className="text-sm font-medium text-[var(--accent)] hover:underline">
          ← Updates
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Client updates</h1>
        <p className="text-sm text-[var(--muted)]">
          CasePingo can email your clients when USCIS changes their case: in plain English or Spanish, with the next step, signed with your firm&apos;s name. Clients are only emailed when you&apos;ve recorded their agreement on their client page.
        </p>
      </div>
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
        <ClientUpdateSettingsForm initial={{ mode: firm.clientUpdates, replyToEmail: firm.replyToEmail ?? "", contactLine: firm.clientContactLine ?? "" }} modes={CLIENT_UPDATE_MODES} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">What your clients get</h2>
        <p className="text-sm text-[var(--muted)]">A sample with your current settings. Each client gets it in the language set on their client page. Save to see changes here.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(["en", "es"] as const).map((l) => (
            <figure key={l} className="flex min-w-0 flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm" lang={l}>
              <figcaption className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{l === "en" ? "English" : "Español"}</figcaption>
              <p className="text-xs text-[var(--muted)]">
                From: {samples[l].fromName}
                {samples[l].replyTo ? ` · Reply-to: ${samples[l].replyTo}` : ""}
              </p>
              <p className="font-semibold">{samples[l].subject}</p>
              <p className="whitespace-pre-line leading-relaxed [overflow-wrap:anywhere]">{samples[l].body}</p>
            </figure>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">Have a lawyer on your team read the wording before you turn on Automatic.</p>
      </section>
    </>
  );
}
