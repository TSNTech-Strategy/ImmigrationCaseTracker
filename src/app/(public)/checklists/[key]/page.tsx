import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChecklistView } from "@/components/checklist-view";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CHECKLISTS, checklistByKey, checklistPath, type Checklist } from "@/lib/checklists";
import { createChecklistService } from "@/lib/checklists-service";

export async function generateStaticParams() {
  return CHECKLISTS.map((c) => ({ key: c.key }));
}

export async function generateMetadata({ params }: PageProps<"/checklists/[key]">): Promise<Metadata> {
  const c = checklistByKey((await params).key);
  if (!c) return { title: "Document checklists · CasePingo" };
  return {
    title: `Form ${c.form} document checklist: ${c.title.en} · CasePingo`,
    description: `Documents to gather for Form ${c.form} (${c.title.en.toLowerCase()}): ${c.summary.en}`,
    alternates: { canonical: checklistPath(c.key) },
  };
}

export default function ChecklistPage(props: PageProps<"/checklists/[key]">) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-3xl px-4 py-16 text-[var(--muted)]">Loading…</div>}>
      <ChecklistDetail params={props.params} />
    </Suspense>
  );
}

async function ChecklistDetail({ params }: { params: PageProps<"/checklists/[key]">["params"] }) {
  const c = checklistByKey((await params).key);
  if (!c) notFound();
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:py-16">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/checklists" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Document checklists
        </Link>
      </nav>
      <header className="flex flex-col gap-3">
        <span className="self-start rounded-md bg-[var(--accent-soft)] px-2 py-0.5 font-mono text-sm font-bold text-[var(--accent)]">Form {c.form}</span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.title.en}: document checklist</h1>
        <p className="text-lg leading-relaxed text-[var(--muted)]">{c.summary.en}</p>
      </header>
      {/* The list is the same for everyone; signed-in people also get their saved ticks. */}
      <Suspense fallback={<ChecklistView checklist={c} done={null} signInHref={`/login?next=${encodeURIComponent(checklistPath(c.key))}`} />}>
        <WithProgress checklist={c} />
      </Suspense>
    </article>
  );
}

async function WithProgress({ checklist: c }: { checklist: Checklist }) {
  const user = await getCurrentUser();
  const done = user ? new Set(await createChecklistService({ db: prisma }).done(user.id, c.key)) : null;
  return <ChecklistView checklist={c} done={done} signInHref={`/login?next=${encodeURIComponent(checklistPath(c.key))}`} />;
}
