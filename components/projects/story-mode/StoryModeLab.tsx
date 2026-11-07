"use client";

import { useState } from "react";
import type { Creator } from "@/projects/story-mode/creators";
import StoryModeCopy from "./StoryModeCopy";
import StoryModeViewer from "./StoryModeViewer";
import StoryModeCreatorsEditor from "./StoryModeCreatorsEditor";
import "./story-mode-section.css";

// Frame presets: the scene is judged in the size it will actually have on the page.
const FRAMES = {
  desktop: { label: "Desktop (scene + copy)", width: "w-[58%]", frame: "relative aspect-[1.3/1]", text: true },
  mobile: { label: "Mobile (390 wide)", width: "w-[390px]", frame: "relative aspect-[1/1.05]", text: false },
  full: { label: "Full window", width: "w-full", frame: "relative h-[calc(100svh-7rem)]", text: false },
} as const;
type Frame = keyof typeof FRAMES;

export default function StoryModeLab({ creators }: { creators: Creator[] }) {
  const [frame, setFrame] = useState<Frame>("desktop");
  const f = FRAMES[frame];
  return (
    <main className="min-h-svh bg-[#07060a] text-[#e8dcc8]">
      <nav className="flex h-12 items-center gap-2 border-b border-white/10 px-4 font-mono text-xs">
        <span className="mr-3 tracking-[0.3em] text-[#ffb46e]">STORY MODE · LAB</span>
        {(Object.keys(FRAMES) as Frame[]).map((k) => (
          <button
            key={k}
            onClick={() => setFrame(k)}
            className={`rounded-sm border px-2 py-1 ${k === frame ? "border-[#ffb46e] text-[#ffb46e]" : "border-white/15 text-white/60 hover:text-white"}`}
          >
            {FRAMES[k].label}
          </button>
        ))}
        <a href="#creators-editor" className="ml-auto rounded-sm border border-white/15 px-2 py-1 text-white/60 hover:text-white">
          Creators editor ↓
        </a>
      </nav>
      {/* the copy column is a size container (title sized in cqi), so it needs an explicit flex size */}
      <div className={`sm-section mx-auto flex items-center gap-10 [&>.sm-copy]:min-w-0 [&>.sm-copy]:flex-1 ${frame === "mobile" ? "justify-center py-8" : "px-6 py-8"} ${frame === "full" ? "p-0 py-0 px-0" : ""}`}>
        <StoryModeViewer lab className={`shrink-0 ${f.width}`} frameClassName={f.frame} />
        {f.text && <StoryModeCopy />}
      </div>
      <StoryModeCreatorsEditor initial={creators} />
    </main>
  );
}
