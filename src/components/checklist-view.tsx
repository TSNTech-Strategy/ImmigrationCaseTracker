import Link from "next/link";
import { COMMON_TIPS, REVIEWED, checklistProgress, type Checklist } from "@/lib/checklists";
import { formatDay } from "@/components/line-map";
import { toggleChecklistItemAction } from "@/app/(public)/checklists/actions";

/**
 * One document checklist. With `done` (signed in) each item is a checkbox saved to the
 * person's account; without it, a plain list with a sign-in link.
 */
export function ChecklistView({ checklist: c, done, signInHref }: { checklist: Checklist; done: Set<string> | null; signInHref: string }) {
  const p = done ? checklistProgress(c, done) : null;
  return (
    <div className="flex flex-col gap-6">
      {p ? (
        <section aria-label="Progress" className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="font-semibold">
            {p.requiredDone} of {p.required} required documents ready
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden="true">
            <div className="h-2.5 rounded-full bg-[var(--st-done)]" style={{ width: `${p.required ? (p.requiredDone / p.required) * 100 : 0}%` }} />
          </div>
          <p className="text-sm text-[var(--muted)]">Tick each one as you gather it. Saved to your account, so the app shows the same list.</p>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          <Link href={signInHref} className="font-semibold text-[var(--accent)] underline underline-offset-2">
            Sign in
          </Link>{" "}
          to tick documents as you gather them and keep your progress in the app too.
        </p>
      )}

      {c.groups.map((g) => (
        <section key={g.key} aria-labelledby={`g-${g.key}`} className="flex flex-col gap-2">
          <h2 id={`g-${g.key}`} className="text-lg font-semibold">
            {g.title.en}
          </h2>
          <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {g.items.map((i) => {
              const on = done?.has(i.key) ?? false;
              const content = (
                <span className="flex flex-1 flex-col gap-0.5 text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${on ? "text-[var(--muted)] line-through decoration-1" : ""}`}>{i.title.en}</span>
                    {!i.required && <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">If it applies</span>}
                  </span>
                  {i.detail && <span className="text-sm text-[var(--muted)]">{i.detail.en}</span>}
                </span>
              );
              const box = (
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border-2 ${on ? "border-[var(--st-done)] bg-[var(--st-done)] text-[var(--surface)]" : "border-[var(--border)]"}`}
                >
                  {on ? "✓" : ""}
                </span>
              );
              return (
                <li key={i.key}>
                  {done ? (
                    <form action={toggleChecklistItemAction}>
                      <input type="hidden" name="key" value={c.key} />
                      <input type="hidden" name="item" value={i.key} />
                      <input type="hidden" name="done" value={on ? "0" : "1"} />
                      <button type="submit" role="checkbox" aria-checked={on} className="flex w-full items-start gap-3 px-5 py-4 hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)]">
                        {box}
                        {content}
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-start gap-3 px-5 py-4">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[var(--muted)]" />
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section aria-labelledby="tips-h" className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 id="tips-h" className="text-lg font-semibold">
          Before you send it
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {[...c.tips, ...COMMON_TIPS].map((t) => (
            <li key={t.en}>{t.en}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="links-h" className="flex flex-col gap-2">
        <h2 id="links-h" className="text-lg font-semibold">
          Official pages
        </h2>
        <ul className="flex flex-col gap-1.5">
          {c.links.map((l) => (
            <li key={l.url}>
              {l.url.startsWith("/") ? (
                <Link href={l.url} className="font-medium text-[var(--accent)] underline underline-offset-2">
                  {l.label.en}
                </Link>
              ) : (
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] underline underline-offset-2">
                  {l.label.en} ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-[var(--muted)]">
        General guidance from USCIS&apos;s form instructions (reviewed {formatDay(REVIEWED, false)}), not legal advice. Requirements change: check the form page before you file. If your case is complicated, talk to a lawyer or accredited representative.
      </p>
    </div>
  );
}
