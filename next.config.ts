import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The "Share my journey" picture reads its fonts and logo from disk.
  outputFileTracingIncludes: {
    "/api/v1/cases/[id]/journey-card": ["./src/assets/**"],
    "/cases/[id]/journey-card": ["./src/assets/**"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
