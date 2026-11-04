"use client";

import { useSyncExternalStore } from "react";

const fmt = (d: Date, timeZone?: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(d);

const noop = () => () => {};

/** A timestamp in the viewer's own time zone (the server render shows UTC). */
export function LocalTime({ iso, fallback = "Never" }: { iso: string | null; fallback?: string }) {
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  if (!iso) return <span>{fallback}</span>;
  const d = new Date(iso);
  return <time dateTime={iso}>{inBrowser ? fmt(d) : `${fmt(d, "UTC")} UTC`}</time>;
}
