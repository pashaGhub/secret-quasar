import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AsbLab from "@/components/projects/awkward-silence-button/AsbLab";
import { CREATORS } from "@/projects/awkward-silence-button/creators";

// Development-only tuning page for the Awkward Silence Button scene (camera, tokens, button, floor,
// lights, post) and editor for the creators list. It 404s in production builds, so it never ships.
export const metadata: Metadata = {
  title: "Awkward Silence Button lab",
  robots: { index: false, follow: false },
};

export default function AsbLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AsbLab creators={CREATORS} />;
}
