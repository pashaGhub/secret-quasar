"use client";

import { useState } from "react";
import AsbScene from "./AsbScene";
import AsbCopy from "./AsbCopy";
import AsbCreatorsEditor from "./AsbCreatorsEditor";
import type { Creator } from "@/projects/story-mode/creators";
import "./asb-section.css";

// Frame presets: the scene is judged in the size it will actually have on the page
// (desktop: copy 1fr | scene 1.45fr, copy on the left; mobile: scene above copy).
// The lab page has no hero, so the copy shows in fallback fonts here (Orbitron comes from the hero's CSS).
const FRAMES = {
  desktop: { label: "Desktop (copy + scene)", width: "w-[59%]", frame: "relative aspect-[1.3/1]", text: true },
  mobile: { label: "Mobile (390 wide)", width: "w-[390px]", frame: "relative aspect-[1/1.05]", text: false },
  full: { label: "Full window", width: "w-full", frame: "relative h-[calc(100svh-7rem)]", text: false },
} as const;
type Frame = keyof typeof FRAMES;

export default function AsbLab({ creators }: { creators: Creator[] }) {
  const [frame, setFrame] = useState<Frame>("desktop");
  const f = FRAMES[frame];
  return (
    <main className="min-h-svh bg-black text-[#e6f4ff]">
      <nav className="flex h-12 items-center gap-2 border-b border-white/10 px-4 font-mono text-xs">
        <span className="mr-3 tracking-[0.3em] text-[#ff3fae]">AWKWARD SILENCE BUTTON · LAB</span>
        {(Object.keys(FRAMES) as Frame[]).map((k) => (
          <button
            key={k}
            onClick={() => setFrame(k)}
            className={`rounded-sm border px-2 py-1 ${k === frame ? "border-[#ff3fae] text-[#ff3fae]" : "border-white/15 text-white/60 hover:text-white"}`}
          >
            {FRAMES[k].label}
          </button>
        ))}
        <a href="#creators-editor" className="ml-auto rounded-sm border border-white/15 px-2 py-1 text-white/60 hover:text-white">
          Creators editor ↓
        </a>
      </nav>
      <div className={`asb-section mx-auto flex items-center gap-10 ${frame === "mobile" ? "justify-center py-8" : frame === "full" ? "" : "px-6 py-8"}`}>
        {f.text && (
          <div className="min-w-0 flex-1">
            <AsbCopy />
          </div>
        )}
        <div className={`shrink-0 ${f.width}`}>
          <div className={f.frame}>
            <AsbScene lab />
          </div>
        </div>
      </div>
      <AsbCreatorsEditor initial={creators} />
    </main>
  );
}
