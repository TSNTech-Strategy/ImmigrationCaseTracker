import { api } from "./api";
import type { Colors } from "./theme";

/**
 * Tags on the person's own cases ("Family", "Work"): the same palette and
 * limits as the server (src/lib/cases/tags.ts).
 */
export type TagColor = "blue" | "green" | "amber" | "red" | "purple" | "gray";
export type Tag = { id: string; name: string; color: TagColor };
export type TagWithCount = Tag & { caseCount: number };
export const TAG_COLORS: TagColor[] = ["blue", "green", "amber", "red", "purple", "gray"];
export const TAG_NAME_MAX = 24;
export const TAGS_PER_PERSON = 20;

const PURPLE = { light: { fg: "#6B3FBF", bg: "#F1EBFC" }, dark: { fg: "#C4A6FF", bg: "#271B45" } };

/** A tag's dot and soft background, light or dark. */
export function tagTone(c: Colors, isDark: boolean, color: TagColor): { fg: string; bg: string } {
  switch (color) {
    case "green":
      return c.st.done;
    case "amber":
      return c.st.action;
    case "red":
      return c.st.stop;
    case "gray":
      return c.st.none;
    case "purple":
      return isDark ? PURPLE.dark : PURPLE.light;
    default:
      return c.st.progress;
  }
}

/** The tags on any of these cases, A to Z, with how many of the cases have each. */
export function tagsInUse(cases: { tags?: Tag[] }[]): (Tag & { count: number })[] {
  const m = new Map<string, Tag & { count: number }>();
  for (const cs of cases) for (const tg of cs.tags ?? []) m.set(tg.id, { ...tg, count: (m.get(tg.id)?.count ?? 0) + 1 });
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const listTags = () => api<{ tags: TagWithCount[] }>("/api/v1/tags");
export const createTag = (name: string, color?: TagColor) => api<{ tag: Tag }>("/api/v1/tags", { method: "POST", body: { name, ...(color ? { color } : {}) } });
export const updateTag = (id: string, patch: { name?: string; color?: TagColor }) => api<{ tag: Tag }>(`/api/v1/tags/${id}`, { method: "PATCH", body: patch });
export const deleteTag = (id: string) => api<{ deleted: true }>(`/api/v1/tags/${id}`, { method: "DELETE" });
export const setCaseTags = (caseId: string, tagIds: string[]) => api<{ tags: Tag[] }>(`/api/v1/cases/${caseId}/tags`, { method: "PUT", body: { tagIds } });
