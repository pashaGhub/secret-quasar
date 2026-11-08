"use client";

import { useEffect, useRef } from "react";

/**
 * Ties the copy to the scene: listens for the scene's asb:* events on the section and
 *  - lights the legend chip of the category the latest press chose (data-lit on the chip),
 *  - pops the title letters in on the first press (data-title: armed → on on the section).
 * The title is only "armed" (dimmed, waiting) when motion is allowed; reduced motion, a scene that
 * falls back to a still, or no press within a few seconds of being on screen all show it at once,
 * so the heading never depends on WebGL to be readable. Renders nothing itself.
 */
export default function AsbSectionFx() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = ref.current?.closest<HTMLElement>(".asb-section");
    if (!section) return;
    const scene = section.querySelector<HTMLElement>(".asb-scene");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const showTitle = () => { section.dataset.title = "on"; };
    let safety = 0;
    let stopIo: (() => void) | undefined;
    if (!reduced) {
      section.dataset.title = "armed";
      // safety net: once the scene is well on screen, the first press has a few seconds to happen
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        safety = window.setTimeout(showTitle, 4500);
      }, { threshold: 0.5 });
      io.observe(scene ?? section); // same trigger as the first press (the scene half on screen)
      stopIo = () => io.disconnect();
    }

    const onPress = (e: Event) => {
      const cat = (e as CustomEvent<{ category: string }>).detail?.category;
      section.querySelectorAll<HTMLElement>(".asb-chip").forEach((c) => {
        if (c.dataset.cat === cat) c.dataset.lit = "";
        else delete c.dataset.lit;
      });
      if (section.dataset.title !== "on") showTitle();
    };
    section.addEventListener("asb:press", onPress);

    // the scene fell back to a still image → nothing will press
    const mo = scene ? new MutationObserver(() => { if (scene.dataset.state === "fallback") showTitle(); }) : null;
    if (scene) mo?.observe(scene, { attributes: true, attributeFilter: ["data-state"] });

    return () => {
      section.removeEventListener("asb:press", onPress);
      mo?.disconnect();
      stopIo?.();
      window.clearTimeout(safety);
      delete section.dataset.title;
    };
  }, []);

  return <span ref={ref} hidden />;
}
