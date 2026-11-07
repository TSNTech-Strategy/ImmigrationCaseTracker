import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { tagService } from "@/lib/cases";
import { TAG_COLORS, TAG_LIMITS, type TagColor } from "@/lib/cases/tags";
import { NewTagForm, TagRow } from "./tag-forms";

export const metadata: Metadata = { title: "Tags · CasePingo" };

/** Manage tags: add, rename, recolor, delete. */
export default async function TagsPage() {
  const user = await requireUser("/cases/tags");
  const tags = await tagService().list(user.id);
  const used = (color: TagColor) => tags.filter((x) => x.color === color).length;
  const suggested = [...TAG_COLORS].sort((a, b) => used(a) - used(b))[0];
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/cases" className="text-sm font-medium text-[var(--accent)] hover:underline">
          ← My cases
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="text-sm text-[var(--muted)]">Tags group your cases, like Family or Work. Only you see them. Put them on a case from its page.</p>
      </div>
      <NewTagForm full={tags.length >= TAG_LIMITS.perPerson} suggested={suggested} />
      {tags.length === 0 ? (
        <p className="text-center text-sm text-[var(--muted)]">No tags yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
        </ul>
      )}
    </>
  );
}
