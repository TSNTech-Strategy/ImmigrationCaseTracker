import { CIVICS_LINKS, CIVICS_VERSIONS, civicsTest, CURRENT } from "@/lib/civics";

const asOf = new Date(`${CURRENT.asOf}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Every official question with its answers, by section: for studying, and for search engines. */
export function CivicsQuestionList({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="flex flex-col gap-4" aria-labelledby="all-questions">
      <div className="flex flex-col gap-1">
        <H id="all-questions" className="text-2xl font-bold tracking-tight">
          All questions and answers
        </H>
        <p className="text-sm text-[var(--muted)]">
          ★ marks the 20 questions for the 65/20 exception. Answers to &quot;now&quot; questions are as of {asOf}; check{" "}
          <a href={CIVICS_LINKS.testUpdates} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] underline underline-offset-2">
            USCIS test updates
          </a>{" "}
          before your interview.
        </p>
      </div>
      {CIVICS_VERSIONS.map((v) => {
        const t = civicsTest(v);
        return (
          <details key={v} className="group rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">
                  {t.title.en}: all {t.total} questions
                </span>
                <span className="text-sm text-[var(--muted)]">{t.who.en}</span>
              </span>
              <span aria-hidden="true" className="text-[var(--muted)] transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="flex flex-col gap-8 border-t border-[var(--border)] p-4 sm:p-6">
              {t.sections.map((s) => (
                <div key={s.key} className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {s.group.en}: {s.title.en}
                  </p>
                  <ol className="flex flex-col gap-4">
                    {t.questions
                      .filter((q) => q.section === s.key)
                      .map((q) => (
                        <li key={q.id} className="flex flex-col gap-1">
                          <p className="font-medium">
                            {q.n}. {q.q}
                            {q.star && (
                              <span className="ml-1 text-[var(--st-action)]" title="65/20 question">
                                ★<span className="sr-only"> (65/20 question)</span>
                              </span>
                            )}
                          </p>
                          <ul className="list-disc pl-6 text-sm text-[var(--muted)]">
                            {q.answers.map((a) => (
                              <li key={a}>{q.kind === "current" ? `${a} (as of ${asOf})` : a}</li>
                            ))}
                          </ul>
                          {q.note && <p className="pl-6 text-xs text-[var(--muted)]">{q.note}</p>}
                        </li>
                      ))}
                  </ol>
                </div>
              ))}
              <p className="text-sm">
                <a href={t.listUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--accent)] underline underline-offset-2">
                  Official list from USCIS (PDF)
                </a>
              </p>
            </div>
          </details>
        );
      })}
    </section>
  );
}
