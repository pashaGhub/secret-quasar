import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoryModeLab from "@/components/projects/story-mode/StoryModeLab";
import { CREATORS } from "@/projects/story-mode/creators";

// Development-only tuning page for the Story Mode scene (camera, lights, fog, post, particles)
// and editor for the creators list.
// It 404s in production builds, so it never ships.
export const metadata: Metadata = {
  title: "Story Mode lab",
  robots: { index: false, follow: false },
};

export default function StoryModeLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StoryModeLab creators={CREATORS} />;
}
