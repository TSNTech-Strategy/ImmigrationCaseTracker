import { getApiUser } from "@/lib/auth/session";
import { firmDocumentService } from "@/lib/firms";

/** A firm document, decrypted, for a member of the same firm. Opens in the browser when it can (PDF, images). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return new Response("Please sign in.", { status: 401 });
  const { id } = await params;
  const r = await firmDocumentService().download(user.id, id);
  if (!r.ok) return new Response("Not found.", { status: 404 });
  const inline = new URL(request.url).searchParams.get("view") === "1" && /^(application\/pdf|image\/(png|jpeg|webp))$/.test(r.contentType);
  const ascii = r.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return new Response(new Uint8Array(r.data), {
    headers: {
      "content-type": r.contentType,
      "content-length": String(r.data.length),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(r.name)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
