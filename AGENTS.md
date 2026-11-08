<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: Secret Quasar portfolio site

Personal portfolio built with Next.js (App Router). The home page is the quasar hero, an About
section, then one section per portfolio project, usually with its own live WebGL scene. Fully static
export (`output: "export"` → `out/`), hosted on Cloudflare (static assets via Workers Builds, from Git).
Each project has its own plan in `docs/<slug>-plan.md` — read the plan of the project you are touching;
plans record decisions and results and are history, not to-do lists.

## Roadmap
- More projects, each with its **own animation** (own engine, own section on the home page).
- A **detail page per project** with more than the home section shows; the section stays a short teaser that links to it.

Remove an item here when it is done. Don't list individual projects in this file.

## Stack
- Next 16.4.5 (static export; `cacheComponents` off), React 19.3, TypeScript, Tailwind v4 (`@tailwindcss/turbopack`).
- `three@0.169.0` (addons via `three/addons/*`). No Rive — it was removed on purpose.
- Commands: `npm run dev`, `npm run build`, `npm run lint`. Run lint + build before calling work done.
- Static export means: no route handlers, server actions, cookies, middleware/proxy or image optimizer
  in production code. Every page must be prerenderable.

## Layout (by pattern; look in the folders for what exists)
- `app/page.tsx` — home: hero → About → one section per project → footer. Sections have an `id`.
- `app/layout.tsx`, `app/globals.css` — metadata (`metadataBase` from `NEXT_PUBLIC_SITE_URL` /
  `CF_PAGES_URL`), colour tokens, `@theme` (`neon-*`, `font-display`, `font-mono`). `app/icon.svg`,
  `favicon.ico`, `apple-icon.png` are the favicon set.
- `components/` — shared React pieces (`QuasarHero`, `Reveal`, …); `components/about/`.
- `quasar/` — plain-JS, browser-only engine for the hero: `mount.js` (single entry, returns dispose),
  `engine/`, `hud/`, `bridge.js`, `timeline.js`. The hero is the site's identity, not a project.
- `lib/scene/` — shared browser-only Three.js helpers every scene mounts through (pixel-ratio cap, WebGL2 check,
  reduced-motion flag, lazy start, `renderSlot`). Reuse them; don't re-implement.
- `projects/<slug>/` — one project's plain-JS engine (`mount.js` entry returning dispose, `engine/`, params, data, css).
- `components/projects/<slug>/` — that project's React side: server `…Section.tsx` (layout + copy), client scene
  island, section css.
- `public/projects/<slug>/` — that project's models, posters, fonts. `public/quasar/` — hero assets and `og.jpg`
  (link preview, source `docs/og/og.html`). `public/_headers` — cache/security headers (honoured by Cloudflare).
- `app/lab/**/*.dev.tsx|ts` — dev-only tuning pages/routes. `pageExtensions` in `next.config.ts` drops them from
  the production build, so `/lab/*` is a 404 live.
- `docs/` — one plan per project plus shared sources like `og/`.
- `wrangler.jsonc` — see Deploy.

## Conventions for WebGL sections
- The section shell is server-rendered. A client component loads the engine with a dynamic
  `import()` inside `useEffect` and calls the returned dispose on unmount — not `next/dynamic`
  with `ssr: false`.
- Must be React Strict Mode safe: the engine creates/removes its own canvases; dispose frees
  geometries, materials, render targets and calls `renderer.forceContextLoss()`.
- Register with `renderSlot` from `lib/scene` so only one heavy scene renders at a time; boot lazily
  (about one screen away) so the page never creates several WebGL contexts or fetches every model up front.
- No WebGL2 or context loss → static poster (`data-state="fallback"`); don't restart after a context loss.
- `prefers-reduced-motion` → calm/static variant, no flashes.
- Aim for ~60 fps: DPR cap from `lib/scene`, adaptive resolution, lighter settings on phones. Headless checks
  can't measure frame rate — ask the user to confirm on a real laptop/phone.
- Keyboard shortcuts bind to the focused section element only, never `window`.
- Size HUD/overlays from the section (container queries / ResizeObserver), not the viewport.
- Real headings stay in React markup for SEO/a11y; animated duplicates are `aria-hidden`.
- Give each project a CSS class prefix (short, unique) so styles can't leak between projects.
- Keep `.glb` files compressed (meshopt).

## Adding a project
1. Write `docs/<slug>-plan.md` first: creative direction, layout/copy, assets and their licences, phases with
   approval STOPs. Get the direction approved before building.
2. Engine in `projects/<slug>/`, assets in `public/projects/<slug>/`, React side in `components/projects/<slug>/`.
3. Add the section to `app/page.tsx`. Optional dev lab at `app/lab/<slug>/page.dev.tsx` (stays out of production).
4. Poster, reduced-motion and no-WebGL2 fallbacks; check against the conventions above.
5. Record results in the plan. Lint + build. This file should need no edits — if a rule changed, edit the rule.

## Project detail pages
- Route `app/<base>/[slug]/page.tsx` with `generateStaticParams()` over one project list and `dynamicParams = false`;
  `generateMetadata` per project (title, description, og image). In Next 16 `params` is a Promise — check
  `node_modules/next/dist/docs/` before writing it.
- Keep one source of truth for project metadata (slug, title, tagline, links, poster, order) used by the home
  section, the page and metadata, so adding a project is one new entry.
- URL base: `public/projects/<slug>/` already serves assets at `/projects/<slug>/…`. A page at `/projects/<slug>`
  would share that path and the `/projects/*` cache rule in `_headers`. Choose the base once with the user
  (different base, or narrow the rule to asset files) and record the choice here.
- A page may reuse the project's engine; give `mount()` options for that. Same rules: `renderSlot`, fallbacks, dispose.
- Home section links to its page; the page links back to `/#<section-id>`.

## Deploy (Cloudflare Workers Builds)
- Build `npm run build`, deploy `npx wrangler deploy`, env `NODE_VERSION=22.23.4`.
- `wrangler.jsonc` is assets-only (`assets.directory: ./out`, `not_found_handling: 404-page`). Keep it: without it
  Wrangler autodetects Next.js and attempts an OpenNext server build, which fails on a static export.
- `NEXT_PUBLIC_SITE_URL` sets `metadataBase` for social cards; set it once there is a domain. The `CF_PAGES_URL`
  fallback is a Pages variable and may be missing on Workers Builds, so metadata can fall back to `localhost:3000`.
- The user does the Git push and Cloudflare setup; don't claim the site is live unless they say so.
