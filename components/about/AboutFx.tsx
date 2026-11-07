"use client";

import { useEffect, useRef } from "react";

// Fragments of the kind of memories games leave behind. They drift past in the wall behind the
// section; nobody reads all of them — the eye just catches one here and there.
const FRAGMENTS = [
  "the first time the map opened up and you saw how big it was",
  "3 a.m. — one more try",
  "the boss at one hit point",
  "your hands shaking after the clutch",
  "a friend you only ever knew by a username",
  "the soundtrack you still hum",
  "the drop after six hundred kills",
  "logging out at the bank and not coming back for a year",
  "coming back",
  "the quest that made you read every line",
  "a sunrise over a world that does not exist",
  "losing everything to a single misclick",
  "laughing until the raid wiped",
  "the save file you can't delete",
  "walking instead of teleporting, just because",
  "the silence after the final boss",
  "a town you'd recognise with your eyes closed",
  "getting lost on purpose",
  "the trade you still regret",
  "the voice that made a character real",
  "clan chat at midnight",
  "the cutscene you didn't skip",
  "your first ninety-nine",
  "the jump you were sure you'd miss",
  "the level-up sound",
  "dying two steps from the exit",
  "the night it finally dropped",
  "the guide nobody wrote, so you wrote it",
  "rain on a rooftop in a city of pixels",
  "the npc who remembered you",
];

const FEELS: [string, string][] = [
  ["wonder", "#40f2ff"],
  ["awe", "#5fb8ff"],
  ["fear", "#7a8cff"],
  ["tension", "#8f6bff"],
  ["rage", "#a04dff"],
  ["doubt", "#c544e8"],
  ["grief", "#e040c8"],
  ["hope", "#ff3fae"],
  ["relief", "#ff5c84"],
  ["serenity", "#ff6f6a"],
  ["calm", "#ff7d5c"],
  ["joy", "#ff7a52"],
  ["pride", "#ff8a1f"],
];

const SECRET = "a secret hiding in plain sight";

// The road's spectrum; the spotlight takes its colour from where it is in the section.
const SPECTRUM: [number, number[]][] = [
  [0, [64, 242, 255]],
  [0.38, [160, 77, 255]],
  [0.7, [255, 63, 174]],
  [1, [255, 138, 31]],
];
function spectrumAt(t: number) {
  for (let i = 1; i < SPECTRUM.length; i++) {
    const [t1, c1] = SPECTRUM[i];
    if (t <= t1) {
      const [t0, c0] = SPECTRUM[i - 1];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    }
  }
  return SPECTRUM[SPECTRUM.length - 1][1];
}

const GLYPHS_UP = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/\\|";
const GLYPHS_LO = "abcdefghjkmnpqrstuvwxyz0123456789#%&*+=<>/\\|";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function AboutFx() {
  const wallRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wall = wallRef.current;
    const svg = svgRef.current;
    const head = headRef.current;
    const section = wall?.closest<HTMLElement>(".ab-section");
    if (!wall || !svg || !head || !section) return;
    const inner = section.querySelector<HTMLElement>(".ab-inner")!;
    const rows = wall.querySelector<HTMLElement>(".ab-wall-rows")!;
    const light = wall.querySelector<HTMLElement>(".ab-light")!;
    const track = svg.querySelector<SVGPathElement>(".ab-road-track")!;
    const fill = svg.querySelector<SVGPathElement>(".ab-road-fill")!;
    const grad = svg.querySelector<SVGLinearGradientElement>("linearGradient")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let disposed = false;

    // ---------- the wall ----------
    let builtRows = 0;
    let builtW = 0;
    const buildWall = () => {
      const w = section.clientWidth;
      const h = section.clientHeight;
      const lh = parseFloat(getComputedStyle(rows).lineHeight) || 26;
      const n = Math.ceil(h / lh) + 1;
      if (n === builtRows && Math.abs(w - builtW) < 160) return;
      builtRows = n;
      builtW = w;
      const charW = (parseFloat(getComputedStyle(rows).fontSize) || 12) * 0.68;
      const need = Math.ceil((Math.max(w, 640) * 1.1) / charW); // per copy; two copies loop seamlessly
      const secretRow = Math.floor(n * 0.42);
      const frag = document.createDocumentFragment();
      for (let r = 0; r < n; r++) {
        const rand = rng(r * 7919 + 31);
        const row = document.createElement("div");
        row.className = "ab-row";
        const tr = document.createElement("div");
        tr.className = "ab-row-track";
        const copy = document.createElement("span");
        let len = 0;
        let k = 0;
        while (len < need) {
          const roll = rand();
          if (r === secretRow && k === 2) {
            const s = document.createElement("span");
            s.className = "ab-secret";
            s.textContent = SECRET;
            copy.append(s, " / ");
            len += SECRET.length + 3;
          } else if (roll < 0.22) {
            const [w8, c] = FEELS[Math.floor(rand() * FEELS.length)];
            const s = document.createElement("span");
            s.className = "ab-f";
            s.style.setProperty("--c", c);
            s.textContent = w8;
            copy.append(s, " / ");
            len += w8.length * 1.4 + 3;
          } else {
            const t = FRAGMENTS[Math.floor(rand() * FRAGMENTS.length)];
            copy.append(t + " / ");
            len += t.length + 3;
          }
          k++;
        }
        tr.append(copy, copy.cloneNode(true));
        const dur = len * (0.16 + rand() * 0.1);
        tr.style.animationDuration = `${dur.toFixed(1)}s`;
        tr.style.animationDelay = `-${(rand() * dur).toFixed(1)}s`;
        if (r % 2) tr.style.animationDirection = "reverse";
        row.append(tr);
        frag.append(row);
      }
      rows.replaceChildren(frag);
    };

    // ---------- the road ----------
    let lut: { len: number; x: number; y: number }[] = [];
    let total = 0;
    let yStart = 0;
    let yEnd = 1;
    const buildRoad = () => {
      const sr = section.getBoundingClientRect();
      const ir = inner.getBoundingClientRect();
      const cs = getComputedStyle(inner);
      const left = ir.left - sr.left + parseFloat(cs.paddingLeft);
      const cw = ir.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const pts = [...section.querySelectorAll<HTMLElement>(".ab-waypoint")].map((el) => {
        const r = el.getBoundingClientRect();
        return [left + cw * Number(el.dataset.x || 0.5), r.top - sr.top] as const;
      });
      const star = section.querySelector<SVGElement>("[data-waypoint-end]");
      if (star) {
        const r = star.getBoundingClientRect();
        pts.push([r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2]);
      }
      if (pts.length < 2) return;
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const dy = (y1 - y0) * 0.55;
        d += ` C${x0.toFixed(1)} ${(y0 + dy).toFixed(1)} ${x1.toFixed(1)} ${(y1 - dy).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }
      svg.setAttribute("viewBox", `0 0 ${sr.width.toFixed(0)} ${sr.height.toFixed(0)}`);
      track.setAttribute("d", d);
      fill.setAttribute("d", d);
      grad.setAttribute("y1", pts[0][1].toFixed(0));
      grad.setAttribute("y2", pts[pts.length - 1][1].toFixed(0));
      total = fill.getTotalLength();
      fill.style.strokeDasharray = `${total} ${total}`;
      lut = [];
      const N = 240;
      for (let i = 0; i <= N; i++) {
        const len = (total * i) / N;
        const p = fill.getPointAtLength(len);
        lut.push({ len, x: p.x, y: p.y });
      }
      yStart = pts[0][1];
      yEnd = pts[pts.length - 1][1];
    };

    let arrived = false;
    const updateRoad = (sr: DOMRect) => {
      if (!lut.length) return;
      // the road's head follows a line a little below the middle of the viewport
      const target = reduce ? Infinity : window.innerHeight * 0.72 - sr.top;
      let i = 0;
      while (i < lut.length - 1 && lut[i + 1].y <= target) i++;
      const a = lut[i];
      const b = lut[Math.min(i + 1, lut.length - 1)];
      const k = b.y > a.y ? clamp((target - a.y) / (b.y - a.y), 0, 1) : 1;
      const len = target <= yStart ? 0 : a.len + (b.len - a.len) * k;
      const x = a.x + (b.x - a.x) * k;
      const y = a.y + (b.y - a.y) * k;
      fill.style.strokeDashoffset = `${(total - len).toFixed(1)}`;
      const showHead = len > 2 && target < yEnd;
      head.style.opacity = showHead ? "1" : "0";
      head.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (!arrived && target >= yEnd) {
        arrived = true;
        section.dataset.road = "done";
      } else if (!arrived) {
        section.dataset.road = "draw";
      }
    };

    // ---------- spotlight ----------
    const pos = { x: -9999, y: -9999 };
    const aim = { x: 0, y: 0 };
    let pointer = false;
    let lastHue = "";
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const sr = section.getBoundingClientRect();
      aim.x = e.clientX - sr.left;
      aim.y = e.clientY - sr.top;
      if (!pointer && pos.x < -1000) {
        pos.x = aim.x;
        pos.y = aim.y;
      }
      pointer = true;
    };
    const onLeave = () => (pointer = false);
    if (finePointer && !reduce) {
      section.addEventListener("pointermove", onMove, { passive: true });
      section.addEventListener("pointerleave", onLeave);
    }

    // ---------- frame loop (only while the section is on screen) ----------
    let raf = 0;
    let visible = false;
    const frame = (now: number) => {
      raf = 0;
      if (disposed || !visible) return;
      const sr = section.getBoundingClientRect();
      updateRoad(sr);
      if (!reduce) {
        if (!pointer) {
          const t = now / 1000;
          aim.x = sr.width * (0.5 + 0.4 * Math.sin(t * 0.21) * Math.cos(t * 0.07));
          aim.y = window.innerHeight * (0.5 + 0.3 * Math.sin(t * 0.33 + 1.2)) - sr.top;
        }
        if (pos.x < -1000) {
          pos.x = aim.x;
          pos.y = aim.y;
        }
        const ease = pointer ? 0.14 : 0.03;
        pos.x += (aim.x - pos.x) * ease;
        pos.y += (aim.y - pos.y) * ease;
        const r = light.offsetWidth / 2;
        const hue = spectrumAt(clamp(pos.y / sr.height, 0, 1)).join(" ");
        if (hue !== lastHue) {
          lastHue = hue;
          light.style.setProperty("--lc", hue);
        }
        light.style.transform = `translate3d(${(pos.x - r).toFixed(1)}px, ${(pos.y - r).toFixed(1)}px, 0)`;
      }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf && visible && !disposed) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) {
          section.dataset.live = "";
          kick();
        } else {
          delete section.dataset.live;
        }
      },
      { rootMargin: "80px 0px" },
    );
    io.observe(section);

    // ---------- decoding phrases ----------
    const scrambles = [...section.querySelectorAll<HTMLElement>("[data-scramble]")];
    const timers: number[] = [];
    const restore: (() => void)[] = [];
    const runScramble = (el: HTMLElement) => {
      const nodes: { node: Text; text: string; at: number[] }[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (node.data.trim()) nodes.push({ node, text: node.data, at: [] });
      }
      restore.push(() => nodes.forEach((n) => (n.node.data = n.text)));
      const count = nodes.reduce((s, n) => s + n.text.length, 0);
      const D = Math.min(2400, 900 + count * 16);
      let idx = 0;
      for (const n of nodes)
        for (let i = 0; i < n.text.length; i++, idx++) n.at.push((idx / count) * D * 0.7 + Math.random() * D * 0.3);
      el.dataset.scr = "run";
      const t0 = performance.now();
      let last = 0;
      const step = (now: number) => {
        if (disposed) return;
        const t = now - t0;
        if (t >= D) {
          for (const n of nodes) n.node.data = n.text;
          el.dataset.scr = "done";
          return;
        }
        if (now - last > 50) {
          last = now;
          for (const n of nodes) {
            let s = "";
            for (let i = 0; i < n.text.length; i++) {
              const ch = n.text[i];
              if (ch === " " || t >= n.at[i]) s += ch;
              else {
                const set = ch === ch.toLowerCase() ? GLYPHS_LO : GLYPHS_UP;
                s += set[Math.floor(Math.random() * set.length)];
              }
            }
            n.node.data = s;
          }
        }
        timers.push(requestAnimationFrame(step));
      };
      timers.push(requestAnimationFrame(step));
    };
    let sio: IntersectionObserver | null = null;
    if (!reduce) {
      for (const el of scrambles) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) continue; // already on screen: leave it be
        el.dataset.scr = "wait";
      }
      sio = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const el = e.target as HTMLElement;
            if (e.isIntersecting && el.dataset.scr === "wait") {
              sio?.unobserve(el);
              runScramble(el);
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px" },
      );
      scrambles.forEach((el) => el.dataset.scr === "wait" && sio!.observe(el));
    }

    // ---------- layout ----------
    const layout = () => {
      if (disposed) return;
      buildWall();
      buildRoad();
      updateRoad(section.getBoundingClientRect());
    };
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(layout, 120);
    });
    ro.observe(section);
    layout();
    // fonts change line breaks (and with them the waypoints) once they load
    document.fonts?.ready.then(layout);
    section.dataset.fx = "";

    return () => {
      disposed = true;
      io.disconnect();
      sio?.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      timers.forEach(cancelAnimationFrame);
      window.clearTimeout(resizeTimer);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      // put the real text back in case we unmount mid-scramble (Strict Mode remount)
      restore.forEach((f) => f());
      for (const el of scrambles) delete el.dataset.scr;
      rows.replaceChildren();
      delete section.dataset.live;
      delete section.dataset.road;
      delete section.dataset.fx;
    };
  }, []);

  return (
    <>
      <div ref={wallRef} className="ab-wall" aria-hidden="true">
        <div className="ab-wall-rows" />
        <div className="ab-light" />
      </div>
      <div className="ab-wall-glow" aria-hidden="true" />
      <svg ref={svgRef} className="ab-road" aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ab-road-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1000">
            <stop offset="0" stopColor="#40f2ff" />
            <stop offset="0.38" stopColor="#a04dff" />
            <stop offset="0.7" stopColor="#ff3fae" />
            <stop offset="1" stopColor="#ff8a1f" />
          </linearGradient>
        </defs>
        <path className="ab-road-track" />
        <path className="ab-road-fill" stroke="url(#ab-road-grad)" />
      </svg>
      <span ref={headRef} className="ab-road-head" aria-hidden="true" />
    </>
  );
}
