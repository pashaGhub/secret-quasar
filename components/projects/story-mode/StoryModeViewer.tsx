"use client";

import { useEffect, useRef, useState } from "react";
import StoryModeScene, { type StoryModeApi } from "./StoryModeScene";

type Book = "closed" | "opening" | "open" | "closing";
const BOOK_EVENTS: Record<string, Book> = {
  "storymode:open-start": "opening",
  "storymode:opened": "open",
  "storymode:close-start": "closing",
  "storymode:closed": "closed",
};

/**
 * The scene in its frame, plus a slim controls bar underneath: the interaction hint on the left
 * and an Open / Close book button on the right. The bar follows the scene's book state through the
 * storymode:* DOM events, and hides itself when the scene falls back to a still image.
 */
export default function StoryModeViewer({
  lab = false,
  className = "",
  frameClassName = "sm-frame",
}: {
  lab?: boolean;
  className?: string;
  frameClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<StoryModeApi | null>(null);
  const [book, setBook] = useState<Book>("closed");
  const [pending, setPending] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onBook = (e: Event) => {
      setBook(BOOK_EVENTS[e.type]);
      setPending(false);
    };
    for (const type of Object.keys(BOOK_EVENTS))
      root.addEventListener(type, onBook);
    // data-state / data-book are set by the engine on the scene element: catch the initial book
    // state (reduced motion starts open) and the still-image fallback
    const scene = root.querySelector<HTMLElement>(".sm-scene");
    const sync = () => {
      if (!scene) return;
      setFallback(scene.dataset.state === "fallback");
      const b = scene.dataset.book as Book | undefined;
      if (b) setBook(b);
    };
    const mo = scene ? new MutationObserver(sync) : null;
    if (scene)
      mo?.observe(scene, {
        attributes: true,
        attributeFilter: ["data-state", "data-book"],
      });
    sync();
    return () => {
      for (const type of Object.keys(BOOK_EVENTS))
        root.removeEventListener(type, onBook);
      mo?.disconnect();
    };
  }, []);

  const isOpen = book === "open" || book === "opening";
  const busy = pending || book === "opening" || book === "closing";
  const toggle = () => {
    const api = apiRef.current;
    if (!api || busy) return;
    setPending(true);
    if (isOpen) {
      if (!api.close()) setPending(false);
    } else api.open();
  };

  return (
    <div ref={rootRef} className={`sm-viewer ${className}`}>
      <div className={frameClassName}>
        <StoryModeScene lab={lab} apiRef={apiRef} />
      </div>
      {!fallback && (
        <div className="sm-controls">
          <button
            type="button"
            className="sm-btn sm-btn-sm"
            onClick={toggle}
            disabled={busy}
            aria-controls="story-mode-scene"
          >
            <svg className="sm-btn-gem" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 0.8 L11.2 6 L6 11.2 L0.8 6 Z" />
            </svg>
            {isOpen ? "Close the book" : "Open the book"}
          </button>
          <p className="sm-hint">
            <span className="sm-hint-dot" aria-hidden="true" />
            <span>
              <span className="sm-hint-pointer">Click</span>
              <span className="sm-hint-touch">Tap</span>{" "}
              {isOpen ? "the tome to turn the page" : "the tome to open it"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
