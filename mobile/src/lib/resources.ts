import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import type { Glyph, Tint } from "../components/feature";
import { api } from "./api";
import { config } from "./config";

/**
 * The resource center (guides, FAQ, official links), from GET /api/v1/resources
 * so the wording can improve without an app release. Fetched once per app session.
 */

export type Bilingual = { en: string; es: string };
export type ResourceLink = { label: Bilingual; url: string };
export type ResourceSection = { heading: Bilingual; paragraphs?: Bilingual[]; bullets?: Bilingual[] };
export type FaqItem = { q: Bilingual; a: Bilingual; links?: ResourceLink[] };
export type Resource = { slug: string; title: Bilingual; summary: Bilingual; intro: Bilingual; sections: ResourceSection[]; faq?: FaqItem[]; links: ResourceLink[] };
export type OfficialTool = { key: string; icon: { ios: string; md: string }; title: Bilingual; summary: Bilingual; url: string };
export type ResourcesResponse = { statusLibrary: { title: Bilingual; summary: Bilingual }; resources: Resource[]; tools?: OfficialTool[]; contactEmail: string | null };

let cache: ResourcesResponse | null = null;
let pending: Promise<ResourcesResponse> | null = null;

export function loadResources(): Promise<ResourcesResponse> {
  if (cache) return Promise.resolve(cache);
  pending ??= api<ResourcesResponse>("/api/v1/resources")
    .then((r) => (cache = r))
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Icons and colours per guide, from the app's own icon set (unknown guides get a book). */
const LOOK: Record<string, { glyph: Glyph; tint: Tint }> = {
  library: { glyph: { ios: "book", md: "menu_book", fallback: "📖" }, tint: "blue" },
  "processing-times": { glyph: { ios: "clock", md: "schedule", fallback: "⏱" }, tint: "blue" },
  interviews: { glyph: { ios: "person.2", md: "groups", fallback: "👥" }, tint: "green" },
  news: { glyph: { ios: "newspaper", md: "newspaper", fallback: "📰" }, tint: "amber" },
  faq: { glyph: { ios: "questionmark.circle", md: "help", fallback: "?" }, tint: "red" },
  "how-casepingo-helps": { glyph: { ios: "sparkles", md: "auto_awesome", fallback: "✦" }, tint: "navy" },
  contact: { glyph: { ios: "bubble.left", md: "chat_bubble", fallback: "✉" }, tint: "green" },
  civics: { glyph: { ios: "graduationcap", md: "school", fallback: "🎓" }, tint: "navy" },
};
export const resourceLook = (slug: string) => LOOK[slug] ?? LOOK.library;

/** Icons and colours per official tool (a tool the app doesn't know yet gets a generic link icon). */
const TOOL_LOOK: Record<string, { glyph: Glyph; tint: Tint }> = {
  "e-request": { glyph: { ios: "envelope.badge", md: "contact_mail", fallback: "✉" }, tint: "blue" },
  "processing-times": { glyph: { ios: "clock", md: "schedule", fallback: "⏱" }, tint: "navy" },
  i94: { glyph: { ios: "airplane", md: "flight", fallback: "✈" }, tint: "green" },
  "fee-calculator": { glyph: { ios: "dollarsign.circle", md: "payments", fallback: "$" }, tint: "amber" },
  "address-change": { glyph: { ios: "house", md: "home", fallback: "⌂" }, tint: "red" },
};
export const toolLook = (key: string): { glyph: Glyph; tint: Tint } => TOOL_LOOK[key] ?? { glyph: { ios: "safari", md: "open_in_new", fallback: "↗" }, tint: "blue" };

/** Website paths used in the content, as app screens (null: not in the app). */
export function appRouteFor(url: string): string | null {
  if (url === "/status-guide") return "/guide";
  if (url.startsWith("/status-guide/")) return `/guide/${url.slice("/status-guide/".length)}`;
  if (url === "/visa-bulletin") return "/bulletin";
  if (url === "/civics-test") return "/civics";
  if (url.startsWith("/resources/")) return url;
  return null;
}

/** Open a content link: an app screen when there is one, otherwise the page in the in-app browser. */
export function openResourceLink(url: string) {
  const route = appRouteFor(url);
  if (route) router.push(route as never);
  else WebBrowser.openBrowserAsync(url.startsWith("/") ? config.apiUrl + url : url);
}
