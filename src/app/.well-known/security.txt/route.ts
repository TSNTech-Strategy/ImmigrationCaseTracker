import { SITE } from "@/lib/site";

/** RFC 9116: how to report a security problem. Expires a year after each deploy; update yearly. */
export function GET() {
  const expires = new Date(Date.now() + 365 * 86_400_000).toISOString();
  const body = [
    `Contact: mailto:${SITE.securityEmail}`,
    `Expires: ${expires}`,
    `Policy: https://${SITE.domain}/security#reporting`,
    `Preferred-Languages: en, es`,
    `Canonical: https://${SITE.domain}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
