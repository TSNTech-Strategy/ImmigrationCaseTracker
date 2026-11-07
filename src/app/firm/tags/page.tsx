import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewTagForm, TagRow } from "@/components/tag-forms";
import { requireUser } from "@/lib/auth/session";
import { firmTagService } from "@/lib/firms";
import { FIRM_TAG_LIMITS, nextTagColor } from "@/lib/firms/tags";
import { createFirmTagAction, deleteFirmTagAction, updateFirmTagAction } from "./actions";

export const metadata: Metadata = { title: "Firm tags · CasePingo" };

/** The tags the firm's team shares: everyone adds and uses them; Owners and Admins rename, recolor and delete. */
export default async function FirmTagsPage() {
  const user = await requireUser("/firm/tags");
  const data = await firmTagService().list(user.id);
  if (!data) redirect("/firm");
  const { tags, canManage } = data;
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="text-sm text-[var(--muted)]">
          Tags your whole team shares on the firm&apos;s cases, like the attorney, the visa type or a deadline. Everyone can add tags and put them
          on cases.{" "}
          {canManage ? "As an Owner or Admin you can also rename, recolor and delete them." : "Only an Owner or Admin can rename, recolor or delete them."}
        </p>
      </div>
      <NewTagForm
        action={createFirmTagAction}
        full={tags.length >= FIRM_TAG_LIMITS.perFirm}
        suggested={nextTagColor(tags)}
        maxName={FIRM_TAG_LIMITS.name}
        maxTags={FIRM_TAG_LIMITS.perFirm}
        placeholder="e.g. Attorney: Rivera"
      />
      {tags.length === 0 ? (
        <p className="text-center text-sm text-[var(--muted)]">No tags yet. Add one here, from a case page, or with a &quot;tags&quot; column in a CSV import.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} saveAction={updateFirmTagAction} deleteAction={deleteFirmTagAction} canManage={canManage} maxName={FIRM_TAG_LIMITS.name} casesHref={`/firm/cases?tag=${encodeURIComponent(tag.id)}`} />
          ))}
        </ul>
      )}
      <p className="text-sm text-[var(--muted)]">
        <Link href="/firm/cases" className="underline underline-offset-2">
          Back to cases
        </Link>
      </p>
    </div>
  );
}
