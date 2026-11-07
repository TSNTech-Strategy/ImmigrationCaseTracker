import type { MetadataRoute } from "next";
import { RESOURCES, resourcePath } from "@/lib/resources";
import { CHECKLISTS, checklistPath } from "@/lib/checklists";
import { STATUS_GUIDE, guidePath } from "@/lib/status-guide";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://casepingo.com").replace(/\/$/, "");

/** Public pages only; everything behind sign-in stays out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/how-it-works", "/pricing", "/resources", "/checklists", "/status-guide", "/civics-test", "/visa-bulletin", "/privacy", "/terms", "/accessibility"];
  return [...pages.map((p) => ({ url: `${base}${p}` })), ...RESOURCES.map((r) => ({ url: `${base}${resourcePath(r.slug)}` })), ...STATUS_GUIDE.map((g) => ({ url: `${base}${guidePath(g)}` })), ...CHECKLISTS.map((c) => ({ url: `${base}${checklistPath(c.key)}` }))];
}
