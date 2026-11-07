# Story Mode — 3D section plan (v2, approved direction)

A 3D section that presents **Story Mode**, part of the user's RuneLite TTS plugin, on the
Secret Quasar portfolio site. Story Mode = ElevenLabs integration: OSRS quests voiced by
realistic, emotional voices instead of a flat TTS reader.

This replaces an earlier 2D Rive version of the same scene (characters in front of a levitating book).

Status: **Phase 4 done (animation & interaction)** — next: Phase 5 (section in the site). See the *results* sections at the end.

---

## Creative direction

- **Mood:** mystic, ancient, candlelit study. Warm amber/gold light from the book, faint cool
  blue rune light, drifting embers and dust motes, soft fog, dark vignette.
  **Not** the neon style of the Secret Quasar hero.
- **Composition — three depth layers:**
  - *Foreground:* the **chicken** pecking near a lower corner, slightly out of focus (frames the scene, easter egg).
  - *Midground (in focus):* the **tome** hovering above a runic stone circle; the **Wise Old Man**
    beside it as storyteller, hand raised toward it; the **player avatar** facing him across the book.
  - *Background:* **Nieve** leaning on her spear, half in fog, rim-lit only; the **sheep** grazing
    further back as a dim silhouette.
  - Depth from distance fog, subtle depth of field, light falloff away from the book, embers spread
    across all layers, and a very slight mouse-driven camera drift (parallax).
- **Characters:** original low-poly OSRS models and colours, lit "enhanced": book key light,
  rim lights, ground shadows.
- **Book:** new, built from scratch. Chunky / low-poly to match OSRS: worn leather, metal corners,
  clasp, glowing embossed rune. Modelled in Blender; opening and page turns are code-driven
  (segmented page mesh bent in code / vertex shader).

## Interactions

| Trigger | Result |
|---|---|
| Idle loop | breathing, head turns, chicken pecks, sheep grazes, Nieve's cape sways, book hovers, embers + rune pulse |
| First scroll into view (once) | book unlocks and opens with a spark burst; title reveal in sync |
| Click book (+ Enter/Space when focused) | page turns with a spark trail |
| Hover | book glow up, pointer cursor, Wise Old Man and avatar glance slightly toward the cursor |
| `prefers-reduced-motion` | book starts open, minimal motion, page turn = crossfade |

**Voice is skipped for now.** Leave a hook so OSRS-style yellow overhead text + an ElevenLabs
clip on click can be added later.

Animation approach: **code-driven**, with Blender keyframes only where they simplify something.

## Layout & copy

- **Placement:** after the existing feature-cards section (`#content`), before the footer.
  The cards stay for now (the user will later replace them with a "Secret Quasar idea / about me" section).
- **Desktop:** scene left (~55–60%), text right. **Mobile:** scene above text.
- **Title:** "Story Mode" — OSRS-flavoured, ancient, mysterious. Serif display font
  (Cinzel or IM Fell, OFL, self-hosted), gold→amber gradient, dark OSRS-style drop shadow.
  Letters ignite like embers as the book opens; a rune divider draws in underneath.
  Real `<h2>` for SEO/a11y; any animated copy is decorative (`aria-hidden`).

**Draft copy (user approved the three points; wording is a draft):**

> *RuneLite plugin · Text-to-speech*
> ## Story Mode
> Quests deserve better than a monotone reader. Story Mode gives every NPC a real voice — with
> emotion, pacing and personality — so each dialogue plays like a scene from an audiobook.
>
> - **Integrate ElevenLabs** — connect your ElevenLabs account and quest dialogue is voiced as you play.
> - **Create custom voices** — shape a unique voice for any character, or design your own.
> - **Experience OSRS like never before** — familiar quests, told the way they were always meant to sound.

## Code structure (portfolio pattern — more projects will follow)

- `lib/scene/` — shared Three.js helpers: renderer create/dispose (incl. `forceContextLoss`),
  pause when offscreen / tab hidden (IntersectionObserver + `visibilitychange`), reduced-motion
  flag, DPR/quality cap, lazy start when ~1 viewport away. Move the quasar hero onto it too.
- `components/projects/story-mode/` — `StoryModeSection.tsx` (server: layout + copy) and a
  client scene component that `import()`s the engine inside `useEffect` and returns dispose
  (same pattern as `components/QuasarHero.tsx` + `quasar/mount.js`).
- Engine code (plain JS, browser-only) e.g. `projects/story-mode/` or `quasar/`-style folder.
- `public/projects/story-mode/` — `scene.glb`, `poster.jpg`, fonts.
- `/lab/story-mode` — dev-only tuning route (lil-gui sliders for camera/lights/fog/bloom);
  must not ship in production (guard with `process.env.NODE_ENV` / `notFound()`).

## Assets inventory (`C:\Blender`, device folder `$HOME/mnt/Blender`)

| Character | Source OBJ (`osrs_models/`) | Working blend (parts split) | Pivots | Notes |
|---|---|---|---|---|
| Player avatar (dragon armour) | `Player Dragons Poor ….obj` | `avatar_working.blend` | `pivots.json`, `export/parts.json` | legs split (upper/lower/foot) |
| Wise Old Man | `NPC Wise Old Man ….obj` | `wise_man_working.blend` | `wise_man_pivots.json` | crown separate; skirt+feet one static part; stick deleted |
| Nieve | `NPC Nieve ….obj` | `nieve_working.blend` | `nieve_pivots.json` | cape, spear, hook_L separate |
| Chicken | `NPC Chicken (level-1) ….obj` | `chicken_working.blend` | `chicken_pivots.json` | head, body, 2 wings |
| Sheep | `NPC Sheep ….obj` | — **not split yet** | — | needs head / body / legs split + pivots |

`*_snapshot_before_split.blend` = backups. `export_*/make_parts.py` = the 2D Rive export scripts.

**Important:** the existing pivot JSONs are **2D pixel coordinates** on a 2048² front-orthographic
render (ortho scale 175, camera at y=-400 z=82, model scaled 0.75 and yawed 20°). They are
**not** 3D positions. For 3D, read the part objects in the `*_working.blend` files and derive
pivots in Blender world space (or convert px → units using `px_per_unit` and undo the turn).
Side convention from the 2D work: `_L` = character's left = +X in Blender.

## Phases (stop for approval where marked)

1. **Characters (Blender via MCP).** For each working blend: create an empty per pivot,
   parent parts under them (hierarchy as in `parts.json` → `suggested_hierarchy`), origins at
   the joints, convert OSRS `.mtl` face colours to vertex colours / one palette material,
   apply transforms, consistent scale, feet at origin. Split the **sheep** the same way.
   Export one `scene.glb` (or one per character) → compress with `gltf-transform` (meshopt).
   Budget: < 700 KB total. Save new blends as `*_3d.blend` — don't overwrite existing files.
2. **Book & set.** Tome (covers, page block, clasp, emissive rune mask), runic stone circle, ground.
   → **STOP:** send renders of all characters + book.
3. **Scene prototype on `/lab/story-mode`.** Place depth layers; camera, lighting, fog, DoF,
   bloom, vignette, particles (embers, dust), rune circle glow.
   → **STOP:** stills + short screen recording for look approval.
4. **Animation & interaction.** Code idles for all five, book open on first view, page turn on
   click, hover glance, mouse parallax.
5. **Section in the site.** Grid layout, copy, title reveal synced to book open, mobile stack.
   → **STOP:** user reviews on local dev.
6. **Fallbacks & performance.** Poster for no-WebGL2 / context loss, reduced motion, pause
   offscreen; never render hero and this scene at the same time. Target 60 fps on a mid-range
   laptop, DPR cap ~1.5, bloom at half res. Phone check.
7. **Ship.** `npm run lint`, `npm run build`, deploy to Vercel.

## Notes

- OSRS models are Jagex IP (same situation as the earlier 2D renders); keep in mind if the site goes commercial.
- Keep the original Rive projects (`C:\Rive\Secret Quasar`, `Secret Quasar 2`) untouched.

---

## Phase 1 results (characters)

**Output:** `public/projects/story-mode/characters.glb` — 160 KB (meshopt + quantized), all five
characters, 45 rigid part meshes, one shared material `osrs_palette`. Loads in three r169 with
`GLTFLoader` + `setMeshoptDecoder(MeshoptDecoder)` (from `three/addons/libs/meshopt_decoder.module.js`).

**Blender files** (`C:\Blender`, originals untouched): `avatar_3d.blend`, `wise_old_man_3d.blend`,
`nieve_3d.blend`, `chicken_3d.blend`, `sheep_3d.blend`, plus `story_mode_characters_3d.blend` (all five).
Build scripts + check renders: `C:\Blender\story3d\` (`build.py`, `export.py`, `posetest.py`, `renders/`).
Rebuild: `blender -b <x>_working.blend --python story3d/build.py -- <char>` (sheep: `--factory-startup`),
then `export.py`, then `gltf-transform meshopt characters_raw.glb characters.glb --level medium`.

**Conventions**
- Units: 1 unit = 128 OSRS units (one game tile). Heights: avatar 1.63, Wise Old Man 1.66,
  Nieve 1.54 (2.04 incl. spear), sheep 0.77, chicken 0.59. Original OSRS proportions kept.
- glTF is Y-up; every character **faces +Z**, feet on y = 0, root at the origin (x/z = OSRS tile centre).
- Colours: RuneLite face colours → per-face `COLOR_0` (u8, linear, i.e. the OSRS sRGB colour). No normals
  are exported, so `GLTFLoader` sets `flatShading = true` (faceted OSRS look). If you swap materials,
  keep `vertexColors: true, flatShading: true`.
- Rest pose = the original OSRS pose (the avatar's 2D T-pose was baked back to arms hanging).
  All joints have zero rotation at rest, so idles can write `rotation.x/y/z` directly.
- `_L` = the character's left = **+X** in the character's own frame (same as in Blender; facing +Z with +Y up, left is +X).

**Node names** (`<char>` root → joints → `<char>__<part>__mesh`). Animate the joint nodes, never the
`__mesh` nodes (meshopt quantization put scale/offset on those).
- `avatar`: `torso_base` → `neck`, `shoulder_L/R` → `elbow_*` → `wrist_*`; `hip_L/R` → `knee_*` → `ankle_*`
  (legs hang from the root, not the torso, so torso sway doesn't move the feet).
- `wise_old_man`: static `lower_body` mesh; `torso_base` → `neck` → `crown`; arms as above. Stick removed, right fist empty.
- `nieve`: static `lower_body`; `torso_base` → `cape` (pivot at the cape top, for sway), `neck`,
  arms; `wrist_L` holds `hook_L`; `wrist_R` holds `hand_R` + `spear`.
- `chicken`: `body` → `neck` (head; rotate +x to peck), `wing_L`, `wing_R`.
- `sheep` (newly split): `body` → `neck` (head; rotate +x to graze), and `hip_front_L/R`, `hip_back_L/R`
  (one leg each) on the root.
- Anchors (empties under `neck`): `anchor_eye_L/R`, `anchor_brow_L/R`, `anchor_mouth` (humans),
  `anchor_eye_*` (chicken) and `anchor_overhead` (~12 cm above each head) — the hook for OSRS-style
  yellow overhead text later.

**Known limits:** parts are rigid with small overlaps at the joints (from the 2D split), so large
rotations can show seams — keep idle angles modest. RuneLite colours already contain OSRS's baked
shading, so the scene lighting in Phase 3 should stay fairly soft.

---

## Phase 2 results (book & set)

**Output:** `public/projects/story-mode/scene.glb` — 318 KB, everything in one file: the five characters
(same nodes as above), `book`, `circle`, `ground`. All roots sit at the origin; the layout is done in code.
(`characters.glb` from Phase 1 was deleted.) Blend files: `C:\Blender\book_3d.blend`, `set_3d.blend`,
and `story_mode_scene_3d.blend` (all combined). Scripts: `story3d/book.py`, `set.py`, `compose.py`,
`page_texture.py` (makes `page_atlas.jpg`), `rs_glyph.py` (the angular **RS** monogram used on the
cover rune, the page art and the circle's centre stone — edit it once, rebuild all three).

**Book** (`book`, root = the spine hinge, rest pose = **closed**). Closed size ≈ 0.34 × 0.084 × 0.44;
open ≈ 0.67 wide. Spine along Z, pages toward +X when closed, reader on the +Z side.
- `book__front` (front cover, `book__rune__mesh`, left page block) — opening = `rotation.z = π·u`.
- `book__back` (back cover, right page block, `book__clasp`) — static; a small `rotation.z = +tilt`
  with `front = π·u − tilt` gives the open book a shallow V.
- `book__spine` — `rotation.z = π/2·u` (half the cover angle; keeps the spine bridging the gap).
- `book__clasp` — unlock with `rotation.z` → about −2.9 rad (strap swings under the book).
- `book__page_turn__mesh` — one page, 24 segments across, double-sided, lying on the right page; bend it
  in a vertex shader around the gutter (x = 0) for page turns.
- Materials: `book_leather`, `book_metal` (corners, latch, gilt page edges), `book_paper` / `book_page_turn`
  (`page_atlas.jpg`, left page = u 0–0.5, right page = u 0.5–1), `book_rune_glow` (emissive amber —
  drive `emissiveIntensity` for the rune pulse / unlock flash).

**Circle** (`circle`, radius 0.92, top ≈ 0.055): `circle__dais__mesh` (flagstones), `circle__runes__mesh`
(glowing grooves + 12 glyphs + centre rune, material `set_rune_glow`, cool blue), and five standing stones
`circle__menhir_1…5` at r 1.22, each with a blue glyph facing the centre — move or hide per layout.
**Ground** (`ground`): `ground__mesh` (r 6.5, flat under the circle, uneven outside) + `ground__rocks__mesh`.

**Page text (later):** the pages are a plain texture, so real text can replace the scribbles either by
re-baking `page_atlas.jpg` (same UVs) or — preferred for page turns — by drawing each spread into a
`CanvasTexture` at runtime with the section's display font and assigning it to `book_paper` /
`book_page_turn`. Keep it to a short title + a few lines per page so it stays legible; the real copy stays
in the HTML and the book text is decorative.

---

## Phase 3 results (scene prototype)

Open **http://localhost:3000/lab/story-mode** (`npm run dev`). The route calls `notFound()` when
`NODE_ENV === 'production'`, so it 404s in builds. Frame presets (desktop column + text, mobile, full)
are in the top bar; the lil-gui panel edits every look parameter live and keeps your edits in
localStorage. **Copy params (JSON)** → paste into `projects/story-mode/params.js` (`DEFAULTS`) to make a
look permanent; **Reset** returns to the file's defaults. "Free camera" lets you drag/zoom the view and
writes the result into the camera fields. `window.storyModeLab` exposes `{ engine, params, gui }`.

**Files**
- `lib/scene/index.js` — shared helpers (renderer create/dispose with `forceContextLoss`, DPR cap,
  WebGL2 probe, reduced-motion flag, `observeActivity` (IntersectionObserver + visibilitychange),
  `lazyStart`, `renderSlot` for "only one heavy scene at a time"). The quasar hero is **not** moved
  onto it yet — planned for Phase 6 together with the hero/scene render hand-off.
- `projects/story-mode/` — `mount.js` (entry, returns dispose), `params.js` (look defaults),
  `lab.js` (lil-gui from `three/addons/libs`, no new dependency), `story-mode.css`, and `engine/`:
  `StoryModeEngine.js` (load, lights, loop), `layout.js` (placement, resting poses, materials,
  `setBookOpen`), `post.js`, `particles.js`, `atmosphere.js` (mist layers, fog curtains, env map).
- `components/projects/story-mode/StoryModeScene.tsx` (client wrapper, dynamic import in an effect)
  and `StoryModeLab.tsx`; `app/lab/story-mode/page.tsx`.

**Look recipe:** ACES tone mapping; book = warm point light above the pages + a shadow-casting spot
under the book (light pool + radial character shadows), emissive pages and cover rune; cool blue
rim light from behind-left and blue rune-circle glow; dim hemisphere ambient and a tiny dark-warm
PMREM environment (gives the brass a sheen); exponential fog + four drifting ground-mist layers + two
far fog curtains. Post: scene (HDR, MSAA ×4 on desktop, depth texture) → depth-of-field gather pass
(auto-focus on the book) → particles drawn after DoF with hand-done depth test and their own bokeh →
half-res bloom → tone map → grade (warm highlights / violet shadows, vignette, grain).
Particles: ~150 embers rising from the book and the whole stage, ~280 dust motes that brighten near
the book. Reduced motion: no flicker/grain, particles slow right down.

---

## Phase 4 results (animation & interaction)

New: `engine/idle.js` (idles + book bob), `engine/book.js` (open / page-turn controller),
`overhead.js` (overhead-text hook); sparks added to `engine/particles.js`; engine, mount and lab updated.
Motion settings live in `params.anim` (lab → **Animation** folder, with ▶ Replay opening / Turn page /
Test overhead text buttons).

- **Idles** (offsets on the resting poses, scaled by `anim.idle`): everyone breathes; the Wise Old Man
  gestures with his raised hand and adds an emphasis beat every ~6.5 s; the avatar listens (small nods,
  weight shifts); Nieve's cape moves in the wind while she scans the dark; the chicken looks around, then
  pecks in bursts and flaps now and then; the sheep chews while grazing and lifts its head to look around
  every 6–12 s. The book bobs and sways (`anim.hover`).
- **First view:** when ≥ 50 % of the scene is on screen (once): clasp swings open + rune flare + spark
  burst (0.45 s), then the covers open over `anim.openTime` (2.2 s) while the book light, light pool and
  page glow ramp up. `section[data-book]` = closed → opening → open, and the section receives
  `storymode:open-start` {duration} and `storymode:opened` — Phase 5 syncs the title reveal to these.
- **Page turn** (click the book, or Enter/Space while the scene is focused): the turn page is bent in its
  vertex shader with a curl (`anim.curl`), front = current spread, back = next spread, sparks trail the
  edge; ~1.15 s. Events: `storymode:turn` {from,to}, `storymode:turned` {spread}. Spreads: `book.addSpread(texture)`
  (one texture per spread, left|right page halves) — the hook for real page text later.
- **Hover:** over the book → pointer cursor, brighter light / pages / rune (`storymode:hover`). Anywhere over
  the scene → the Wise Old Man and the avatar glance toward the pointer (`anim.glance`, limited to ±30°/±16°),
  and the camera leans slightly with the pointer (`anim.parallax`). Touch devices: no parallax/glance.
- **Reduced motion:** book starts open, no idles / bob / parallax / glance / flicker / sparks / flashes,
  page turn = 0.6 s crossfade.
- **Voice hook:** `mountStoryMode()` returns dispose with `.say(character, text, ms)` (OSRS-yellow overhead
  text that follows `<char>__anchor_overhead`) and `.engine` (`on('turn' | 'book-click' | …)`,
  `anchorScreen(char)`). Later: on `turn`, play an ElevenLabs clip and `say()` the line for its duration.

---

## Lighting rework (after Phase 4 review)

Problem: the book light sat right above the pages and the pages also glowed, so they blew out to white,
bloomed over the whole book and hid the text and the page turn; turning the light down left the scene
too dark. Fix — the book light and the pages are now separate:
- **Pages are self-lit** (`book.pageBright`): they ignore scene lights and show the parchment at a fixed
  brightness with a soft flicker, shaded only by their own orientation, so text stays readable and the
  curling page reads in 3D.
- **Book light** lights the characters and stones, placed above and slightly toward the camera
  (`book.lightForward`); a soft **halo** card sits *behind* the book (`book.halo*`) for the glow.
- **Bloom threshold 1.45**: only runes, fire, sparks and embers bloom — not the paper.
- More ambient/rim, plus a warm **bounce** light off the stone circle (`light.bounce`).
- **One torch behind the sheep** (`torches.*`, `engine/fire.js`): flickering firelight + embers, rim-lights
  the sheep from the back. Positions are a list, so more torches can be added from the lab/params.
- Tone mapping is selectable (`toneMapping`: ACES default; AgX looked flatter/hazier here).
- Lab localStorage key bumped to `story-mode-lab-params-v2` (older saved lab tweaks are ignored).
