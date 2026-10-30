# Scroll Story (opening + portfolio) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two scroll-driven scenes for the Hebrew makeup site: an opening where a painted-style bouquet grows as she scrolls, and a portfolio where Sanity-hosted photos reveal themselves. Both are fed by a mock `page.sections[]`.

**Architecture:** `index.astro` maps a mock `Page.sections[]` through a section registry to Astro scene components. Each scene owns its own GSAP + ScrollTrigger script. The scenes are self-contained and work in any order. Images are Sanity assets rendered by `<Media>` through `@sanity/image-url`. All colors go through `--role-*` primitives and semantic tokens.

**Tech Stack:** Astro 7 (static), TypeScript 6 strict, Tailwind 4 (CSS-first), GSAP 3 + ScrollTrigger + DrawSVGPlugin, `@sanity/image-url`, `@sanity/client` (seed script only), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-scroll-story-design.md` (parent: `docs/superpowers/specs/2026-09-13-makeup-site-design.md`)

## Global Constraints

- Work on branch `feat/scroll-story`. Never commit to `main` directly.
- Every hard rule in `CLAUDE.md` applies:
  - semantic tokens only, with no hex, font names or magic numbers in components
  - logical properties only (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`)
  - `<Media>`, never `<img>`
  - `import type` for type-only imports
  - no email addresses
  - no binary images committed
  - no `https://` literal under `web/src/` outside `config.ts`
- Palette "A · Plum as the ink": surface `#faf6f3`, ink `#3b2340`, ink-muted `#6e5670`, lilac `#a77aa8`, blush `#e9b3c2`, peach `#f2c6ad`. These values go in `theme-default.css` only.
- Placeholder flower colors (pink, light blue, deep purple roses, chartreuse leaves, plum-black line work) are `--role-flower-*` primitives. They are never literals in SVG attributes or data.
- No `prefers-reduced-motion` handling in scene scripts (Shai's decision). Do not touch the existing rule in the frozen `theme-contract.css`.
- Animate only `transform`, `opacity`, `clip-path` and SVG stroke offsets.
- No CTA or booking button in the opening scene.
- Hebrew copy: feminine second person, no exclamation marks. Placeholder artist name `נועה לוי`, subtitle `איפור כלות וערב`, scroll cue `גללי`.
- Locked aspect ratio for portfolio items: `aspect-portrait` (4/5).
- `npm install`, `npm run dev` and running the seed script are NOT preapproved. Stop and ask Shai before each.
- Only Shai handles the Sanity write token. Claude never reads, prints or asks for its value.

## Review Focus

1. **JS fails or GSAP is blocked.** All content must still be visible. Initial hidden states (`opacity: 0`, undrawn strokes, closed masks) are set by the scene script via `gsap.set`, never in CSS or markup. Pinned by `content visible with JavaScript disabled` (Task 5) and `portfolio visible with JavaScript disabled` (Task 6).
2. **Missing `PUBLIC_SANITY_*` env.** The build must fail with a message naming the variable, never emit broken image URLs. Pinned by a Task 3 step.
3. **Reload mid-page or jump to the bottom.** Scenes must land in their correct, fully revealed state with no stuck half-states. Pinned by `jumping to the bottom leaves the bouquet fully grown` (Task 5).
4. **Slow images.** Each portfolio slot holds its 4/5 box before its image loads, so there is no layout shift. Pinned by `portfolio slots keep 4:5 before images load` (Task 6).
5. **Viewport resize or rotation.** There must be no horizontal overflow after resize. Pinned by `no horizontal overflow after resize` (Task 6).

---

### Task 1: Palette, flower tokens, and the motion-rule update

**Files:**
- Modify: `web/src/styles/theme-default.css`
- Modify: `web/src/styles/theme-contract.css` (ADD roles only, per its header)
- Modify: `web/src/styles/global.css` (the `@source inline(...)` safelist only)
- Modify: `.claude/skills/brand-he/SKILL.md` ("Motion budget" section)
- Modify: `docs/superpowers/specs/2026-09-13-makeup-site-design.md` (only the reduced-motion definition-of-done and QA lines, around lines 382 and 392)
- Modify: `package.json` (root): `test:e2e` → `playwright test tests/wave1 tests/scroll`
- Test: `tests/scroll/theme.spec.ts`

**Interfaces:**
- Produces these Tailwind color utilities:
  - `*-flower-pink`, `*-flower-blue`, `*-flower-purple`, `*-flower-leaf`, `*-flower-line`
  - `*-powder-peach`, `*-powder-lilac`, `*-blush`

  They are usable as `fill-`, `stroke-` and `bg-`. All are safelisted.

- [ ] **Step 1: Create the branch.** Run `git switch -c feat/scroll-story`.
- [ ] **Step 2: Write the failing tests** in `tests/scroll/theme.spec.ts`:
  - `plum ink on shaded white`: on `/`, `getComputedStyle(document.body).color` is `rgb(59, 35, 64)` and `backgroundColor` is `rgb(250, 246, 243)`.
  - `flower tokens resolve`: inject `<svg><path class="fill-flower-pink stroke-flower-line"/></svg>`. Its computed `fill` is not `rgb(0, 0, 0)` and its `stroke` is not `none`.
  - Use the same JS-injection pattern as `tests/wave1/tokens.spec.ts`.
- [ ] **Step 3: Run them and confirm they fail.** Run `npm run test:e2e`. Expected: both new tests FAIL.
- [ ] **Step 4: Set the palette and add the roles.**
  - `theme-default.css`: set the palette values from Global Constraints, add `--role-flower-{pink,blue,purple,leaf,line}`, `--role-powder-{peach,lilac}` and `--role-blush`, and update the file's placeholder comment.
  - `theme-contract.css`: add `--color-flower-pink: var(--role-flower-pink);` and the same for each other role.
  - `global.css`: extend the safelist with `fill-flower-{pink,blue,purple,leaf} stroke-flower-line bg-powder-{peach,lilac} bg-blush`.
- [ ] **Step 5: Update the locked docs.** These edits are authorized by the approved spec §10.
  - brand-he "Motion budget": the scroll story runs the whole page, one scene animates at a time, and only transform, opacity, clip-path and stroke offsets are animated. Delete the reduced-motion sentence.
  - Parent spec: remove "Respects `prefers-reduced-motion`" and "`prefers-reduced-motion`" from the done and QA lines. Leave §7's video-poster line alone.
  - `CLAUDE.md`'s "Definition of done" also says `prefers-reduced-motion` is respected. CLAUDE.md is frozen, so do not edit it. Flag that line to Shai in the final report.
- [ ] **Step 6: Run the tests and confirm they pass.** Run `npm run test:e2e && npm run lint`. Expected: all pass.
- [ ] **Step 7: Commit.** `git commit -m "feat(theme): plum palette and flower tokens; scroll story motion rule"`

### Task 2: Sanity media seed script

**Files:**
- Create: `scripts/seed-media.mjs`
- Modify: `.env.example` (add `SANITY_WRITE_TOKEN=` with comment "local only, Editor token, never commit")
- Modify: root `package.json` (add `@sanity/client` to `devDependencies`, ASK before installing)

**Interfaces:**
- Produces: a JSON array printed to stdout, `[{ "key": string, "assetId": string, "width": number, "height": number }]`. Here `assetId` has the form `image-<hash>-<w>x<h>-<ext>`. Task 4 pastes these into the mock module.

- [ ] **Step 1: Ask Shai to approve installing the package.** Ask: "OK to run `npm install -D @sanity/client`?" Wait for a yes.
- [ ] **Step 2: Write `scripts/seed-media.mjs`.**
  - Load `.env` with `process.loadEnvFile('.env')`.
  - Require `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET` and `SANITY_WRITE_TOKEN`. Exit 1 naming whichever variable is missing.
  - Hold a `const SOURCES = [{ key, url }]` list of 6 freely licensed bridal or makeup stock photos, each sized `w=2000` at the source.
  - For each source: `fetch` it, then `client.assets.upload('image', Buffer, { filename: key })`.
  - Print the Interfaces JSON.
  - Re-running must be harmless. Sanity deduplicates identical files by hash.
  - Origins are allowed here, because the script is outside `web/src/`.
- [ ] **Step 3: Check it without the token.** Run `node scripts/seed-media.mjs` with `SANITY_WRITE_TOKEN` unset, e.g. `SANITY_WRITE_TOKEN= node scripts/seed-media.mjs`. Expected: exit 1 and stderr naming `SANITY_WRITE_TOKEN`. (Claude may run this, because it sends nothing.)
- [ ] **Step 4: Hand over to Shai.**
  - Ask Shai to create the Editor token, put it in `.env`, run `node scripts/seed-media.mjs`, and paste back the printed JSON. The JSON contains no secret.
  - Stop until the JSON is pasted.
- [ ] **Step 5: Commit.**

  ```bash
  git add scripts/seed-media.mjs .env.example package.json package-lock.json
  git commit -m "feat(sanity): stock media seed script"
  ```

  The pre-commit leak guard must pass with no `leak-ok`.

### Task 3: Image URL helper and `<Media>`

**Files:**
- Modify: `web/astro.config.mjs` (set `vite.envDir` to the repo root, so the root `.env` is read)
- Modify: `web/package.json` (add `@sanity/image-url`, ASK before installing)
- Create: `web/src/lib/sanity/types.ts`
- Create: `web/src/lib/sanity/image.ts`
- Create: `web/src/components/media/Media.astro`
- Test: `tests/scroll/media.spec.ts`

**Interfaces:**
- Produces, in `types.ts`:

  ```ts
  export interface SanityImageRef { _type: 'image'; asset: { _ref: string }; hotspot?: { x: number; y: number; width: number; height: number } }
  export type AspectName = 'hero' | 'portrait' | 'editorial' | 'avatar';
  export interface MediaImage { kind: 'image'; alt: string; caption?: string; aspectRatio: AspectName; image: SanityImageRef }
  ```

- Produces, in `image.ts`:
  - `imageSrcSet(ref: SanityImageRef, aspect: AspectName, widths?: number[]): { src: string; srcset: string }`
  - The default widths are `[400, 800, 1200, 1600]`.
  - It uses `.auto('format').fit('crop')`, plus a height derived from the locked ratio.
  - It throws `Error('Missing PUBLIC_SANITY_PROJECT_ID')` or `Error('Missing PUBLIC_SANITY_DATASET')` at import if that variable is unset.
- Produces the `Media.astro` props `{ media: MediaImage; sizes: string; loading?: 'lazy' | 'eager'; class?: string }`.
  - It renders a wrapper carrying `aspect-{media.aspectRatio}` and an `<img>` inside, with `object-cover`, size utilities that fill the wrapper, `decoding="async"`, `alt` and `srcset`.
  - This file is the one allowed `<img>`.
- Consumes: Task 2's asset IDs. Use any one of them in the test fixture page.

- [ ] **Step 1: Ask Shai to approve installing the package.** Ask: "OK to run `npm install -w web @sanity/image-url`?"
- [ ] **Step 2: Write the failing tests** in `tests/scroll/media.spec.ts`, run against `/` once Task 4 exists. Until then, point them at a temporary `web/src/pages/media-test.astro` and delete that page in Task 4.
  - `media renders a sanity srcset`: the first `[data-media] img` has a `srcset` containing `cdn.sanity.io` and at least 4 width descriptors, plus a non-empty `alt`.
  - `media box is locked to its aspect`: the wrapper's width divided by its height is within 0.01 of 0.8 for `portrait`.
- [ ] **Step 3: Run them and confirm they fail.** Run `npm run test:e2e`. Expected: FAIL.
- [ ] **Step 4: Implement** `types.ts`, `image.ts`, `Media.astro` and the `envDir` change, as specified in Interfaces.
- [ ] **Step 5: Check the missing-env failure.** Run `npm run build` with `PUBLIC_SANITY_PROJECT_ID` blanked for that one command. Expected: the build fails and the error names the variable. This is Review Focus 2.
- [ ] **Step 6: Run the tests and confirm they pass.** Run `npm run test:e2e && npm run lint && npm run typecheck`. Expected: PASS.
- [ ] **Step 7: Commit.** `git commit -m "feat(media): sanity image helper and Media component"`

### Task 4: Mock page data, section registry, page assembly

**Files:**
- Create: `web/src/lib/sanity/mock-page.ts`
- Modify: `web/src/lib/sanity/types.ts` (add the section types below)
- Create: `web/src/components/sections/registry.ts`
- Create: `web/src/components/sections/SectionRenderer.astro`
- Modify: `web/src/pages/index.astro`
- Delete: `web/src/pages/media-test.astro`, if Task 3 created it
- Test: `tests/scroll/page.spec.ts`

**Interfaces:**
- Produces these section types, in `types.ts`:

  ```ts
  export type FlowerTone = 'pink' | 'blue' | 'purple' | 'leaf';
  export interface BouquetPiece { _key: string; kind: 'rose' | 'bud' | 'leaf'; tone: FlowerTone; x: number; y: number; scale: number; rotate: number; at: number; image?: SanityImageRef }
  // x,y: percent of the bouquet box (0–100). at: 0–1, the point in the scene's scroll progress where it blooms.
  // image: a future scan of her painting. When absent, the placeholder SVG for `kind` is used.
  export interface HeroSection { _type: 'hero'; _key: string; name: string; subtitle: string; scrollCue?: string; bouquet: BouquetPiece[] }
  export interface PortfolioSection { _type: 'portfolio'; _key: string; title: string; intro?: string; items: MediaImage[] }
  export type PageSection = HeroSection | PortfolioSection;
  export interface Page { sections: PageSection[] }
  ```

- Produces `export const mockPage: Page` in `mock-page.ts`, which holds a hero and then a portfolio.
  - The portfolio has 6 `MediaImage` items using Task 2's asset IDs, with Hebrew `alt` text.
  - The hero has 12–18 bouquet pieces, weighted toward the inline-start side.
  - Its first line is a comment saying it is replaced by a GROQ query later.
- Produces `sectionRegistry: Record<PageSection['_type'], AstroComponentFactory>` in `registry.ts`.
- `SectionRenderer.astro` takes `{ sections: PageSection[] }`.
  - It renders each section via the registry.
  - An unknown `_type` renders nothing and logs `console.warn('Unknown section type', _type)` at build time.
- Consumes: `Hero.astro` (Task 5) and `Portfolio.astro` (Task 6). Create both as stubs rendering only their `<section data-scene="hero|portfolio">` and heading, so this task can be tested alone.

- [ ] **Step 1: Write the failing tests** in `tests/scroll/page.spec.ts`:
  - `sections render in data order`: `[data-scene]` attributes in DOM order equal `['hero', 'portfolio']`.
  - `hero heading is the first h1 and is the artist name`: `h1` text equals `נועה לוי`. The existing `tests/wave1/tokens.spec.ts` `mt-4` test must still pass, so the hero `h1` carries `mt-4`.
  - `no call to action in the opening`: `[data-scene="hero"] a, [data-scene="hero"] button` count is 0.
- [ ] **Step 2: Run them and confirm they fail.** Run `npm run test:e2e`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the types, the mock, the registry, the renderer and the stub scenes. Rewrite `index.astro` as `<RootLayout title="נועה לוי · איפור כלות" description="…"><main><SectionRenderer sections={mockPage.sections} /></main></RootLayout>`. Update its Wave 1 comment, but keep the `mt-4` explanation, now pointing at `Hero.astro`.
- [ ] **Step 4: Run the tests and confirm they pass.** Run `npm run test:e2e && npm run lint && npm run typecheck`. Expected: PASS, including all of `tests/wave1` (the RTL shekel test has no `₪` on the page now, so check it doesn't fail on zero matches).
- [ ] **Step 5: Commit.** `git commit -m "feat(sections): mock page, registry, page assembly"`

### Task 5: Opening scene: growing bouquet

**Files:**
- Modify: `web/package.json` (add `gsap`, ASK before installing)
- Modify: `web/src/components/sections/Hero.astro`
- Create: `web/src/components/sections/bouquet/Bouquet.astro`
- Create: `web/src/components/sections/bouquet/pieces.ts`
- Create: `web/src/lib/motion/gsap.ts`
- Test: `tests/scroll/hero.spec.ts`

**Interfaces:**
- Produces, in `web/src/lib/motion/gsap.ts`: `export { gsap, ScrollTrigger, DrawSVGPlugin }`, registered once. Task 6 reuses it.
- Produces, in `pieces.ts`: `placeholderPath(kind: BouquetPiece['kind']): string[]`, the SVG path data for a one-stroke rose, bud or leaf.
- `Bouquet.astro` props: `{ pieces: BouquetPiece[] }`. It renders one `<svg>`:
  - a `<g data-lines>` of stems, brush curls and dot trails (`stroke-flower-line`, `fill-transparent`)
  - one `<g data-piece data-at={at}>` per piece. Each one carries a placeholder (`fill-flower-{tone}`) or a `<Media>`-style Sanity image when `image` is set.
- Hero DOM hooks: `[data-scene="hero"]`, `[data-bouquet]`, `[data-lines] path`, `[data-piece]`, `[data-powder]`.

- [ ] **Step 1: Ask Shai to approve installing the package.** Ask: "OK to run `npm install -w web gsap`?"
- [ ] **Step 2: Write the failing tests** in `tests/scroll/hero.spec.ts`:
  - `bouquet starts ungrown`: at scroll 0, after load, the first `[data-lines] path` has a computed `stroke-dashoffset` greater than 0, and the last `[data-piece]` has computed opacity below 0.1.
  - `scrolling grows the bouquet`: scroll to the end of the hero pin (`window.scrollTo` to `ScrollTrigger` end, read from `[data-scene="hero"]`'s `data-end`, which the script sets), then wait 500 ms. The first line path's `stroke-dashoffset` is within 1 of 0 and every `[data-piece]` has opacity above 0.9.
  - `jumping to the bottom leaves the bouquet fully grown`: `window.scrollTo(0, document.body.scrollHeight)` then back to the hero end. Same assertions as above.
  - `content visible with JavaScript disabled`: a new context with `javaScriptEnabled: false`. The `h1` is visible and every `[data-piece]` has opacity 1.
- [ ] **Step 3: Run them and confirm they fail.** Run `npm run test:e2e`. Expected: the new tests FAIL.
- [ ] **Step 4: Implement `Hero.astro`.**
  - Mobile-first layout. The name is `font-display`, large, and anchored at `start` near the top with the subtitle under it. The bouquet is absolutely positioned on the lower part. There is a `[data-powder]` haze of 2–3 blurred blobs in `bg-powder-peach` and `bg-powder-lilac`, and a small `גללי` cue.
  - The scene `<script>` imports from `lib/motion/gsap.ts` and calls `gsap.set` for the initial hidden states (Review Focus 1).
  - It builds one timeline with `ScrollTrigger({ trigger: scene, start: 'top top', end: '+=150%', pin: true, scrub: 0.6 })`:
    - the lines draw with `drawSVG: '0%' → '100%'`, staggered
    - each piece goes from scale 0 and opacity 0 to rest at its `at` position on the timeline
    - the powder drifts with a slight translate
  - Write the trigger's end in px to `data-end`.
  - Use logical positioning only.
- [ ] **Step 5: Run the tests and confirm they pass.** Run `npm run test:e2e && npm run lint && npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Take a screenshot to check the style.** Use Playwright at 390×844 at scroll 0, 50% and 100% of the hero. Show the screenshots to Shai and check that the flowers read as one-stroke painted roses with black curls, not clip-art (spec §4). Iterate on `pieces.ts` until they do.
- [ ] **Step 7: Commit.** `git commit -m "feat(hero): scroll-grown bouquet scene"`

### Task 6: Portfolio scene: photo reveal and continuing vine

**Files:**
- Modify: `web/src/components/sections/Portfolio.astro`
- Test: `tests/scroll/portfolio.spec.ts`

**Interfaces:**
- Consumes: `Media.astro` (Task 3), `lib/motion/gsap.ts` (Task 5), and the `PortfolioSection` type (Task 4).
- DOM hooks: `[data-scene="portfolio"]`, `[data-reveal]` (one wrapper per item, around `<Media>`), `[data-vine] path`.

- [ ] **Step 1: Write the failing tests** in `tests/scroll/portfolio.spec.ts`:
  - `photos reveal on scroll`: before the portfolio enters, the first `[data-reveal]` has a computed `clip-path` that is not `none` and not fully open. After scrolling it to the viewport centre and waiting 500 ms, its `clip-path` is fully open (`inset(0%)`, or the chosen mask's open value) and the inner `img`'s scale is within 0.01 of 1.
  - `portfolio slots keep 4:5 before images load`: route `**/cdn.sanity.io/**` to hang, then load `/`. Every `[data-reveal]` has a width-to-height ratio within 0.01 of 0.8.
  - `portfolio visible with JavaScript disabled`: every `[data-reveal]` `clip-path` is `none`.
  - `no horizontal overflow after resize`: `setViewportSize(390×844)`, then `(844×390)`, then back. After each, `document.documentElement.scrollWidth <= clientWidth`.
- [ ] **Step 2: Run them and confirm they fail.** Run `npm run test:e2e`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement `Portfolio.astro`.**
  - The title is `font-display`, aligned to `start`.
  - Items sit in a single column on mobile and an offset two-column layout from `md:`, not a uniform grid (brand-he banned defaults).
  - Each `[data-reveal]` has an arch or petal `clip-path` that opens with scroll (`scrub`, start `top 85%`, end `center center`) while its image goes from scale 1.1 to 1.
  - Use `<Media sizes="(min-width: 768px) 45vw, 90vw" loading="lazy">`.
  - A `[data-vine]` SVG runs along the inline-end edge, drawn with `drawSVG` across the whole scene. It blooms 2–3 placeholder pieces, reusing `placeholderPath` and the flower tones, so it reads as the hero's bouquet continuing.
  - Initial states are set with `gsap.set` only.
  - Call `ScrollTrigger.refresh()` on `resize` debounced 150 ms. The default config handles this, so only add it if the resize test fails.
- [ ] **Step 4: Run the tests and confirm they pass.** Run `npm run test:e2e && npm run lint && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(portfolio): scroll photo reveal and continuing vine"`

### Task 7: Whole-branch verification and hand-off

**Files:** none new.

- [ ] **Step 1: Run every check.** Run `npm run lint && npm run typecheck && npm run build && npm run test:e2e`. Expected: all pass across the mobile, tablet and desktop projects.
- [ ] **Step 2: Check performance on a phone profile.** Use Playwright with mobile emulation at 390×844 and 4× CPU throttle via a CDP `Emulation.setCPUThrottlingRate` trace. Scroll through both scenes and record a performance trace. Report long tasks over 50 ms during scroll and the JS bytes shipped (`web/dist/_astro/*.js`). Nothing is gated on these numbers. Report them to Shai.
- [ ] **Step 3: Send screenshots to Shai** of the hero at 0%, 50% and 100%, and the portfolio mid-reveal, at 390×844 and 1440×900.
- [ ] **Step 4: Report to Shai.** Include:
  - the `CLAUDE.md` "Definition of done" reduced-motion line, which is frozen and still says it is respected, as a decision for Shai
  - running `npm run dev`, if Shai wants to see it on their own machine, after asking
