import type { Metadata, Viewport } from "next";
import "./globals.css";

// Set NEXT_PUBLIC_SITE_URL (e.g. https://secretquasar.com) in the Cloudflare Pages build settings so
// social cards and canonical URLs use the real domain. CF_PAGES_URL is the per-deploy preview URL.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.CF_PAGES_URL ??
  "http://localhost:3000";

const description =
  "We care about the road to an achievement, not just the finish line. Secret Quasar builds game experiences worth remembering.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Secret Quasar",
  description,
  openGraph: {
    title: "Secret Quasar",
    description,
    siteName: "Secret Quasar",
    // 1200×630 link-preview image; source in docs/og/og.html
    images: [
      {
        url: "/quasar/og.jpg",
        width: 1200,
        height: 630,
        alt: "Secret Quasar — a glowing neon black hole",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Secret Quasar",
    description,
    images: ["/quasar/og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
