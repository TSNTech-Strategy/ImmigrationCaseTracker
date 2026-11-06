/**
 * Finds USCIS receipt numbers (three letters + ten digits, e.g. IOE0912345678)
 * in text read from a photo of a notice. Plain TypeScript with no React Native
 * imports, so the website's test suite checks it too
 * (src/lib/__tests__/receipt-scan.test.ts).
 *
 * Text recognition confuses look-alike characters, so the three-letter office
 * code is read with digits turned into letters (0 → O, 1 → I…) and the ten digits
 * with letters turned into digits (O → 0, S → 5…). At least seven of the ten must
 * already be real digits, so ordinary words never count as a receipt number.
 */

/** Office codes USCIS prints on receipt notices (service centers and the online system). */
export const KNOWN_PREFIXES = ["IOE", "EAC", "WAC", "LIN", "SRC", "NBC", "MSC", "YSC", "NSC", "TSC", "VSC", "CSC"];

const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B" };
const TO_DIGIT: Record<string, string> = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", B: "8", G: "6" };

// Three letters/digits, an optional space or dash, then ten digit-like characters
// (single spaces or dashes allowed between them), as a whole word.
const CANDIDATE = /\b([A-Z0-9]{3})[ -]?((?:[0-9OQDILZSBG][ -]?){9}[0-9OQDILZSBG])\b/g;

function fixPrefix(raw: string): string | null {
  const p = [...raw].map((ch) => TO_LETTER[ch] ?? ch).join("");
  return /^[A-Z]{3}$/.test(p) ? p : null;
}

function fixDigits(raw: string): string | null {
  const chars = raw.replace(/[ -]/g, "");
  if (chars.length !== 10) return null;
  const realDigits = [...chars].filter((ch) => /\d/.test(ch)).length;
  if (realDigits < 7) return null;
  const d = [...chars].map((ch) => TO_DIGIT[ch] ?? ch).join("");
  return /^\d{10}$/.test(d) ? d : null;
}

/**
 * Receipt numbers found in the recognized text, best first: numbers with a known
 * office code, then numbers on or just after a "Receipt" line, then how often each
 * appears. Duplicates are merged.
 */
export function findReceiptNumbers(text: string | string[]): string[] {
  const lines = (Array.isArray(text) ? text.join("\n") : text).split(/\r?\n/).map((l) => l.toUpperCase());
  const found = new Map<string, { score: number; count: number; order: number }>();
  lines.forEach((line, i) => {
    const nearReceipt = /RECEIPT/.test(line) || /RECEIPT/.test(lines[i - 1] ?? "");
    for (const m of line.matchAll(CANDIDATE)) {
      const prefix = fixPrefix(m[1]);
      const digits = fixDigits(m[2]);
      if (!prefix || !digits) continue;
      const receipt = prefix + digits;
      const score = (KNOWN_PREFIXES.includes(prefix) ? 2 : 0) + (nearReceipt ? 1 : 0);
      const prev = found.get(receipt);
      if (prev) {
        prev.count++;
        prev.score = Math.max(prev.score, score);
      } else {
        found.set(receipt, { score, count: 1, order: found.size });
      }
    }
  });
  return [...found.entries()]
    .sort(([, a], [, b]) => b.score - a.score || b.count - a.count || a.order - b.order)
    .map(([receipt]) => receipt);
}
