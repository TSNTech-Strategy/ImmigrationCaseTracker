import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { IconTile, LinkList } from "@/components/resource-ui";
import { contactEmail, RESOURCES, resourceBySlug, resourcePath } from "@/lib/resources";

export async function generateStaticParams() {
  return RESOURCES.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: PageProps<"/resources/[slug]">): Promise<Metadata> {
  const r = resourceBySlug((await params).slug);
  if (!r) return { title: "Resources · CasePingo" };
  return { title: `${r.title.en} · CasePingo`, description: r.intro.en, alternates: { canonical: resourcePath(r.slug) } };
}

export default function ResourcePage(props: PageProps<"/resources/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-3xl px-4 py-16 text-[var(--muted)]">Loading…</div>}>
      <ResourceDetail params={props.params} />
    </Suspense>
  );
}

async function ResourceDetail({ params }: { params: PageProps<"/resources/[slug]">["params"] }) {
  const r = resourceBySlug((await params).slug);
  if (!r) notFound();
  const email = r.slug === "contact" ? contactEmail() : null;
  // FAQ answers as structured data, so search engines can show them.
  const faqJsonLd = r.faq?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: r.faq.map((f) => ({ "@type": "Question", name: f.q.en, acceptedAnswer: { "@type": "Answer", text: f.a.en } })),
      }
    : null;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/resources" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Resources
        </Link>
      </nav>
      <header className="flex flex-col gap-4">
        <IconTile icon={r.icon} size={52} />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{r.title.en}</h1>
        <p className="text-lg leading-relaxed text-[var(--muted)]">{r.intro.en}</p>
      </header>

      {r.slug === "contact" && (
        <section aria-labelledby="email-h" className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 id="email-h" className="text-xl font-semibold">
            Email us
          </h2>
          {email ? (
            <a href={`mailto:${email}`} className="self-start rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]">
              {email}
            </a>
          ) : (
            <p className="text-[var(--muted)]">Our support email is being set up. Until then, the FAQ and USCIS&apos;s Contact Center below can help.</p>
          )}
        </section>
      )}

      {r.sections.map((s, i) => (
        <section key={s.heading.en} aria-labelledby={`s-${i}`} className="flex flex-col gap-3 text-[1.05rem] leading-relaxed">
          <h2 id={`s-${i}`} className="text-xl font-semibold">
            {s.heading.en}
          </h2>
          {s.paragraphs?.map((p) => <p key={p.en}>{p.en}</p>)}
          {s.bullets && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              {s.bullets.map((b) => (
                <li key={b.en}>{b.en}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {r.faq && (
        <section aria-label="Questions" className="flex flex-col gap-3">
          {r.faq.map((f, i) => (
            <div key={f.q.en} className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 id={`q-${i}`} className="text-lg font-semibold">
                {f.q.en}
              </h2>
              <p className="leading-relaxed text-[var(--muted)]">{f.a.en}</p>
              {f.links && f.links.length > 0 && (
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {f.links.map((l) =>
                    l.url.startsWith("/") ? (
                      <Link key={l.url} href={l.url} className="font-medium text-[var(--accent)] hover:underline">
                        {l.label.en} →
                      </Link>
                    ) : (
                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] hover:underline">
                        {l.label.en} ↗
                      </a>
                    ),
                  )}
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {r.links.length > 0 && (
        <section aria-labelledby="links-h" className="flex flex-col gap-3">
          <h2 id="links-h" className="text-xl font-semibold">
            {r.links.every((l) => l.url.startsWith("/")) ? "Learn more" : "Official links and more"}
          </h2>
          <LinkList links={r.links} />
        </section>
      )}

      <p className="text-xs text-[var(--muted)]">
        General information, not legal advice. CasePingo isn&apos;t affiliated with USCIS or the U.S. government. Official pages and your
        notices always come first.
      </p>
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
    </article>
  );
}
