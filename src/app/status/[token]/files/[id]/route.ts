import { firmDocumentService, firmUpdateService } from "@/lib/firms";

/** A file the firm shared with the client, opened from the client's status page link. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const client = await firmUpdateService().portalClient(token);
  if (!client) return new Response("This link no longer works.", { status: 404 });
  const r = await firmDocumentService().downloadShared(client.firmId, client.id, id);
  if (!r.ok) return new Response("Not found.", { status: 404 });
  const inline = new URL(request.url).searchParams.get("view") === "1" && /^(application\/pdf|image\/(png|jpeg|webp))$/.test(r.contentType);
  const ascii = r.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return new Response(new Uint8Array(r.data), {
    headers: {
      "content-type": r.contentType,
      "content-length": String(r.data.length),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(r.name)}`,
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
