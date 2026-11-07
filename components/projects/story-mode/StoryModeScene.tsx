"use client";

import { useEffect, useRef, type RefObject } from "react";
import "@/projects/story-mode/story-mode.css";

/**
 * Client wrapper for the Story Mode WebGL scene. The engine (Three.js + scene.glb) is a separate
 * chunk imported inside the effect; the effect returns its dispose, so Strict Mode's double mount
 * and navigation release the GPU context. `lab` adds the lil-gui tuning panel (dev route only).
 * `apiRef` receives the book controls once the engine is mounted (used by the controls bar).
 */
const POSTER = "/projects/story-mode/poster.jpg";

export type StoryModeApi = { open: () => void; close: () => boolean };

export default function StoryModeScene({
  lab = false,
  className = "",
  apiRef,
}: {
  lab?: boolean;
  className?: string;
  apiRef?: RefObject<StoryModeApi | null>;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current, stage = stageRef.current;
    if (!scene || !stage) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import("@/projects/story-mode/mount")
      .then(({ mountStoryMode }) => {
        if (cancelled) return;
        const mounted = mountStoryMode(scene, stage, { lab, eager: lab });
        dispose = mounted;
        if (apiRef && mounted.open && mounted.close) apiRef.current = { open: mounted.open, close: mounted.close };
      })
      .catch((err) => {
        console.error("[story-mode] failed to start", err);
        scene.dataset.state = "fallback";
      });
    return () => {
      cancelled = true;
      if (apiRef) apiRef.current = null;
      dispose?.();
    };
  }, [lab, apiRef]);

  return (
    <div
      ref={sceneRef}
      id="story-mode-scene"
      className={`sm-scene ${className}`}
      tabIndex={0}
      role="group"
      aria-label="Story Mode scene: the Wise Old Man reads from a glowing tome. Press Enter or click the book to turn the page."
    >
      {/* still image, shown only without WebGL2, after a lost context or a failed load */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="sm-poster"
        src={POSTER}
        alt=""
        width={1552}
        height={1230}
        loading="lazy"
        decoding="async"
      />
      <div ref={stageRef} className="sm-stage" />
    </div>
  );
}
