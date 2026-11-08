# Awkward Silence Button — 3D section plan (v1, draft for direction)

A section on the Secret Quasar portfolio site presenting **Awkward Silence Button**, the user's icebreaker
app (web + iOS/Android): press one big red button, get a random conversation-starter question.
Source project: `D:\Coding\awkward-silence-button` (device folder `$HOME/mnt/awkward-silence-button`).

Status: **Phase 6 done — ready to ship (2026-11-08). The user commits, pushes and deploys.**

Decided with the user (2026-11-07):
- **Layout:** text on the **left**, animation on the **right** (mirror of Story Mode).
- **Tech:** Three.js 3D scene, own engine in `projects/awkward-silence-button/` (portfolio pattern).
- **Icons:** the app's 7 category icons from `awkward-silence-button/assets`, in the app's
  **dark-theme** category hues (`app/globals.css`, `html[data-theme='dark']`), pushed to full saturation for neon.
- **Look (revised after Phase 1, 2026-11-07):** **arcade neon**, in the site's language — the first soft
  studio look read as out of context next to the hero. Button label in **Orbitron**; button red may read
  hot pink under the glow (OK'd).
- **Copy:** reuse the app's own English copy (`locales/en/common.json`). No live question demo,
  no store badges.
- **Concept A — The Press.** Mobile: **scene above copy**. CTA: a link to
  **https://awkwardsilencebutton.com**. Button cap says **PRESS**. Icons are **handmade by the user**
  (no third-party licence).

---

## Source assets

### Category → icon → colour

The app maps categories to files in `components/CategoryIcon.tsx` (note: `personal` uses
`personal_diary.svg`; `personal.svg` is unused there and is not part of this section).

| Category (`QuestionCategory`) | Icon file | Dark-theme colour | CSS var | Paths in SVG |
|---|---|---|---|---|
| personal | `personal_diary.svg` | `#c4b5fd` violet | `--category-personal` | 48 |
| romantic | `romantic.svg` | `#fda4af` rose | `--category-romantic` | 1 |
| philosophical | `ancient.svg` | `#5eead4` teal | `--category-philosophical` | 7 |
| culture | `culture.svg` | `#fcd34d` amber | `--category-culture` | 12 |
| common | `earth.svg` | `#60a5fa` blue | `--category-common` | 1 |
| food *(app only)* | `food.svg` | `#faa651` orange | `--category-food` | 1 |
| travelAndAdventure *(app only)* | `travel.svg` | `#86efac` green | `--category-travel-adventure` | 16 |

Other brand colours (dark theme): button `#ff5b6b` / pressed `#d63a4a`, background `#0d0f14`,
text `#ececf1`, muted `#a8adbb`, soft `#6f7488`. The app's dark mode already uses glow
(`--button-glow`, `--icon-glow-radius: 14px`, `text-glow`), which maps naturally onto bloom.

The app's motion vocabulary is worth reusing so the section feels like the same product:
`breathe` (button scale 1 → 1.03, 2 s), `icon-pop` (overshoot pop with rotation, 0.7 s,
`cubic-bezier(0.34, 1.56, 0.64, 1)`), `icon-idle` (slow bob + ±1.5° rock, 3.5 s), `question-in`
(fade-up with blur).

### SVG notes

The icons are potrace output: single black fill, `pt` units, a flipped `transform` on the group,
holes as nested sub-paths, and very different viewBoxes (480×600 up to 1800×1800). For 3D they must be
normalised (centred, same visual size, Y up) and extruded. `personal_diary.svg` (48 paths, 41 KB)
and `culture.svg` (12 paths, 28 KB) are the heaviest and will likely need curve simplification so the
extrusions stay light and the bevels clean.

**Licence:** handmade by the user — no third-party restrictions.

---

## Creative direction (common to all concepts)

- **Mood:** playful and a little cheeky, but in the **site's arcade-neon language** (pure black, cyan /
  violet / pink glow, Orbitron, HUD lines) so it sits next to the quasar hero. *(Revised 2026-11-07: the first
  draft — soft studio light, pastel candy tokens, "the opposite of the neon hero" — looked out of context.)*
- **Icon tokens:** each icon extruded into a 3D token (depth ≈ 13 % of its width, small bevel) and lit as a
  **neon sign**: dark glossy body (`#0a0a12`, clearcoat), every edge, wall and hole glowing in the category
  colour (fresnel rim → emissive → bloom). Colours = the app's dark-theme hues at full saturation; dim hues
  (violet, blue, pink) are lifted so all seven glow about equally.
- **The button:** the hero object — an arcade button built in code (lathe): dark metal plinth, glossy red
  cap lit from inside, **"PRESS" in Orbitron** (the site's display face, `/quasar/fonts/Orbitron-Variable.ttf`)
  glowing white with 0.2em tracking, a pink neon ring around the well and a thin cyan ring at its foot. The
  app's `breathe` pulse drives the cap scale and all the button's glow. An arcade-marquee **comet** chases
  around both rings (pink one way, cyan the other); a pink point light follows it around the token ring and
  each token's edges flare as it passes. Label and steady ring glow are kept low so the comet carries the light.
- **Stage:** black floor (low-gloss metal) with a neon grid fading into the dark (cyan near → violet far)
  and a pink light pool under the button; pink and cyan fill lights; bloom does the rest.
- **Silence is a visual beat:** before a press the scene is calm and slightly dim; the press is the
  release (light, colour, motion). That contrast *is* the app's story.
- **Pointer:** gentle — tokens tilt / lean toward the pointer, slight camera parallax. No parallax on touch.

## Animation concepts (A chosen)

All three: auto-press every ~6–8 s while the section is on screen, plus click/tap on the button
(and Enter/Space when the scene is focused). Each press "chooses" one category at random.

### A. The Press (button burst) — **chosen**
The red button sits centre-stage; the 7 tokens float in a loose ring around it with the app's
`icon-idle` bob. On press: the cap sinks (squash), a ring-shaped shockwave runs across the floor,
the tokens get kicked outward and spin, then spring back into the ring — except the chosen one,
which `icon-pop`s up above the button, turns to face the camera, glows in its colour and hangs
there for a beat before rejoining the ring.
- **Why:** clearest read of the product in one second (button → category), cheap to render, robust
  on phones. Closest to the app's real UI.
- **Risk:** the most literal; needs good easing/secondary motion to feel premium.

### B. Silence → Spark
A dim, quiet void: the tokens drift slowly in zero-g, desaturated and almost unlit, with a faint
"…" speech bubble pulsing near the button. On press: a light ripple travels out from the button and
lights the tokens up in their colours one after another (a wave of colour), small speech-bubble
particles bloom around them, the chosen token drifts forward into focus (shallow DoF); after a few
seconds the scene fades back to silence.
- **Why:** the most atmospheric; tells "awkward silence → conversation" as a mood, not a diagram.
- **Risk:** subtler — the "button" idea reads less at a glance; DoF + bloom cost more on phones.

### C. Pile & Pop (physics)
Tokens rain down and pile up in a shallow bowl around the button. On press: the button punches up
and launches the pile into the air; tokens tumble, bounce off each other and settle again; the chosen
one lands face-up on top of the button.
- **Why:** the most fun and tactile; very "toy-like".
- **Risk:** needs a physics engine (new dependency, e.g. `cannon-es` ~50 KB gz or Rapier WASM), more
  CPU, harder to make deterministic for the poster and reduced-motion variants.

*A + B can be combined:* A's composition and press, with B's dim "silence" state between presses.

---

## Layout & copy

- **Placement:** in `app/page.tsx` after `<StoryModeSection />`, before the footer;
  `id="awkward-silence-button"`, `aria-labelledby="asb-title"`.
- **Desktop (≥ 1024 px):** grid copy `1fr` | scene `1.45fr` — Story Mode's ratio, mirrored.
- **Mobile:** stacked, **scene above copy** (same as Story Mode).
- **Title:** real `<h2>`; display face = **Orbitron** (the site's; changed from the app's Geist in review round 1). Optional decorative reveal synced to the first press
  (letters pop in with the `icon-pop` easing) — the animated copy is `aria-hidden`.
- **Category legend:** a row of the 7 icons as small **2D** CSS-mask chips (same technique as the app's
  `CategoryIcon`) under the copy; the chip of the category chosen by the latest press lights up
  (driven by the scene's `asb:press {category}` event). Ties the text and the animation together.

**Draft copy (from the app's `locales/en/common.json`; wording to be confirmed):**

> *Icebreaker app · Web, iOS & Android*
> ## Awkward Silence Button
> **Press when the conversation dies.**
> One press is all it takes to rescue a dying conversation. The Awkward Silence Button instantly
> delivers a fun icebreaker question — no preparation, no awkwardness required.
>
> 1. Press the big red button
> 2. Get a random icebreaker question
> 3. Break the silence and let the conversation flow
>
> *Personal · Romantic · Philosophical · Culture · Common · Food · Travel & Adventure* (legend chips)
>
> [Try it at awkwardsilencebutton.com ↗]

The link opens in a new tab (`target="_blank" rel="noopener noreferrer"`); styled as an `asb-` button in
the button red, with a red focus ring.

## Interactions

| Trigger | Result |
|---|---|
| Idle | button `breathe` pulse + glow, tokens `icon-idle` bob/rock, slow light drift |
| First time ≥ 50 % in view (once) | first press plays immediately; title reveal syncs to it |
| Auto | a press every ~6–8 s while in view (paused when off screen / tab hidden) |
| Click / tap button, Enter / Space when focused | press now (auto-timer resets) |
| Hover button | cursor pointer, button lifts slightly, glow up |
| Pointer over scene | tokens lean toward the pointer, slight camera parallax (not on touch) |
| `prefers-reduced-motion` | no auto-press, no shockwave/particles/flash; press = short cap dip + chosen token crossfades to lit |

Events (bubbling, on the section): `asb:press {category}`, `asb:settled`; `section[data-press]` =
`idle` → `pressing` → `revealed` for CSS hooks.

---

## Code structure (portfolio pattern)

- `projects/awkward-silence-button/` — `mount.js` (entry, returns dispose), `params.js` (look/motion
  defaults), `lab.js`, `awkward-silence-button.css`, `engine/`: `AsbEngine.js` (load, lights, loop),
  `button.js` (lathe button, press spring), `tokens.js` (icon tokens, idle, pop), `fx.js`
  (shockwave / particles), `post.js` (bloom, grade; reuse Story Mode's approach where it fits).
- `components/projects/awkward-silence-button/` — `AsbSection.tsx` (server: layout), `AsbCopy.tsx`,
  `AsbLegend.tsx` (2D icon chips), `AsbScene.tsx` (client island: dynamic `import()` in `useEffect`,
  dispose on unmount), `asb-section.css`.
- `public/projects/awkward-silence-button/` — `icons.glb`, `icons/*.svg` (for the 2D legend), `poster.jpg`, fonts.
- `app/lab/awkward-silence-button/page.dev.tsx` — dev-only tuning page (lil-gui), as for Story Mode.
- CSS class prefix: **`asb-`**. Through `lib/scene`: `createRenderer`, `pixelRatioCap`, `hasWebGL2`,
  `reducedMotion`, `lazyStart`, `renderSlot`, `disposeRenderer`.

## Phases (stop for approval where marked)

0. **Direction.** ✅ Concept A; open questions answered (2026-11-07).
1. **Icon tokens.** Normalise + simplify the 7 SVGs, extrude with bevel (Blender via MCP: import SVG →
   curve → extrude/bevel → mesh, save as `asb_icons_3d.blend`; or `SVGLoader` + `ExtrudeGeometry` in a
   one-off script) → `icons.glb`, meshopt, budget < 200 KB, one node per category named by its key,
   each centred and scaled to the same visual size, facing +Z. Button built in code.
   → **STOP:** renders of all 7 tokens + button. ✅ 2026-11-07 (geometry kept; look redone as arcade neon).
2. **Scene prototype on `/lab/awkward-silence-button`.** Composition, camera, lights, materials,
   bloom/grade, background. Frame presets (desktop column, mobile). → **STOP:** stills + short recording.
   ✅ approved 2026-11-07 (after review round 1).
3. **Animation & interaction.** Idles, press (spring + shockwave + token reaction), chosen-token reveal,
   auto-press timer, hover, pointer lean, events. ✅ 2026-11-07, see *Phase 3 results*.
4. **Section in the site.** Grid (copy left / scene right), copy, legend chips synced to `asb:press`,
   title reveal, mobile stack. → **STOP:** user reviews on local dev. ✅ 2026-11-08 (user: continue).
5. **Fallbacks & performance.** Poster (`data-state="fallback"`) for no WebGL2 / context loss / load
   failure; reduced-motion variant; `renderSlot` + `lazyStart`; adaptive resolution; lighter phone
   settings (no MSAA, fewer particles); no restart after context loss. Ask the user to check fps on a real
   laptop and phone. ✅ built 2026-11-08, see *Phase 5 results*; the user's fps check was good (2026-11-08).
6. **Ship.** `npm run lint`, `npm run build`, serve `out/` and check; record results here. The user deploys.
   ✅ 2026-11-08, see *Phase 6 results*.

## Phase 1 results (2026-11-07) — geometry approved; look superseded by Phase 2

**Route taken:** the script route (three `SVGLoader` + `ExtrudeGeometry` in Node), not Blender — the icons
are flat silhouettes, so a script is simpler to rebuild and tune. No `.blend` file.

**Output:** `public/projects/awkward-silence-button/icons.glb` — **132 KB** (≈ 85 KB gzipped), 36 k triangles,
`EXT_meshopt_compression` + `KHR_mesh_quantization` (12-bit positions). Load with
`GLTFLoader().setMeshoptDecoder(MeshoptDecoder)`, as Story Mode does.

- **Nodes:** one per category, named by its `QuestionCategory` key (`personal`, `romantic`, `philosophical`,
  `culture`, `common`, `food`, `travelAndAdventure`), each with the mesh on a **`<key>__mesh`** child.
  Quantization puts its scale/offset on the `__mesh` child, so the engine can freely set the parent's transform.
  Extras on each parent: `{ file, color }` (source SVG, dark-theme hex). Each has a material `asb_<key>` with
  that colour as base colour (the engine is expected to replace materials).
- **Frame:** Y up, front face toward **+Z**, centred in X, Y and Z. Visual size equalised: scale =
  1 / mix(larger side, √(w·h), 0.5), so the bust and hearts don't look smaller than the globe
  (sizes now 0.6–1.1 × 0.77–1.17). Depth 0.134 (0.11 wall + 2 × 0.012 bevel).
- **NO NORMALS in the file** (baked creased normals were ~60 % of the size). Rebuild on load:
  `geometry = toCreasedNormals(geometry, 35°)` (`three/addons/utils/BufferGeometryUtils.js`; returns a
  non-indexed geometry, a few ms for all seven). The crease angle is a look parameter for the lab.
- **Simplification:** Béziers → 8 segments → Ramer–Douglas–Peucker at 0.002 units (≈ 0.2 px at a 100 px token);
  specks < 1.2e-5 units² dropped (personal 10, culture 5, food 1, travel 0 — invisible potrace dust).
  Bevel 0.006 wide, offset −0.003 (half in, half out) so the thin diary lines and noodles neither collapse nor bloat.

**Button:** `projects/awkward-silence-button/engine/button.js` — `createButton(opts)` →
`{ group, cap, ready, setPress(p), setGlow(g), dispose }`. Lathed dark plinth (r 1.36) with a well, glossy domed
red cap (r 1, `#ff5b6b`, clearcoat) on a pivot; **PRESS** in Geist Bold, white with 0.2em tracking (the app's
button, rather than the "lighter red" first sketched here), on a canvas texture with planar top-down UVs, a light
bump emboss and its own glow via `emissiveMap`. Label nudged 0.1 toward the camera so it reads centred from the
3/4 view. `setPress(1)` sinks the cap 0.11 and squashes it; the spring belongs to Phase 3. Axis +Y, sits on the floor.

**Font:** `public/projects/awkward-silence-button/fonts/Geist-Bold.woff2` (+ `OFL.txt`) from the `geist` npm
package 1.9.2 (Vercel, SIL OFL 1.1). Loaded by `button.js` via `FontFace` when `fontUrl` is passed.

**Build scripts + renders:** `C:\Blender\asb3d\` — `build-icons.mjs`, `compress.mjs`, `package.json`, `README.md`,
`render.html` + `shot.cjs` (token check renders), `renders/` (lineups front/angle, close-ups, button rest / pressed
/ top, rough composition preview). Rebuild: `npm install && npm run build` there, copy `icons.glb` here.

`npm run lint` and `npm run build` pass (nothing imports the new files yet).

## Decisions (Phase 0)

1. **Concept:** A — The Press.
2. **Mobile order:** scene above copy.
3. **CTA:** link to https://awkwardsilencebutton.com (no store badges, no detail-page placeholder for now).
4. **Button cap:** says "PRESS".
5. **Icon artwork:** handmade by the user.

## Phase 2 results (2026-11-07) — approved

**Look change first:** the Phase 1 renders (soft studio light, pastel tokens, Geist label) looked out of
context next to the arcade-neon hero. A look test (`C:\Blender\asb3d\neon.html`, renders `neon_*.png`)
settled the direction; the user chose: the **app's colours** (saturated), **Orbitron** on the button,
hot-pink-reading red is fine. Creative direction above is updated.

**Lab:** `/lab/awkward-silence-button` (dev only; `page.dev.tsx` → 404 in production). Frame presets: desktop
(copy placeholder 1fr | scene 1.45fr, aspect 1.3 : 1), mobile (390 wide, 1 : 1.05), full window. lil-gui panel
with every look value; "Copy params" → paste into `params.js`. Console: `window.asbLab`.

**Code** (`projects/awkward-silence-button/`):
- `mount.js` — `mountAsb(section, stage, { lab, eager })`: WebGL2 check, lazy boot (~one screen away),
  `renderSlot`, `data-state` idle → loading → live / fallback, reduced-motion → calm (no idles). Returns dispose.
- `params.js` — all look values. `narrow` overrides camera + ring for frames with aspect < 1.1 (phones): steeper
  camera, deeper ellipse, so the ring fills the square frame instead of a thin band.
- `engine/AsbEngine.js` — renderer (`lib/scene`), camera framing (fixed vertical FOV, never narrower than
  `minHalfWidth`), lights, loop (start/stop), resize, context loss, dispose.
- `engine/tokens.js` — loads the 7 nodes, rebuilds creased normals, neon-sign material, ring layout (starts at the
  back, app order, alternating roll, aimed above the camera), the app's `icon-idle` (bob + ±1.5° rock, 3.5 s, out
  of phase).
- `engine/button.js` — arcade button (see Creative direction); `apply(look)`, `setPress`, `setGlow`.
- `engine/stage.js` — floor, antialiased shader grid (additive, fades out), pink light pool.
- `engine/post.js` — HDR (MSAA ×4 on desktop, none on phones) → bloom → ACES/sRGB → vignette + grain.
- `awkward-silence-button.css` — scene shell (`asb-` prefix).
- React: `components/projects/awkward-silence-button/AsbScene.tsx` (client island), `AsbLab.tsx`.

**Idle motion now:** token bob/rock; button `breathe` (cap 1 → 1.03 over 2 s, glow + pool +25–30 %).
The empty space above the button on desktop is deliberate: the chosen token pops up there in Phase 3.

**Review files:** stills + 7 s recordings (desktop, mobile) were sent in chat; frames rendered headless
(software GL), so no fps figure yet — check on a real laptop/phone in Phase 5.

**Review round 1 (2026-11-07):**
- Title font: **Orbitron** too (the site's display face). The Phase 1 Geist files were deleted (user OK'd);
  no new font files — both the label and the title use `/quasar/fonts/Orbitron-Variable.ttf`.
- Label and ring glow were too intense → label 1.6 → 0.7, pink ring 3 → 1.1, cyan 2 → 0.8.
- Light now **moves around the ring**: ring shader comet (`button.chase`, `chaseTail`, `chaseSpeed` 0.22 turns/s),
  a following pink point light (`light.chase*`) and a token flare (`tokens.chase`). Cost ≈ nothing: a few
  uniforms per frame; the light count is fixed (moving a light doesn't recompile or add passes).
  Reduced motion: comet parked at the front, no motion.
- The following light put a hot pink rim highlight on the back of the cap whenever it passed behind the button
  → it now fades out while it is behind the button *as seen from the camera* (beyond the button and within
  ~1.6–2.6 units sideways of the camera→button line; `light.chaseHideBehind`, 1 = fully out). Camera-relative, so
  it also holds for the steeper phone camera. Tokens still flare via their own shader as the comet passes.

`npm run lint` and `npm run build` pass.

## Phase 3 results (2026-11-07)

`engine/press.js` (new) runs the choreography, stepped per frame by the engine (so everything pauses with the
render slot). Values in `params.press` (lab folder "Press", button "▶ Press").
- **Press:** cap held down `capHold` 0.12 s then a bouncy spring back; button glow flash + light-pool flash +
  small bloom boost; the ring comet bursts to ~4× speed and eases back.
- **Shockwave:** a ring in the grid shader (lines flare + soft band, `#ff6ad5`), 7 units/s, 1.2 s life.
- **Tokens:** kicked outward + up and spun (alternating direction) as the wave reaches each one, then spring back.
- **Reveal:** the chosen category pops up above the button after 0.18 s with the app's icon-pop easing
  (`cubic-bezier(0.34, 1.56, 0.64, 1)`, 0.7 s, ×1.6, decaying ±14° wobble), faces the camera, edge glow up;
  the others dim 22 %. Holds 2.4 s, returns in 0.9 s. Never the same category twice in a row.
- **Silence beat:** between presses the glow sinks to 78 % (`quiet`); a press releases it.
- **Auto-press** every 6–8 s (engine time, so it pauses off screen / hidden tab); a manual press resets the timer.
  First press: the first time the scene is ≥ 50 % on screen (`mount.js`).
- **Input:** click/tap on the button (raycast; a tap that scrolls doesn't count), Enter/Space on the focused
  section; hover → pointer cursor, button lifts 0.05 and glows; mouse → tokens lean toward the pointer and the
  camera follows a little (none on touch).
- **Events** on the section: `asb:press` / `asb:revealed` / `asb:settled` `{category}` (`interrupted: true` when
  a press cuts a reveal short); `data-press` idle → pressing → revealed → idle.
- **Reduced motion:** no idles, comet parked, no auto-press, no wave/kick/flash; a press = short cap dip + the
  chosen token's glow crossfades up in place, then back.
- **Phones:** `narrow.press` puts the reveal higher (y 3.0, z 0.5, ×1.35) and the camera aim at ty 0.75 so it
  clears the button in the square frame.

## Phase 4 results (2026-11-07) — approved 2026-11-08

- `app/page.tsx`: `<AsbSection />` after Story Mode. `#awkward-silence-button`, `aria-labelledby="asb-title"`.
- `components/projects/awkward-silence-button/`: `AsbSection.tsx` (server shell), `AsbCopy.tsx` (copy, legend,
  CTA; also used by the lab), `AsbSectionFx.tsx` (client: lights the legend chip of each press, title reveal),
  `asb-section.css` (`asb-` prefix).
- Layout: desktop ≥ 64rem copy `1fr` | scene `1.45fr`; phones scene above copy. Scene frame 1.3 : 1
  (1 : 1.05 below 40rem), edges dissolve into the page (mask, as Story Mode). Hint under the scene
  ("Click / Tap the button — or wait for it").
- Type: Orbitron (`--font-display`) title/tagline/CTA, Share Tech Mono (`--font-mono`) kicker/steps/chips — both
  already declared by the hero's CSS on the home page; no new font files. Title "Awkward Silence" white +
  "Button" in the button red → hot pink. Letters pop in with the first press (`data-title` armed → on); not armed
  with reduced motion; shown at once if the scene falls back or 4.5 s after the scene is on screen without a press.
- Legend chips: 2D icons in `public/projects/awkward-silence-button/icons/<key>.svg` (generated by
  `C:\Blender\asb3d\build-icons.mjs` from the same simplified contours, 29 KB total), CSS masks; the chip of
  the latest press lights up in its colour.
- CTA: "Try it at awkwardsilencebutton.com ↗", new tab, button red, red focus ring; scales with the column so the
  domain stays on one line on phones.
- Checked headless: desktop 1440, iPhone 13 (390) and iPhone SE (320; hint + kicker wrap to 2 lines there),
  no horizontal scroll; events / chips / title / reduced motion behave as above. No fps numbers yet (Phase 5).

`npm run lint` and `npm run build` pass.

## Phase 5 results (2026-11-08) — fps check on real devices pending

- **Posters** (`public/projects/awkward-silence-button/`): `poster.jpg` 1560×1200 (desktop frame 1.3 : 1, 149 KB) and
  `poster-narrow.jpg` 1080×1134 (phone frame 1 : 1.05 with the `narrow` camera, 122 KB). Rendered from the lab
  (deterministic frames, 1.7 s after a press with Philosophical revealed, grain off), progressive JPEG q82. In
  `AsbScene.tsx` as `<picture>` (narrow below 40rem, the frame breakpoint), `loading="lazy"` and `display:none`
  until `data-state="fallback"`, so a working scene never downloads them (checked: no poster request while live).
  The frame's edge mask applies to the poster too. The "Click the button" hint is hidden on fallback.
- **Fallback paths checked headless:** no WebGL2 (desktop + phone: right poster, title shown) and a lost context
  while live (poster shown; after `restoreContext()` the scene stays down — 0 draw calls, Enter does nothing).
- **Adaptive resolution** (same rule as Story Mode): starts at the DPR cap (1.5 desktop / 1.25 phone), median frame
  time over 45 frames, −15 % above ~21 ms, +10 % below ~17.5 ms, at most one step per 2.5 s, floor 0.8 (thin
  neon lines break up below that). Lab: "render resolution" (auto / fixed) and an fps · res readout over the scene
  (updated 4×/s).
- **User check 1 (2026-11-08, DevTools CPU throttling "mid-tier mobile" 3.9×, lab in dev mode):** ~30 fps, res fell to
  0.80. CPU throttling slows only the page's main thread, not the GPU, so lowering the resolution can't help there.
  Measured: the scene's own main-thread work per frame is ~0.4 ms (≈ 5 ms at 4× throttle), 29 draw calls, ~50 k
  triangles, no shader recompiles after load; the rest of the throttled frame is browser and dev-mode overhead.
  **Fix:** adaptive resolution now checks each step down: if the frame time doesn't improve by ≥ 8 % the step is
  undone and the resolution held (20 s, doubling, ≤ 2 min) — it no longer blurs for nothing on a CPU-limited
  device. Simulated: pixel-bound load → steps to 0.85 and stays; CPU-bound load → back to full, held 20/40/80/120 s.
  Lab readout says "(held: not pixel-bound)" while held.
- **Phones:** no MSAA (already), bloom mip chain at 60 % resolution (`createPost({ bloomScale })`). No particles
  in this scene, so nothing else to thin out.
- **Reduced motion:** the scene was already static (Phase 3); now it also **renders on demand** — after load,
  a resize or param change it draws ~90 frames, during a press until it settles, and on hover changes; otherwise
  it draws nothing (checked: 0 draw calls while idle, draws on Enter, idle again after). The silence-beat dimming
  is off in calm mode (a slow fade would keep the loop busy).
- **No fps numbers yet:** headless software GL runs at ~2 fps, so it only proves the adaptation steps. To check:
  `npm run dev` → `/lab/awkward-silence-button` (readout top-left; "Desktop" and "Mobile" frames) on the laptop,
  and the home page on a phone (or the lab on the phone via the LAN address).

`npm run lint` and `npm run build` pass.

## Creators & contributors — "The fellowship" (2026-11-08, requested before Phase 6)

Same band as under Story Mode, across the bottom of the section (`AsbCreators.tsx`, server-rendered; classes `asb-creator*`,
neon pink/cyan instead of amber). Data: `projects/awkward-silence-button/creators.json` — edit by hand and commit;
`creators.ts` reuses Story Mode's `normalizeCreators` / `safeHref` / `safeSrc` / `initials`, so links are limited to
http(s), mailto and `/paths`, and an empty avatar falls back to initials. **Lab editor** at the bottom of
`/lab/awkward-silence-button` (*Creators editor ↓* in the nav): the shared editor, see below. Save writes the JSON through
`POST /lab/awkward-silence-button/creators` (dev only); commit it to publish.
Seeded from the app repo's git history, **roles left empty, to be confirmed**: pashaGhub (github.com/pashaGhub) and
Eryk Tatol (github.com/isterikas). Checked at 1440, 390 and 320 px: no horizontal scroll, kicker/title centred.

**Shared creators editor (2026-11-08):** the editor was made reusable. `components/creators/CreatorsEditor.tsx` takes
`initial`, `saveUrl`, `file`, `accent` (CSS colour, set as `--ce`) and a `preview(creators)` render function; each lab has a thin
wrapper that supplies its own band and styles (`StoryModeCreatorsEditor.tsx`, `AsbCreatorsEditor.tsx`). The dev-only save route is
`lib/creators/saveRoute.ts` → `creatorsSaveHandler("projects/<slug>/creators.json")`, used by both `app/lab/<slug>/creators/route.dev.ts`
(same-origin only, 404 in production, absent from the export). Validation helpers still live in `projects/story-mode/creators.ts`.
A new project gets an editor with one wrapper, one route file and one JSON file. Checked in both labs: edit → live preview → save
writes the right file, accent colour applies, Story Mode behaves as before.
Also fixed a Phase 4 bug found on the way: duplicate React keys in the title letters (`AsbCopy.tsx`; a space and the letter before it
shared a key). Harmless on screen, but it logged a warning.

## Phase 6 results (2026-11-08) — ready to ship

- **User fps check:** good on the real devices (after the adaptive-resolution fix, see Phase 5).
- **Clean `npm run lint` and `npm run build`** (`out/` and `.next/` removed first): pass; one static route `/`.
- **`out/` served** (static server, like the host) and checked headless: desktop 1440 and phone 390 — the scene goes live, a press fires
  `asb:press` / `asb:revealed`, the matching legend chip lights, the title letters show, 2 creator cards, CTA → awkwardsilencebutton.com,
  no horizontal scroll, no 4xx/5xx; no WebGL2 — `data-state="fallback"`, `poster.jpg` fetched (only then); `/lab/awkward-silence-button` → 404.
  The only console errors are external requests this sandbox blocks (GitHub avatars, tunnel failures); the avatars need a look on the
  user's machine or live.
- **Weight:** `public/projects/awkward-silence-button/` = 452 KB (icons.glb 132 KB, posters 149 + 122 KB, 7 SVG icons 29 KB); no new font files.
  Nothing from the scene loads until the section is about a screen away (the 7 legend SVGs load with the page, 29 KB). The lab panel
  (lil-gui) is a lazy chunk in the export, never requested by visitors (checked), the same as Story Mode's.
- **Licences:** icons and the app's colours/copy are the user's own; Orbitron is already on the site (SIL OFL, `/quasar/fonts/`); no third-party
  models, textures or music.
- **Left for the user:** commit and push (the new `AsbSection` is in `app/page.tsx`); `AGENTS.md` / `CLAUDE.md` show as modified from `next dev`
  — don't commit those with this work. Confirm the two creators' roles (`creators.json`). After deploy, look at the section once on the live URL.
