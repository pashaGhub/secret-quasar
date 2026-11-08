"use client";

import { useEffect, useRef } from "react";
import "@/projects/awkward-silence-button/awkward-silence-button.css";

const POSTER = "/projects/awkward-silence-button/poster.jpg";
const POSTER_NARROW = "/projects/awkward-silence-button/poster-narrow.jpg";

/**
 * Client wrapper for the Awkward Silence Button WebGL scene. The engine (Three.js + icons.glb) is a
 * separate chunk imported inside the effect; the effect returns its dispose, so Strict Mode's double
 * mount and navigation release the GPU context. `lab` adds the lil-gui tuning panel (dev route only).
 */
export default function AsbScene({ lab = false, className = "" }: { lab?: boolean; className?: string }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current, stage = stageRef.current;
    if (!scene || !stage) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import("@/projects/awkward-silence-button/mount")
      .then(({ mountAsb }) => {
        if (cancelled) return;
        dispose = mountAsb(scene, stage, { lab, eager: lab });
      })
      .catch((err) => {
        console.error("[asb] failed to start", err);
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
      id="awkward-silence-button-scene"
      className={`asb-scene ${className}`}
      tabIndex={0}
      role="group"
      aria-label="Awkward Silence Button scene: a big red PRESS button surrounded by the app's seven glowing category icons."
    >
      {/* still image, shown only without WebGL2, after a lost context or a failed load (lazy + display:none
          until then, so it is never fetched when the scene runs); square crop for the phone frame */}
      <picture>
        <source media="(max-width: 39.99rem)" srcSet={POSTER_NARROW} width={1080} height={1134} />
        <img className="asb-poster" src={POSTER} alt="" width={1560} height={1200} loading="lazy" decoding="async" />
      </picture>
      <div ref={stageRef} className="asb-stage" />
    </div>
  );
}
