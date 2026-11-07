"use client";

import { useEffect, useRef } from "react";
import "@/quasar/hud/hud.css";
import "@/quasar/hud/title.css";
import "@/quasar/quasar.css";

/**
 * Full-bleed hero with the real-time neon quasar.
 *
 * - The shell (poster, <h1>, scroll cue) is server-rendered, so the page has content, SEO and a
 *   stable layout before any JavaScript runs.
 * - The GPU engine, Three.js and the HUD live in their own chunk, loaded after hydration
 *   (a dynamic import inside the effect — it never runs on the server).
 * - The effect returns the dispose function, so unmounting (navigation, React Strict Mode's
 *   double-mount in dev) releases the WebGL context and every listener.
 */
export default function QuasarHero({ scrollTo = "#content" }: { scrollTo?: string }) {
  const heroRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current, stage = stageRef.current, title = titleRef.current;
    if (!hero || !stage || !title) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import("@/quasar/mount")
      .then(({ mountQuasar }) => {
        if (!cancelled) dispose = mountQuasar(hero, stage, title);
      })
      .catch((err) => {
        console.error("[quasar] failed to start", err);
        hero.dataset.state = "fallback";
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="sq-hero"
      tabIndex={0}
      aria-label="Secret Quasar — interactive quasar visualization. Space pauses, R restarts, M changes mode, H toggles the HUD."
    >
      {/* static fallback image: shown only when WebGL2 is unavailable or the context is lost */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sq-poster" src="/quasar/poster.jpg" alt="" width={1920} height={1080} loading="lazy" decoding="async" />
      <div ref={stageRef} />
      <div ref={titleRef} />
      <h1 className="sq-sr-only">Secret Quasar</h1>
      <a className="sq-scroll" href={scrollTo}>SCROLL</a>
    </section>
  );
}
