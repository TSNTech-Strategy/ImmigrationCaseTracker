import type { MetadataRoute } from "next";
import { STATUS_GUIDE, guidePath } from "@/lib/status-guide";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://casepingo.com").replace(/\/$/, "");

/** Public pages only; everything behind sign-in stays out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/how-it-works", "/pricing", "/status-guide", "/privacy", "/terms", "/accessibility"];
  return [...pages.map((p) => ({ url: `${base}${p}` })), ...STATUS_GUIDE.map((g) => ({ url: `${base}${guidePath(g)}` }))];
}
