import { firmBrandingService } from "@/lib/firms";

/**
 * A firm's logo, for its clients' status page, upload page and emails. Logos aren't secret, so this
 * is public; the `?v=` in the link changes with every new logo, so a long cache is safe.
 */
export async function GET(request: Request, { params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(firmId)) return new Response("Not found.", { status: 404 });
  const logo = await firmBrandingService().getLogo(firmId);
  if (!logo) return new Response("Not found.", { status: 404, headers: { "cache-control": "no-store" } });
  const current = new URL(request.url).searchParams.get("v") === String(logo.version);
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "content-type": logo.contentType,
      "content-length": String(logo.data.length),
      "cache-control": current ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
