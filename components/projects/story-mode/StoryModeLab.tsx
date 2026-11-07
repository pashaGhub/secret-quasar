"use client";

import { useState } from "react";
import StoryModeScene from "./StoryModeScene";

// Frame presets: the scene is judged in the size it will actually have on the page.
const FRAMES = {
  desktop: { label: "Desktop (scene column + text)", scene: "w-[58%] aspect-[1.3/1]", text: true },
  mobile: { label: "Mobile (390 wide)", scene: "w-[390px] aspect-[1/1.05]", text: false },
  full: { label: "Full window", scene: "w-full h-[calc(100svh-3rem)]", text: false },
} as const;
type Frame = keyof typeof FRAMES;

export default function StoryModeLab() {
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
      </nav>
      <div className={`mx-auto flex items-center gap-10 ${frame === "mobile" ? "justify-center py-8" : "px-6 py-8"} ${frame === "full" ? "p-0 py-0 px-0" : ""}`}>
        <div className={`relative shrink-0 ${f.scene}`}>
          <StoryModeScene lab />
        </div>
        {f.text && (
          <div className="max-w-md opacity-60">
            <p className="font-mono text-xs tracking-[0.3em] text-[#ffb46e]">RUNELITE PLUGIN · TEXT-TO-SPEECH</p>
            <h2 className="mt-3 font-serif text-5xl">Story Mode</h2>
            <p className="mt-5 leading-7">
              Quests deserve better than a monotone reader. Story Mode gives every NPC a real voice — with
              emotion, pacing and personality.
            </p>
            <p className="mt-6 text-xs text-white/40">(text column placeholder — Phase 5)</p>
          </div>
        )}
      </div>
    </main>
  );
}
