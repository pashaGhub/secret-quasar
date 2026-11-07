import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Secret Quasar",
  description:
    "Secret Quasar — a real-time neon quasar: a GPU-raymarched black hole with segmented energy rings, laser jets and a live visor HUD.",
  openGraph: {
    title: "Secret Quasar",
    description: "A real-time neon quasar, rendered live in your browser.",
    images: [{ url: "/quasar/poster.jpg", width: 1920, height: 1080 }],
    type: "website",
  },
  twitter: { card: "summary_large_image" },
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
