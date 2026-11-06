import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://casepingo.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/cases", "/bulletin", "/firm", "/admin", "/settings", "/billing", "/auth", "/reset-password"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
