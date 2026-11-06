import type { Cell } from "./model";

/** How one value changed from last month's bulletin to this one. */
export type Movement =
  | { kind: "ahead" | "back"; days: number }
  | { kind: "same" | "current" | "unavailable" | "available" | "retrogressed" | "new" };

const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

export function movement(prev: Cell | null | undefined, cur: Cell | null | undefined): Movement | null {
  if (!cur) return null;
  if (!prev) return { kind: "new" };
  if (cur.t === "C") return prev.t === "C" ? { kind: "same" } : { kind: "current" };
  if (cur.t === "U") return prev.t === "U" ? { kind: "same" } : { kind: "unavailable" };
  if (prev.t === "U") return { kind: "available" };
  if (prev.t === "C") return { kind: "retrogressed" };
  const days = Math.round(toDay(cur.date) - toDay(prev.date));
  if (days === 0) return { kind: "same" };
  return { kind: days > 0 ? "ahead" : "back", days: Math.abs(days) };
}

/** True when the change is worth an alert (anything but "no change"). */
export const isChange = (m: Movement | null) => m !== null && m.kind !== "same" && m.kind !== "new";

function span(days: number, lang: "en" | "es") {
  const months = Math.round(days / 30.44);
  const es = lang === "es";
  if (months >= 12) {
    const y = Math.floor(months / 12);
    const r = months % 12;
    const ys = es ? `${y} año${y === 1 ? "" : "s"}` : `${y} year${y === 1 ? "" : "s"}`;
    if (!r) return ys;
    return es ? `${ys} y ${r} mes${r === 1 ? "" : "es"}` : `${ys} ${r} month${r === 1 ? "" : "s"}`;
  }
  if (months >= 1) return es ? `${months} mes${months === 1 ? "" : "es"}` : `${months} month${months === 1 ? "" : "s"}`;
  if (days >= 7) {
    const w = Math.round(days / 7);
    return es ? `${w} semana${w === 1 ? "" : "s"}` : `${w} week${w === 1 ? "" : "s"}`;
  }
  return es ? `${days} día${days === 1 ? "" : "s"}` : `${days} day${days === 1 ? "" : "s"}`;
}

/** "Moved ahead 3 months", "No change", "Now current"… (or Spanish). */
export function describeMovement(m: Movement | null, lang: "en" | "es" = "en"): string {
  if (!m) return "";
  const es = lang === "es";
  switch (m.kind) {
    case "ahead":
      return es ? `Avanzó ${span(m.days, lang)}` : `Moved ahead ${span(m.days, lang)}`;
    case "back":
      return es ? `Retrocedió ${span(m.days, lang)}` : `Moved back ${span(m.days, lang)}`;
    case "same":
      return es ? "Sin cambios" : "No change";
    case "current":
      return es ? "Ahora vigente" : "Now current";
    case "unavailable":
      return es ? "No disponible este mes" : "Unavailable this month";
    case "available":
      return es ? "Disponible de nuevo" : "Available again";
    case "retrogressed":
      return es ? "Ya no está vigente" : "No longer current";
    case "new":
      return es ? "Nuevo" : "New";
  }
}

/** Good news, bad news or neither, for colouring. */
export const movementTone = (m: Movement | null): "good" | "bad" | "neutral" =>
  !m ? "neutral" : m.kind === "ahead" || m.kind === "current" || m.kind === "available" ? "good" : m.kind === "back" || m.kind === "unavailable" || m.kind === "retrogressed" ? "bad" : "neutral";
