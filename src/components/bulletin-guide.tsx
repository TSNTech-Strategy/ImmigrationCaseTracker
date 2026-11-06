import { CATEGORIES, STATE_BULLETIN_URL, USCIS_CHARTS_URL } from "@/lib/visa-bulletin/model";

/**
 * The Visa Bulletin, CasePingo style: no copied dates. Buttons to the official
 * pages (State Department and USCIS) and a short guide to reading them, used on
 * the public page and on the signed-in page.
 */

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export function BulletinLinks() {
  return (
    <section aria-labelledby="official-h" className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-col gap-1.5">
        <h2 id="official-h" className="text-xl font-semibold">
          This month&apos;s Visa Bulletin
        </h2>
        <p className="text-[var(--muted)]">
          The U.S. Department of State publishes it every month, usually around the middle of the month for the month after. Read the dates on the
          official page.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={STATE_BULLETIN_URL}
          {...external}
          className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center font-semibold text-[var(--accent-fg)] shadow-sm hover:bg-[var(--accent-hover)]"
        >
          Open the Visa Bulletin <span aria-hidden="true">↗</span>
          <span className="sr-only"> (travel.state.gov, opens in a new tab)</span>
        </a>
        <a href={USCIS_CHARTS_URL} {...external} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-center font-semibold hover:bg-[var(--surface-2)]">
          Which chart USCIS uses this month <span aria-hidden="true">↗</span>
          <span className="sr-only"> (uscis.gov, opens in a new tab)</span>
        </a>
      </div>
      <p className="text-xs text-[var(--muted)]">Both open the official government websites: travel.state.gov and uscis.gov.</p>
    </section>
  );
}

const VALUES = [
  { term: "C: Current", body: "Everyone in that category can move forward, whatever their priority date." },
  { term: "U: Unavailable", body: "No visas are available in that category this month." },
  { term: "A date", body: "The cut-off: priority dates earlier than this can move forward." },
  {
    term: "Two charts",
    body: "Final action dates: when a green card can be issued. Dates for filing: when you may submit your application. Inside the U.S., USCIS says each month which one to use.",
  },
];

export function BulletinHowTo() {
  return (
    <>
      <section aria-labelledby="how-h" className="flex flex-col gap-3">
        <h2 id="how-h" className="text-xl font-semibold">
          How to read it
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 leading-relaxed">
          <li>
            <strong>Find your priority date.</strong> It&apos;s on the receipt or approval notice (Form I-797) for the petition filed for you, such as an
            I-130 or I-140.
          </li>
          <li>
            <strong>Find your category</strong>, for example F2A or EB-2, in the list below.
          </li>
          <li>
            <strong>Find your column.</strong> China (mainland-born), India, Mexico and the Philippines have their own. Everyone else uses the first column,
            &ldquo;All Chargeability Areas Except Those Listed&rdquo;. It&apos;s usually your country of birth.
          </li>
          <li>
            <strong>Compare.</strong> If your priority date is earlier than the date shown, your case can move forward under that chart.
          </li>
        </ol>
      </section>

      <section aria-labelledby="values-h" className="flex flex-col gap-3">
        <h2 id="values-h" className="text-xl font-semibold">
          What the chart shows
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.term} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <dt className="font-semibold">{v.term}</dt>
              <dd className="mt-1 text-sm text-[var(--muted)]">{v.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="cats-h" className="flex flex-col gap-3">
        <h2 id="cats-h" className="text-xl font-semibold">
          Find your category
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["family", "employment"] as const).map((kind) => (
            <div key={kind} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <h3 className="bg-[var(--surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)]">
                {kind === "family" ? "Family-sponsored" : "Employment-based"}
              </h3>
              <ul>
                {CATEGORIES.filter((c) => c.kind === kind).map((c) => (
                  <li key={c.key} className="flex gap-3 border-t border-[var(--border)] px-4 py-2.5 text-sm">
                    <span className="w-24 shrink-0 font-semibold">{c.code}</span>
                    <span className="text-[var(--muted)]">{c.en}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function BulletinDisclaimer() {
  return (
    <p className="text-xs text-[var(--muted)]">
      General information, not legal advice. CasePingo isn&apos;t affiliated with the U.S. Department of State or USCIS. Always check the official
      bulletin and USCIS&apos;s chart for the month before you act.
    </p>
  );
}
