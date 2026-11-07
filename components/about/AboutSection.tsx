import { Fragment, type CSSProperties, type ReactNode } from "react";
import Reveal from "@/components/Reveal";
import AboutFx from "./AboutFx";
import "./about-section.css";

/**
 * "About the project" as a piece of typographic art. Server-rendered; AboutFx (client) adds
 * the living parts:
 *  - a wall of drifting, half-lit fragments of game memories behind everything, with a
 *    spotlight (the pointer, or a slow wander on touch) that brings them up;
 *  - a spectrum "road" threaded through the waypoints below, drawn as you scroll, that ends
 *    at a star — the memory;
 *  - phrases that decode out of glyph noise the first time they come into view.
 * Everything readable is real markup; the wall and the road are decorative (aria-hidden).
 */

const vars = (v: Record<string, string | number>) => v as CSSProperties;

const HEADING = ["A", "secret", "hiding", "in"];

// The feelings on the road, in order: dark ones in the middle, light ones at both ends.
const FEELINGS: { w: string; c: string; s: number; y: number }[] = [
  { w: "wonder", c: "var(--cyan)", s: 1, y: -0.18 },
  { w: "hope", c: "#5fb8ff", s: 1.2, y: 0.16 },
  { w: "fear", c: "#7a8cff", s: 0.95, y: -0.24 },
  { w: "rage", c: "var(--violet)", s: 1.25, y: 0.2 },
  { w: "doubt", c: "#d040e0", s: 0.9, y: -0.1 },
  { w: "relief", c: "var(--pink)", s: 1.05, y: 0.18 },
  { w: "pride", c: "#ff6a5a", s: 1.3, y: -0.14 },
  { w: "serenity", c: "var(--orange)", s: 0.95, y: 0.12 },
];

/** A phrase that decodes from glyph noise. A hidden "ghost" copy holds the final layout so
 *  nothing reflows while the visible copy scrambles; screen readers get the plain text. */
function Phrase({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  return (
    <p className={`ab-phrase ${className ?? ""}`}>
      <span className="sr-only">{text}</span>
      <span className="ab-scr" aria-hidden="true">
        <span className="ab-scr-ghost">{children}</span>
        <span className="ab-scr-live" data-scramble="">
          {children}
        </span>
      </span>
    </p>
  );
}

/** A point the road passes through: placed in the flow, x as a fraction of the content width. */
const Waypoint = ({ x }: { x: number }) => <i className="ab-waypoint" data-x={x} aria-hidden="true" />;

export default function AboutSection() {
  return (
    <section id="content" aria-labelledby="about-title" className="ab-section">
      <AboutFx />

      <div className="ab-inner">
        <Reveal className="ab-intro">
          <Waypoint x={0.02} />
          <p className="ab-kicker">ABOUT THE PROJECT</p>
          <h2 id="about-title" className="ab-title">
            {HEADING.map((w, i) => (
              <Fragment key={w}>
                <span className="ab-w" style={vars({ "--wi": i })}>
                  {w}
                </span>{" "}
              </Fragment>
            ))}
            <span className="ab-w ab-spectrum" style={vars({ "--wi": HEADING.length })}>
              plain sight.
            </span>
          </h2>
        </Reveal>

        <Waypoint x={0.12} />

        <div className="ab-block ab-block-right">
          <Phrase text="You won't remember the drop rate. You'll remember the night it dropped.">
            You won&apos;t remember the drop rate.
            <br />
            <em className="ab-hl">You&apos;ll remember the night it dropped.</em>
          </Phrase>
          <p className="ab-aside">
            We build for the moments you still talk about years later — not the numbers that got you
            there.
          </p>
        </div>

        <Waypoint x={0.9} />

        <Reveal className="ab-block ab-feel-wrap">
          <p className="ab-feel" aria-label="Wonder, hope, fear, rage, doubt, relief, pride, serenity.">
            {FEELINGS.map((f, i) => (
              <span
                key={f.w}
                className="ab-feel-w"
                aria-hidden="true"
                style={vars({ "--c": f.c, "--s": f.s, "--y": `${f.y}em`, "--fi": i })}
              >
                {f.w}
              </span>
            ))}
          </p>
          <p className="ab-aside ab-aside-center">
            One achievement. Every feeling on the way to it.{" "}
            <span className="ab-dim">If the road didn&apos;t move you, the trophy won&apos;t either.</span>
          </p>
        </Reveal>

        <Waypoint x={0.08} />

        <div className="ab-block ab-block-center">
          <Phrase className="ab-phrase-xl" text="Hours spent in digital worlds are still hours of your life.">
            <span className="ab-lead">Hours spent in digital worlds are still</span>
            <br />
            <em className="ab-hl">hours of your life.</em>
          </Phrase>
          <p className="ab-aside ab-aside-center">So we try to make them mean something.</p>
        </div>

        <div className="ab-end">
          <svg className="ab-star" viewBox="0 0 24 24" aria-hidden="true" data-waypoint-end="">
            <path d="M12 0 L14.3 9.7 L24 12 L14.3 14.3 L12 24 L9.7 14.3 L0 12 L9.7 9.7 Z" />
          </svg>
        </div>
      </div>
    </section>
  );
}
