import type { TagColor, TagView } from "@/lib/cases/tags";

/** Tag colors: the status colors plus purple (src/app/globals.css). */
export const TAG_TONE: Record<TagColor, { fg: string; bg: string }> = {
  blue: { fg: "var(--st-progress)", bg: "var(--st-progress-bg)" },
  green: { fg: "var(--st-done)", bg: "var(--st-done-bg)" },
  amber: { fg: "var(--st-action)", bg: "var(--st-action-bg)" },
  red: { fg: "var(--st-stop)", bg: "var(--st-stop-bg)" },
  purple: { fg: "var(--tag-purple)", bg: "var(--tag-purple-bg)" },
  gray: { fg: "var(--st-none)", bg: "var(--st-none-bg)" },
};
export const TAG_COLOR_LABEL: Record<TagColor, string> = { blue: "Blue", green: "Green", amber: "Amber", red: "Red", purple: "Purple", gray: "Gray" };

/**
 * A tag: a colored dot and the name on an outlined chip, so it never looks
 * like the filled status labels. Selected chips take the tag's soft color.
 */
export function TagChip({ tag, small = false, selected = false, count }: { tag: Pick<TagView, "name" | "color">; small?: boolean; selected?: boolean; count?: number }) {
  const tone = TAG_TONE[tag.color];
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-medium ${small ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}
      style={{ borderColor: selected ? tone.fg : "var(--border)", background: selected ? tone.bg : "var(--surface)", color: selected ? tone.fg : undefined }}
    >
      <span aria-hidden="true" className={`shrink-0 rounded-full ${small ? "h-1.5 w-1.5" : "h-2 w-2"}`} style={{ background: tone.fg }} />
      <span className="truncate">{tag.name}</span>
      {count !== undefined && <span className="text-[var(--muted)]">{count}</span>}
    </span>
  );
}

/** A case's tags in a list or table row. */
export function TagList({ tags, max = 4 }: { tags: TagView[] | undefined; max?: number }) {
  if (!tags?.length) return null;
  const extra = tags.length - max;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {tags.slice(0, max).map((tg) => (
        <TagChip key={tg.id} tag={tg} small />
      ))}
      {extra > 0 && <span className="text-xs text-[var(--muted)]">+{extra}</span>}
    </span>
  );
}
