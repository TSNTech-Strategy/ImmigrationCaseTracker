"use client";

import { useSyncExternalStore } from "react";

/**
 * Animated day/night switch. The look comes from CSS (--is-dark in
 * globals.css), so it is right on first paint with no flash. Clicking saves
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
      <span className="tt-star s1" aria-hidden="true" />
      <span className="tt-star s2" aria-hidden="true" />
      <span className="tt-star s3" aria-hidden="true" />
      <span className="tt-cloud c1" aria-hidden="true" />
      <span className="tt-cloud c2" aria-hidden="true" />
      <span className="tt-knob" aria-hidden="true">
        <span className="tt-sun" />
        <span className="tt-moon" />
      </span>
    </button>
  );
}

/** Runs before the page paints: applies a saved choice so there's no flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;
