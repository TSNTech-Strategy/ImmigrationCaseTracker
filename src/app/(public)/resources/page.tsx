import type { Metadata } from "next";
import { ResourceCard } from "@/components/resource-ui";
import { RESOURCES, resourcePath, STATUS_LIBRARY_CARD } from "@/lib/resources";

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
    </div>
  );
}
