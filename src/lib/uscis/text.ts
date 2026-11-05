import { maskReceiptNumber, normalizeReceiptNumber } from "@/lib/receipt";
import type { CaseStatusSnapshot } from "./normalize";

// USCIS status text can contain (1) the full receipt number and (2) small bits
// of HTML (links to uscis.gov). We never store (1) and never render (2) as HTML.

/** Replace every occurrence of the receipt number with its masked form. */
export function redactReceiptInText(text: string, receipt: string): string;
export function redactReceiptInText(text: string | null, receipt: string): string | null;
export function redactReceiptInText(text: string | null, receipt: string): string | null {
  if (!text) return text;
  const r = normalizeReceiptNumber(receipt);
  if (!r) return text;
  return text.replace(new RegExp(r, "gi"), maskReceiptNumber(r));
}

/** The snapshot with the receipt number masked in every human-readable field. */
export function redactSnapshot(s: CaseStatusSnapshot, receipt: string): CaseStatusSnapshot {
  const red = (t: string | null) => redactReceiptInText(t, receipt);
  return {
    ...s,
    receiptNumber: maskReceiptNumber(receipt),
    status: {
      en: { title: red(s.status.en.title), description: red(s.status.en.description) },
      es: { title: red(s.status.es.title), description: red(s.status.es.description) },
    },
    history: s.history.map((h) => ({ ...h, textEn: red(h.textEn), textEs: red(h.textEs) })),
  };
}

export type TextSegment = { type: "text"; text: string } | { type: "link"; text: string; href: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e: string) => ENTITIES[e]);

/** Only https links to official .gov sites become clickable. */
export function isAllowedLink(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === "https:" && (u.hostname === "uscis.gov" || u.hostname.endsWith(".gov"));
  } catch {
    return false;
  }
}

/**
 * Split USCIS text into plain text and safe links. Allowed <a> tags become
 * links; every other tag is dropped (its text kept). Never produces HTML.
 */
export function parseUscisText(input: string): TextSegment[] {
  const out: TextSegment[] = [];
  const pushText = (raw: string) => {
    const text = decode(raw.replace(/<[^>]*>/g, ""));
    if (!text) return;
    const last = out.at(-1);
    if (last?.type === "text") last.text += text;
    else out.push({ type: "text", text });
  };
  const anchor = /<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi;
  let last = 0;
  for (const m of input.matchAll(anchor)) {
    pushText(input.slice(last, m.index));
    const href = decode(m[2].trim());
    const text = decode(m[3].replace(/<[^>]*>/g, "")).trim() || href;
    if (isAllowedLink(href)) out.push({ type: "link", text, href });
    else pushText(text);
    last = (m.index ?? 0) + m[0].length;
  }
  pushText(input.slice(last));
  return out;
}
