"use client";

import { useEffect, useRef } from "react";
import "@/projects/story-mode/story-mode.css";

/**
 * Client wrapper for the Story Mode WebGL scene. The engine (Three.js + scene.glb) is a separate
 * chunk imported inside the effect; the effect returns its dispose, so Strict Mode's double mount
 * and navigation release the GPU context. `lab` adds the lil-gui tuning panel (dev route only).
 */
export default function StoryModeScene({ lab = false, className = "" }: { lab?: boolean; className?: string }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current, stage = stageRef.current;
    if (!scene || !stage) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import("@/projects/story-mode/mount")
      .then(({ mountStoryMode }) => {
        if (!cancelled) dispose = mountStoryMode(scene, stage, { lab });
      })
      .catch((err) => {
        console.error("[story-mode] failed to start", err);
        scene.dataset.state = "fallback";
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [lab]);

  return (
    <div
      ref={sceneRef}
      className={`sm-scene ${className}`}
      tabIndex={0}
      aria-label="Story Mode scene: the Wise Old Man reads from a glowing tome. Press Enter or click the book to turn the page."
    >
      <div ref={stageRef} className="sm-stage" />
    </div>
  );
}
