"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { TAG_COLOR_LABEL, TAG_TONE, TagChip } from "@/components/case-tags";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/form";
import { TAG_COLORS, type TagColor, type TagView, type TagWithCount } from "@/lib/cases/tags";

/**
 * Tag forms shared by personal tags (/cases/tags) and a firm's shared tags
 * (/firm/tags). Each page passes its own server actions and limits.
 */
export type TagAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/** The six colors as round swatches (radio buttons). */
function ColorRadios({ defaultValue, idPrefix }: { defaultValue: TagColor; idPrefix: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Color</legend>
      <div className="flex flex-wrap gap-2">
        {TAG_COLORS.map((color) => (
          <label key={color} htmlFor={`${idPrefix}-${color}`} className="relative cursor-pointer" title={TAG_COLOR_LABEL[color]}>
            <input id={`${idPrefix}-${color}`} type="radio" name="color" value={color} defaultChecked={color === defaultValue} className="peer sr-only" />
            <span className="sr-only">{TAG_COLOR_LABEL[color]}</span>
            <span
              aria-hidden="true"
              className="block h-8 w-8 rounded-full border-2 border-transparent p-1 peer-checked:border-[var(--foreground)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]"
            >
              <span className="block h-full w-full rounded-full" style={{ background: TAG_TONE[color].fg }} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A new tag with a name and a color. */
export function NewTagForm({ action, full, suggested, maxName, maxTags, placeholder = "e.g. Family" }: { action: TagAction; full: boolean; suggested: TagColor; maxName: number; maxTags: number; placeholder?: string }) {
  const [state, run] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={run} className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <Field id="new-tag-name" label="New tag" name="name" maxLength={maxName} placeholder={placeholder} defaultValue={state.values?.name} required disabled={full} />
      <ColorRadios defaultValue={suggested} idPrefix="new" />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Adding…">Add tag</SubmitButton>
        <span className="text-sm text-[var(--muted)]">{full ? `That's the most tags (${maxTags}). Delete one to add another.` : `Up to ${maxTags} tags.`}</span>
      </div>
      <div aria-live="polite">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** One tag, with Edit (name and color) and Delete for people allowed to change it. */
export function TagRow({
  tag,
  saveAction,
  deleteAction,
  canManage = true,
  maxName,
  casesHref,
}: {
  tag: TagWithCount;
  saveAction: TagAction;
  deleteAction: TagAction;
  canManage?: boolean;
  maxName: number;
  /** When set, the case count links to the cases with this tag. */
  casesHref?: string;
}) {
  const [saved, save] = useActionState<FormState, FormData>(saveAction, {});
  const [deleted, remove] = useActionState<FormState, FormData>(deleteAction, {});
  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TagChip tag={tag} />
        {casesHref && tag.caseCount > 0 ? (
          <Link href={casesHref} className="text-sm font-medium text-[var(--accent)] hover:underline">
            {tag.caseCount === 1 ? "1 case" : `${tag.caseCount} cases`}
          </Link>
        ) : (
          <span className="text-sm text-[var(--muted)]">{tag.caseCount === 1 ? "1 case" : `${tag.caseCount} cases`}</span>
        )}
      </div>
      {canManage && (
        <>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-[var(--accent)]">Edit</summary>
            <form action={save} className="mt-3 flex flex-col gap-4">
              <input type="hidden" name="tagId" value={tag.id} />
              <Field id={`tag-${tag.id}-name`} label="Name" name="name" defaultValue={tag.name} maxLength={maxName} required />
              <ColorRadios defaultValue={tag.color} idPrefix={`edit-${tag.id}`} />
              <div>
                <SubmitButton pendingText="Saving…">Save</SubmitButton>
              </div>
              <div aria-live="polite">
                <FormMessage state={saved} />
              </div>
            </form>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-[var(--danger)]">Delete</summary>
            <form action={remove} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="tagId" value={tag.id} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="confirm" className="mt-1" />
                <span>
                  Yes, delete &quot;{tag.name}&quot;.{tag.caseCount > 0 && ` It comes off ${tag.caseCount === 1 ? "1 case" : `${tag.caseCount} cases`}; the cases stay.`}
                </span>
              </label>
              <div>
                <button type="submit" className="rounded-md border border-[var(--danger)] px-4 py-2 text-sm font-medium text-[var(--danger)]">
                  Delete tag
                </button>
              </div>
              <FormMessage state={deleted} />
            </form>
          </details>
        </>
      )}
    </li>
  );
}

function ToggleChip({ tag, on }: { tag: TagView; on: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="tagId"
      value={tag.id}
      aria-pressed={on}
      disabled={pending}
      className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-70"
    >
      <TagChip tag={tag} selected={on} />
    </button>
  );
}

/** Case page: every tag (click to put it on or take it off) and a quick "New tag". */
export function CaseTagsPanel({
  caseId,
  tags,
  onCase,
  toggleAction,
  addAction,
  manageHref,
  maxName,
  intro,
  placeholder = "e.g. Family",
}: {
  caseId: string;
  tags: TagView[];
  onCase: string[];
  toggleAction: TagAction;
  addAction: TagAction;
  manageHref: string;
  maxName: number;
  /** Shown before there are any tags. */
  intro: string;
  placeholder?: string;
}) {
  const [toggled, toggle] = useActionState<FormState, FormData>(toggleAction, {});
  const [added, add] = useActionState<FormState, FormData>(addAction, {});
  const on = new Set(onCase);
  return (
    <section aria-labelledby="tags-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="tags-h" className="text-lg font-semibold">
          Tags
        </h2>
        <Link href={manageHref} className="text-sm font-medium text-[var(--accent)] hover:underline">
          Manage tags
        </Link>
      </div>
      <p className="text-sm text-[var(--muted)]">{tags.length ? "Click a tag to put it on this case or take it off." : intro}</p>
      {tags.length > 0 && (
        <form action={toggle} className="flex flex-wrap gap-2">
          <input type="hidden" name="caseId" value={caseId} />
          {tags.map((tg) => (
            <ToggleChip key={tg.id} tag={tg} on={on.has(tg.id)} />
          ))}
        </form>
      )}
      <FormMessage state={toggled} />
      <form action={add} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="caseId" value={caseId} />
        <div className="min-w-[12rem] flex-1">
          <Field id="case-new-tag-name" label="New tag" name="name" maxLength={maxName} placeholder={placeholder} defaultValue={added.values?.name} required />
        </div>
        <SubmitButton pendingText="Adding…">Add tag</SubmitButton>
      </form>
      <div aria-live="polite">
        <FormMessage state={added} />
      </div>
    </section>
  );
}
