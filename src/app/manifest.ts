import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CasePingo",
    short_name: "CasePingo",
    description: "Never miss a case update. Independent USCIS case tracking for individuals and law firms.",
    start_url: "/cases",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#0A2345",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
