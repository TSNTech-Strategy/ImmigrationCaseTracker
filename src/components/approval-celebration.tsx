"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { LocalTime } from "@/components/local-time";

/**
 * The approval moment: a short burst of red and blue stars plus a written
 * congratulations. Personal cases only (firm pages stay quiet).
 *
 * - The burst plays once per case on each device (remembered in localStorage)
 *   and never for people who ask for reduced motion; the written message always shows.
 * - It never blocks the page: the canvas ignores clicks and removes itself.
 */

const PLAYED_KEY = "casepingo:celebrated";
const DISMISSED_KEY = "casepingo:approval-dismissed";
const listeners = new Set<() => void>();

function readIds(key: string): string[] {
  try {
    return (localStorage.getItem(key) ?? "").split(",").filter(Boolean);
  } catch {
    return [];
  }
}

function addIds(key: string, ids: string[]) {
  try {
    const all = [...new Set([...readIds(key), ...ids])].slice(-200);
    localStorage.setItem(key, all.join(","));
  } catch {
    // Private mode or storage blocked: the celebration may simply replay.
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const dismissedSnapshot = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Brand stars: red and blue (white stands in for light blue on dark backgrounds). */
export async function fireStars() {
  if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const dark = getComputedStyle(document.documentElement).getPropertyValue("--is-dark").trim() === "1";
  const colors = dark ? ["#FF6B7D", "#6EA8FF", "#FFFFFF"] : ["#E43B53", "#1758A8", "#5B8FD9"];
  const base = { shapes: ["star" as const], colors, disableForReducedMotion: true, zIndex: 60, ticks: 240, gravity: 0.85, scalar: 1.15 };
  // Two side cannons for about a second, then one burst from the middle.
  let shots = 0;
  const timer = window.setInterval(() => {
    void confetti({ ...base, particleCount: 7, angle: 60, spread: 50, startVelocity: 55, origin: { x: 0, y: 0.8 } });
    void confetti({ ...base, particleCount: 7, angle: 120, spread: 50, startVelocity: 55, origin: { x: 1, y: 0.8 } });
    if (++shots >= 6) window.clearInterval(timer);
  }, 140);
  window.setTimeout(() => void confetti({ ...base, particleCount: 70, spread: 110, startVelocity: 42, origin: { x: 0.5, y: 0.4 }, scalar: 1.35 }), 450);
}

/** Plays the burst once per case on this device. */
function usePlayOnce(caseIds: string[]) {
  const key = caseIds.join(",");
  useEffect(() => {
    const played = new Set(readIds(PLAYED_KEY));
    const fresh = key.split(",").filter((id) => id && !played.has(id));
    if (fresh.length === 0) return;
    addIds(PLAYED_KEY, fresh);
    void fireStars();
  }, [key]);
}

function starPath(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}
const RED_STAR = starPath(16, 17, 13);
const BLUE_STAR = starPath(30, 27, 11);

function StarsMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true" className="flex-none">
      <path d={RED_STAR} fill="var(--brand-red)" />
      <path d={BLUE_STAR} fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Case page: the congratulations card (shown for a while after the approval) and the one-time burst. */
export function ApprovalCelebration({
  caseId,
  approvedAtIso,
  nextStep,
  es,
}: {
  caseId: string;
  approvedAtIso: string;
  nextStep: string | null;
  es: boolean;
}) {
  usePlayOnce([caseId]);
  return (
    <section aria-labelledby="congrats-h" className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--brand-red),var(--accent))]" />
      <div className="flex gap-4">
        <StarsMark />
        <div className="flex flex-col gap-1.5">
          <h2 id="congrats-h" className="text-xl font-semibold">
            {es ? "¡Felicidades!" : "Congratulations!"}
          </h2>
          <p>{es ? "USCIS aprobó su caso." : "USCIS approved your case."}</p>
          {nextStep && <p className="text-sm leading-relaxed text-[var(--muted)]">{nextStep}</p>}
          <p className="text-xs text-[var(--muted)]">
            {es ? "Vimos la aprobación el " : "We saw the approval on "}
            <LocalTime iso={approvedAtIso} />.
          </p>
          <button
            type="button"
            onClick={() => void fireStars()}
            className="mt-1 self-start rounded text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            {es ? "Celebrar otra vez" : "Celebrate again"}
          </button>
        </div>
      </div>
    </section>
  );
}

/** My cases: a one-line note per newly approved case, dismissible, plus the one-time burst. */
export function ApprovalBanners({ cases, es }: { cases: { id: string; name: string; href: string }[]; es: boolean }) {
  usePlayOnce(cases.map((c) => c.id));
  const dismissedRaw = useSyncExternalStore(subscribe, dismissedSnapshot, () => null);
  if (dismissedRaw === null) return null; // server render: storage isn't known yet
  const dismissed = new Set(dismissedRaw.split(",").filter(Boolean));
  const visible = cases.filter((c) => !dismissed.has(c.id));
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {visible.map((c) => (
        <div key={c.id} role="status" className="relative flex items-center gap-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-3 pl-5 pr-2">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,var(--brand-red),var(--accent))]" />
          <StarsMark size={28} />
          <p className="min-w-0 flex-1 text-sm">
            <strong>{es ? "¡Felicidades!" : "Congratulations!"}</strong> {es ? <>USCIS aprobó <span className="font-medium">{c.name}</span>.</> : <>USCIS approved <span className="font-medium">{c.name}</span>.</>}
          </p>
          <Link href={c.href} className="whitespace-nowrap rounded px-2 py-1 text-sm font-semibold text-[var(--accent)] hover:underline">
            {es ? "Ver caso" : "View case"}
          </Link>
          <button
            type="button"
            aria-label={es ? "Cerrar" : "Dismiss"}
            onClick={() => addIds(DISMISSED_KEY, [c.id])}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
