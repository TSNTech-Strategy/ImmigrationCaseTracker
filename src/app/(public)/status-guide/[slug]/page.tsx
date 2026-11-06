import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusBadge } from "@/components/status-badge";
import { STATUS_GUIDE, guideCategory, guideHeading, guidePath, statusGuideBySlug } from "@/lib/status-guide";
import { SITE } from "@/lib/site";

export async function generateStaticParams() {
  return STATUS_GUIDE.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/status-guide/[slug]">): Promise<Metadata> {
  const g = statusGuideBySlug((await params).slug);
  if (!g) return { title: "Status guide · CasePingo" };
  const description = `${g.meaning.en} ${g.next.en}`;
  return {
    title: `“${guideHeading(g)}”: what it means · CasePingo`,
    description: description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description,
    alternates: { canonical: guidePath(g) },
  };
}

export default function StatusGuidePage(props: PageProps<"/status-guide/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-3xl px-4 py-16 text-[var(--muted)]">Loading…</div>}>
      <GuideDetail params={props.params} />
    </Suspense>
  );
}

async function GuideDetail({ params }: { params: PageProps<"/status-guide/[slug]">["params"] }) {
  const g = statusGuideBySlug((await params).slug);
  if (!g) notFound();
  const wordings = [g.title, ...(g.aliases ?? [])];
  const related = STATUS_GUIDE.filter((x) => x.slug !== g.slug && guideCategory(x) === guideCategory(g)).slice(0, 5);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/status-guide" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Status guide
        </Link>
      </nav>
      <div className="mt-6">
        <StatusBadge titleEn={g.title} />
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{guideHeading(g)}</h1>
      <p className="mt-2 text-lg text-[var(--muted)]">What this USCIS case status means</p>

      <div className="mt-8 flex flex-col gap-7 text-[1.05rem] leading-relaxed">
        <section aria-labelledby="meaning-h">
          <h2 id="meaning-h" className="text-xl font-semibold">
            What it means
          </h2>
          <p className="mt-2">{g.meaning.en}</p>
        </section>
        <section aria-labelledby="next-h">
          <h2 id="next-h" className="text-xl font-semibold">
            What usually happens next
          </h2>
          <p className="mt-2">{g.next.en}</p>
        </section>
        {g.todo && (
          <section aria-labelledby="todo-h">
            <h2 id="todo-h" className="text-xl font-semibold">
              What you can do
            </h2>
            <p className="mt-2">{g.todo.en}</p>
          </section>
        )}
        {wordings.length > 1 && (
          <section aria-labelledby="wording-h">
            <h2 id="wording-h" className="text-xl font-semibold">
              Wording USCIS uses
            </h2>
            <ul className="mt-2 flex flex-col gap-1 text-base">
              {wordings.map((w) => (
                <li key={w}>“{w}”</li>
              ))}
            </ul>
          </section>
        )}
        <details lang="es" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-base">
          <summary className="cursor-pointer font-medium">Leer en español</summary>
          <div className="mt-3 flex flex-col gap-3">
            <p>
              <strong>Qué significa:</strong> {g.meaning.es}
            </p>
            <p>
              <strong>Qué suele pasar después:</strong> {g.next.es}
            </p>
            {g.todo && (
              <p>
                <strong>Qué puede hacer:</strong> {g.todo.es}
              </p>
            )}
            <p className="text-sm text-[var(--muted)]">Información general, no es asesoría legal.</p>
          </div>
        </details>
      </div>

      <aside className="mt-12 flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-lg font-semibold">Get told when your status changes</p>
        <p className="text-sm text-[var(--muted)]">
          Add your receipt number once. CasePingo checks it with USCIS, keeps the history, and shows what each new status means.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
            Start free
          </Link>
          <Link href="/how-it-works" className="rounded-lg border border-[var(--border)] px-4 py-2.5 font-medium hover:bg-[var(--surface-2)]">
            How it works
          </Link>
        </div>
      </aside>

      {related.length > 0 && (
        <section aria-labelledby="related-h" className="mt-12">
          <h2 id="related-h" className="text-xl font-semibold">
            Related statuses
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={guidePath(r)} className="text-[var(--accent)] underline-offset-2 hover:underline">
                  {guideHeading(r)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 text-xs text-[var(--muted)]">
        General information, not legal advice. Status names are USCIS&apos;s public wording. For your official status, use{" "}
        <a href={SITE.uscisStatusUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          USCIS Case Status Online
        </a>
        .
      </p>
    </article>
  );
}
