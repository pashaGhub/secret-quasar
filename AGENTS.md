<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: Secret Quasar portfolio site

Personal portfolio built with Next.js (App Router). Each portfolio project gets its own section,
usually with a live WebGL scene. Static export (`output: "export"` → `out/`), deployed on Cloudflare Pages.

## Stack
- Next 16.4.5 (static export; `cacheComponents` off), React 19.3, TypeScript, Tailwind v4 (`@tailwindcss/turbopack`).
- `three@0.169.0` (addons via `three/addons/*`). No Rive — it was removed on purpose.
- Commands: `npm run dev`, `npm run build`, `npm run lint`. Run lint + build before calling work done.

## Layout
- `app/page.tsx` — the home page: `<QuasarHero>` → `<AboutSection>` (`#content`, `components/about/`) → `<StoryModeSection>` → footer.
- `app/layout.tsx`, `app/globals.css` — metadata (`metadataBase` from `NEXT_PUBLIC_SITE_URL` /
  `CF_PAGES_URL`), colour tokens, `@theme` (`neon-*`, `font-display`, `font-mono`).
- `components/QuasarHero.tsx` — client wrapper for the hero.
- `quasar/` — plain-JS, browser-only engine for the hero: `mount.js` (single entry, returns
  dispose), `engine/` (ray-marched black hole, rings, particles, post), `hud/` (HTML visor HUD +
  "SECRET QUASAR" title), `bridge.js` (params/telemetry/keyboard), `timeline.js`.
- `public/quasar/` — fonts, `poster.jpg`, `og.jpg` (link preview, source `docs/og/og.html`). `public/_headers` — Cloudflare Pages cache/security headers.
- `app/lab/**/*.dev.tsx|ts` — dev-only lab pages/routes (`pageExtensions` in `next.config.ts` drops them from the
  production build). Static export means no `cacheComponents`/PPR, no server routes or actions.
- `docs/` — plans. **Current next task: `docs/story-mode-plan.md`.**

## Conventions for WebGL sections (follow these for new projects)
- The section shell is server-rendered. A client component loads the engine with a dynamic
  `import()` inside `useEffect` and calls the returned dispose on unmount — not `next/dynamic`
  with `ssr: false`.
- Must be React Strict Mode safe: the engine creates/removes its own canvases; dispose frees
  geometries, materials, render targets and calls `renderer.forceContextLoss()`.
- Render only when visible: IntersectionObserver + `visibilitychange` → `engine.start()/stop()`.
- No WebGL2 or context loss → show a static poster (`data-state="fallback"`).
- `prefers-reduced-motion` → calm/static variant, no flashes.
- Keyboard shortcuts bind to the focused section element only, never `window`.
- Size HUD/overlays from the section (container queries / ResizeObserver), not the viewport.
- Real headings stay in React markup for SEO/a11y; animated duplicates are `aria-hidden`.
- Assets live in `public/<project>/`; keep `.glb` files compressed (meshopt).
