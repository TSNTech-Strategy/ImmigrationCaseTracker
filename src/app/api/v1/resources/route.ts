import { respond } from "@/lib/mobile";
import { contactEmail, RESOURCES, STATUS_LIBRARY_CARD } from "@/lib/resources";

/** The resource center for the app's Resources tab (public, no sign-in). Website-only links are left out. */
export function GET() {
  return respond({
    status: 200,
    body: {
      statusLibrary: { icon: STATUS_LIBRARY_CARD.icon, title: STATUS_LIBRARY_CARD.title, summary: STATUS_LIBRARY_CARD.summary },
      resources: RESOURCES.map((r) => ({
        ...r,
        links: r.links.filter((l) => !l.webOnly),
        faq: r.faq?.map((f) => ({ ...f, links: (f.links ?? []).filter((l) => !l.webOnly) })),
      })),
      contactEmail: contactEmail(),
    },
  });
}
