import type { Metadata } from "next";
import { ResourceCard } from "@/components/resource-ui";
import { OFFICIAL_TOOLS, RESOURCES, resourcePath, STATUS_LIBRARY_CARD } from "@/lib/resources";

export const metadata: Metadata = {
  title: "Resources: guides for your USCIS case · CasePingo",
  description:
    "Plain-language guides for your USCIS case: what your status means, how to read processing times, interviews, civics test practice, official news, the Visa Bulletin and common questions.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-[var(--brand-red-text)]">Resources</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Guides for every step of your case</h1>
        <p className="max-w-3xl text-lg leading-relaxed text-[var(--muted)]">
          What your status means, how long things usually take, how to prepare for an interview, and where official news is posted.
          General information, not legal advice.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ResourceCard href={STATUS_LIBRARY_CARD.path} icon={STATUS_LIBRARY_CARD.icon} title={STATUS_LIBRARY_CARD.title.en} summary={STATUS_LIBRARY_CARD.summary.en} />
        {RESOURCES.slice(0, 2).map((r) => (
          <ResourceCard key={r.slug} href={resourcePath(r.slug)} icon={r.icon} title={r.title.en} summary={r.summary.en} />
        ))}
        <ResourceCard
          href="/checklists"
          icon={{ md: "checklist", tint: "green" }}
          title="Document checklists"
          summary="What to gather before you file, for each case type. Tick documents off as you go."
        />
        <ResourceCard
          href="/civics-test"
          icon={{ md: "school", tint: "purple" }}
          title="Civics test practice"
          summary="USCIS's official questions: a mock test with the real pass and fail rules, or one section at a time."
        />
        <ResourceCard
          href="/visa-bulletin"
          icon={{ md: "calendar_month", tint: "blue" }}
          title="Visa Bulletin"
          summary="How to check your green card date, with links to the official bulletin."
        />
        {RESOURCES.slice(2).map((r) => (
          <ResourceCard key={r.slug} href={resourcePath(r.slug)} icon={r.icon} title={r.title.en} summary={r.summary.en} />
        ))}
      </div>
      <section aria-labelledby="tools-h" className="flex flex-col gap-3">
        <h2 id="tools-h" className="text-xl font-bold tracking-tight">
          Official tools
        </h2>
        <p className="text-sm text-[var(--muted)]">Straight to the USCIS and CBP pages people use most. They open on the official sites.</p>
        <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {OFFICIAL_TOOLS.map((t) => (
            <li key={t.key}>
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{t.title.en}</span>
                  <span className="text-sm text-[var(--muted)]">{t.summary.en}</span>
                </span>
                <span aria-hidden="true" className="text-[var(--accent)]">
                  ↗
                </span>
                <span className="sr-only">(opens the official site in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
