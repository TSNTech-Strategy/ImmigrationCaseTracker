"use client";

import { useActionState, useMemo, useState } from "react";
import { AREA_LABEL, AREAS, monthLabel } from "@/lib/visa-bulletin/model";
import { bulletinEssentials } from "@/lib/visa-bulletin/parse";
import { bulletinImportAction, type ImportState } from "./actions";

/** "2026-12" → "December 2026" (anything else as typed). */
const named = (m: string | null | undefined) => (m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? monthLabel(m) : m);

const input = "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm";

export function BulletinImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(bulletinImportAction, {});
  // Controlled, so the pasted page survives Preview (a finished action resets uncontrolled fields).
  const [text, setText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [month, setMonth] = useState("");
  // Save only what was previewed: a change to the paste or the month needs a new Preview.
  const [previewed, setPreviewed] = useState<string | null>(null);
  const preview = state.preview;
  const canSave = Boolean(preview) && previewed === `${month}\n${text}`;
  // Only the tables and the title are sent (form posts are capped at 1 MB; a page source can be big).
  const payload = useMemo(() => bulletinEssentials(text), [text]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="vb-text" className="text-sm font-medium">
          Bulletin page
        </label>
        <textarea
          id="vb-text"
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste the bulletin's page source here"
          className={`${input} font-mono text-xs`}
        />
        <input type="hidden" name="text" value={payload} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vb-url" className="text-sm font-medium">
            Link to the bulletin (shown to people)
          </label>
          <input
            id="vb-url"
            name="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/…"
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vb-month" className="text-sm font-medium">
            Month (only if not found)
          </label>
          <input
            id="vb-month"
            name="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="YYYY-MM"
            pattern="\d{4}-(0[1-9]|1[0-2])"
            className={input}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intent"
          value="preview"
          disabled={pending}
          onClick={() => setPreviewed(`${month}\n${text}`)}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)]"
        >
          Preview
        </button>
        {canSave && (
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
          >
            Save {named(preview?.month) ?? "bulletin"} and send alerts
          </button>
        )}
      </div>

      {preview && !canSave && !pending && (
        <p className="text-sm text-[var(--muted)]">You changed the page or the month since the preview. Press Preview again before saving.</p>
      )}
      {state.error && (
        <p role="alert" className="rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="rounded-md border border-[var(--success)] px-3 py-2 text-sm text-[var(--success)]">
          Saved {named(state.saved.month)}.{" "}
          {state.saved.newest
            ? `Alerts: ${state.saved.sent} sent, ${state.saved.skipped} with no change or no alerts, ${state.saved.failed} failed.`
            : "It isn't the newest month, so no alerts were sent."}
        </p>
      )}

      {preview && (
        <section aria-labelledby="vb-preview-h" className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 id="vb-preview-h" className="font-semibold">
            Preview: {named(preview.month) ?? "month not found"}
          </h2>
          {preview.warnings.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-[var(--st-action)]">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <p className="text-sm text-[var(--muted)]">Compare a few values with the official page before saving.</p>
          {preview.tables.map((t) => (
            <div key={t.key} className="overflow-x-auto">
              <h3 className="mb-1 text-sm font-semibold">{t.title}</h3>
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Category</th>
                    {AREAS.map((a) => (
                      <th key={a} className="py-1 pr-2 font-medium">
                        {AREA_LABEL[a].en}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r) => (
                    <tr key={r.code} className="border-t border-[var(--border)]">
                      <td className="py-1 pr-2 font-medium">{r.code}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className="py-1 pr-2 tabular-nums">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </form>
  );
}
