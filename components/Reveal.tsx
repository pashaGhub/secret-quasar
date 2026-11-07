"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * One-shot scroll reveal. Children render visible on the server (no JS → no hidden content);
 * on mount the wrapper is marked `data-reveal="pending"` and flips to `"in"` the first time it
 * scrolls into view. CSS keyed on those attributes does the animating. Already on screen at
 * mount, or reduced motion → straight to "in" (no hide/flash).
 */
export default function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => (el.dataset.reveal = "in");
    if (el.dataset.reveal === "in") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const r = el.getBoundingClientRect();
    const onScreen = r.top < window.innerHeight * 0.9 && r.bottom > 0;
    if (reduce || onScreen || !("IntersectionObserver" in window)) {
      show();
      return;
    }
    el.dataset.reveal = "pending";
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -18% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
