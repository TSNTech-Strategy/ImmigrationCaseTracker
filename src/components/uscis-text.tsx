import { parseUscisText } from "@/lib/uscis/text";

/** USCIS status text with its official .gov links made clickable — never raw HTML. */
export function UscisText({ text }: { text: string }) {
  return (
    <>
      {parseUscisText(text).map((seg, i) =>
        seg.type === "link" ? (
          <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {seg.text}
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
