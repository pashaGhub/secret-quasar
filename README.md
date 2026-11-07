# Secret Quasar

Next.js (App Router) site whose hero is a real-time **neon quasar** — a GPU-raymarched black hole
(Three.js / WebGL2) with a live visor HUD. The hero fills the viewport and scrolls away like any other
section.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

Deploy on Vercel as-is (no config needed).

## How it is wired

```
app/page.tsx                  page: <QuasarHero/> + your content sections (the ones below are placeholders)
components/QuasarHero.tsx     "use client" shell: SSR'd <h1>, poster, scroll cue; starts/stops the engine in an effect
quasar/mount.js               lazily-loaded entry: engine + HUD + title + pause-when-offscreen. Returns dispose()
quasar/engine/                Three.js raymarcher, particles, post (bloom, glitch)  ← the visuals
quasar/hud/                   DOM/SVG visor HUD, "SECRET QUASAR" title, CSS
quasar/bridge.js              the only link between engine and HUD (params in, telemetry out)
quasar/timeline.js            intro timing (T.*) and the 7 s energy-burst schedule
quasar/engine/rings.js        ring table: colours, speeds, directions, segment counts  ← main style knobs
public/quasar/                fonts (Orbitron, Share Tech Mono) and poster.jpg (fallback / social image)
```

- **Full intro on load.** The 18 s sequence (deep space → explosion → black hole → quasar) plays from
  the start; users with `prefers-reduced-motion` start on the settled quasar with no flash or glitch.
- **Only renders while visible.** An `IntersectionObserver` + Page Visibility pause the engine when the
  hero is off screen or the tab is hidden (the intro clock pauses with it).
- **Loads lazily.** Three.js and the shaders are a separate chunk fetched after hydration; the
  server-rendered page already has the hero, `<h1>` and content.
- **Fallback.** No WebGL2 / lost context → the poster image with the title.
- **Scrolling stays native.** Touch and wheel scroll straight through the hero. Keyboard shortcuts
  (Space pause · R restart · M mode · H HUD · arrows speed/jets · [ ] energy) only work while the hero
  is focused (click it or Tab to it), so they never fight page scrolling.
- **Cleanup.** Unmounting (or React Strict Mode's dev double-mount) releases the WebGL context and every listener.

## Editing

- **Colours / ring speeds / segments:** `quasar/engine/rings.js`. Black-core size: `HORIZON_SCALE` there.
- **Intro pacing and burst interval:** `quasar/timeline.js`.
- **HUD layout and look:** `quasar/hud/DomHud.js` (structure) and `quasar/hud/hud.css` (style).
  Which readouts and buttons exist: `quasar/hud/contract.js`.
- **Title text / position:** `quasar/hud/Title.js`, `quasar/hud/title.css`.
- **Hero height:** `.sq-hero` in `quasar/quasar.css` (default `100svh`; the HUD rescales to whatever it is).
- **Poster:** replace `public/quasar/poster.jpg` (1920×1080).

### URL options (for testing)

`?t=26` start at 26 s · `?hud=none` · `?q=0.6` fixed resolution scale · `?mode=1` start in
spectral mode · `?paused` · `?nohud`

Third-party: Three.js (MIT), Orbitron and Share Tech Mono (SIL OFL).
