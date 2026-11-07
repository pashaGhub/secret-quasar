import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Production is a fully static site (Cloudflare Pages): `next build` writes it to out/.
  output: "export",
  // The Story Mode lab and its creators-editor route are dev-only tools. Their files are named
  // *.dev.tsx / *.dev.ts, which only count as pages/routes while running `next dev`, so the
  // production export contains just the real site (and /lab/* is a 404).
  pageExtensions: isDev ? ["tsx", "ts", "jsx", "js", "dev.tsx", "dev.ts"] : ["tsx", "ts", "jsx", "js"],
  experimental: {
    agentFeedback: true,
  },
  // cacheComponents / partialPrefetching (PPR) can't be combined with `output: "export"`. Every page here
  // is static, so nothing is lost; turn them back on if the site moves to a server runtime.
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
