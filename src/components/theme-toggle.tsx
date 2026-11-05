"use client";

import { useSyncExternalStore } from "react";

/**
 * Light/dark switch: a quiet icon button (sun or moon outline) with a short
 * fade. The icon comes from CSS (--is-dark in globals.css), so it is right on
 * first paint with no flash. Clicking saves
 * the choice; until then the site follows the device's setting.
 */

const KEY = "casepingo-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function currentDark(): boolean {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : media().matches;
}

function subscribe(cb: () => void) {
  const m = media();
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  m.addEventListener("change", cb);
  return () => {
    obs.disconnect();
    m.removeEventListener("change", cb);
  };
}

export function ThemeToggle() {
  // null on the server: the label is generic until the browser knows the theme.
  const dark = useSyncExternalStore(subscribe, currentDark, () => null);

  function toggle() {
    const next = currentDark() ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("theme-ready");
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0a1220" : "#f5f7fb");
  }

  const label = dark === null ? "Switch between light and dark mode" : dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <svg className="tt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
      </svg>
      <svg className="tt-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}

/** Runs before the page paints: applies a saved choice so there's no flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
