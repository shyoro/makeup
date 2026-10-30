# Design: scroll story, first pass (opening and portfolio)

**Date:** 2026-10-30
**Status:** Approved by Shai, 2026-10-30
**Parent spec:** `docs/superpowers/specs/2026-09-13-makeup-site-design.md`

---

## 1. Intent

The page should feel like a wedding and like luxury before it sells anything.
A bride arrives from Instagram on her phone and sees a hand-painted bouquet grow
up the screen as she scrolls. Photos of the artist's work then uncover
themselves. The flowers are what makes the page hers, because the artist paints
flowers in this style on paper and on faces.

This is a **first pass**. It covers two scenes, the opening and the portfolio, so
Shai can judge the feel on a real phone before the remaining scenes are
designed. Keep it simple. Shai asked for this explicitly.

## 2. Goals

- **Opening scene.** A cream / shaded-white screen. Her name sits large at the
  top right, in Hebrew, with the subtitle `איפור כלות וערב`. As she scrolls, a
  bouquet grows up from the bottom edge:
  - the black brush curls and stems draw themselves stroke by stroke
  - the roses and leaves open (scale and fade in) when their stem reaches them
  - a soft haze of peach and lilac powder drifts behind the bouquet

  There is no booking button or call to action on the first screen, and a
  small `גללי` cue is the only prompt.
- **Portfolio scene.** Photos of her work uncover themselves as she scrolls, for
  example through a petal or arch shaped mask that opens, with a slight zoom
  settling to rest, as in the reference below. The flowers carry on as a vine
  along one edge of the screen, so the two scenes feel like one continuous
  story.
- **The scroll story runs the whole page** (Shai's decision). Later scenes will
  follow the same pattern. Only one scene animates at a time.
- **Wow factor and smoothness on phones** take priority over minimal JS.
- **Content-ready.** All Hebrew text and photos come from one mock data module.
  It has the same shape as the future Sanity `page.sections[]` (parent spec §8),
  so switching to Sanity means swapping the data source and touching no
  components.
- **Easy to change.** Colors, fonts, spacing and radii go through the token
  contract (CLAUDE.md hard rule 4). A palette or font change is a theme-file
  edit, not a component edit.

## 3. Non-goals for this pass

- Scenes other than opening and portfolio: services, pricing, about, reviews,
  contact.
- Sanity schemas, Studio, and text content in Sanity. Only **images** move to
  Sanity in this pass (§8a). Text stays in the mock module.
- Booking (Cal.com), the chat bot, the contact form, and SEO.
- Choosing the final display font. Frank Ruhl Libre stays as is.
- Her real flower artwork. Placeholders are used until she supplies scans
  (§6).

## 4. Anti-goals: it fails even if it works when…

- It looks like a generic AI site: purple buttons on white, centred hero, two
  pill buttons, gradient text (brand-he "Banned defaults").
- The flowers look like clip-art circles on sticks. They must read as her
  painted one-stroke style (§6).
- It stutters or jumps on a mid-range phone. Animate only `transform`,
  `opacity`, `clip-path` / masks and SVG stroke offsets, never layout
  properties.
- Photos cause layout shift. Every slot gets a locked aspect ratio from CSS
  (brand-he).

## 5. Visual direction, as decided

**Palette "A · Plum as the ink"** (chosen by Shai from three options):

| Role | Approximate value | Use |
|---|---|---|
| surface | warm shaded white `#faf6f3` | page background |
| ink | very dark plum `#3b2340` | text, the "black" of the brush curls may also use this |
| ink-muted | muted plum `#6e5670` | secondary text |
| accent | dark plum (same family as ink) | rare: links, focus |
| powder / soft accents | dusty lilac `#a77aa8`, blush `#e9b3c2`, peach `#f2c6ad` | the powder haze and background washes only |

These hex values are mockup values. They go into `theme-default.css` as
`--role-*` primitives, never into components. Any new role, such as a powder or
blush color, is added to `theme-contract.css` as
`--color-x: var(--role-x)`, which is allowed by that file's header. Purple
never appears as a bright button color.

**Flowers keep the artist's own painted colors** (from the reference painting
Shai shared, which is not in the repo):
- one-stroke roses in pink, light blue and deep purple
- chartreuse / yellow-green leaves
- black calligraphic brush curls, feathery purple strokes and trailing dots, on
  cream

The flower colors belong to the artwork, not to the page palette.

**Composition:** mobile first (390×844 primary). Strong right edge for type,
since Hebrew reads from the right. The bouquet sits weighted toward one side
rather than centred.

## 6. Flowers: placeholder now, her artwork later

- **Now:** the builder creates placeholder art in her style. Each flower or leaf
  is a separately animatable piece. The curls and stems are SVG paths that can
  be stroke-drawn. The roses and leaves can be SVG or drawn raster pieces.
- **Later:** she paints the pieces on paper and they are scanned and cut out.
  They are uploaded to Sanity, never committed: the repo is public and the
  pre-commit hook blocks binary images. The bouquet component must therefore
  accept its rose and leaf pieces as data, meaning Sanity image asset IDs plus position,
  scale and timing. Swapping placeholders for scans is then a data change.
- The curl and stem line work stays SVG in code either way. It is what gets
  "drawn" by the scroll.

## 7. How it's built (decided)

- **Animation: GSAP + ScrollTrigger** (Shai's call: use a library if it gives
  smoother, GPU-backed motion and more wow). The GSAP DrawSVG plugin is used for
  the stroke-drawing, since GSAP and its plugins are free. Scenes can be pinned
  and scrubbed with scroll. GSAP is loaded as a client-side script inside the
  Astro components that need it, so pages with no scenes ship no GSAP.
- **No reduced-motion mode** (Shai's decision). The scenes do not check
  `prefers-reduced-motion`. GSAP is JS-driven, so the global CSS rule in
  `theme-contract.css` does not affect it. That rule stays untouched, since the
  file is frozen. The brand-he "Motion budget" section and the parent spec's
  definition-of-done lines about reduced motion must be updated to match this
  decision, and only after Shai approves this document. Both are frozen Wave 1
  files, so this approval is what authorizes that edit.
- **Smoothness:** animate transforms and opacity only. Use `will-change`
  sparingly, only on pinned layers. Lazy-load portfolio photos. Avoid
  JS-on-every-scroll-event code outside GSAP.
- **Astro stays `output: 'static'`.** No server, no new paid service.
- **Images:** go through `<Media>` (hard rule 5) with a locked aspect ratio
  (`aspect-portrait` 4/5 for portfolio). If `<Media>` does not exist yet, the
  builder creates a minimal image-only version in
  `web/src/components/media/`, following parent spec §7's contract.

## 8. Content shape (mock)

One mock data module mirrors Sanity's `page.sections[]`: an ordered array of
typed section objects, `{ _type: 'hero' | 'portfolio', ... }`. The page renders
by mapping that array through a small section-type registry, as in parent spec
§11's Wave 4 note. Each scene works on its own and does not depend on the scene
before it, because she will reorder sections in Studio.

- **Hero:** name, subtitle, optional scroll-cue text, bouquet piece list (§6).
- **Portfolio:** title, list of `media` objects (`kind: 'image'`, `alt` in Hebrew,
  Sanity asset ID, aspect ratio).

Mock Hebrew copy follows brand-he's voice: feminine second person, no
exclamation marks. Use a clearly fake artist name such as `נועה לוי` until the
real one is supplied.

## 8a. Images live in Sanity from the start (Shai's decision)

Stock photos, and any raster flower placeholders, are hosted as Sanity image
assets now, where her real photos and scans will live later. Nothing binary is
committed, and no web address is hardcoded in `web/src/` (Guard 1).

- **Shai does first, by hand.** This is a guardrail: Claude does not create
  accounts or handle tokens.
  1. Create a free Sanity account and project.
  2. Create a `production` dataset with public read.
  3. Fill in `PUBLIC_SANITY_PROJECT_ID` and `PUBLIC_SANITY_DATASET` in `.env`.
     Both names already exist in `.env.example`.
  4. Create an API token with Editor rights and put it in `.env` as
     `SANITY_WRITE_TOKEN`, which is local only and never committed. The builder
     adds that name, with an empty value, to `.env.example`.
- **Upload script.** Use a small one-off script outside `web/src/`, for example
  `scripts/seed-media`. It takes a list of freely licensed stock photo
  addresses, uploads each one to Sanity with `@sanity/client`, and prints the
  resulting asset IDs. Shai runs it; Claude never sees the token.
- **The mock module stores only Sanity asset IDs, plus Hebrew `alt` and the
  aspect ratio.** `<Media>` builds the image addresses from the asset ID with
  `@sanity/image-url`, using the project ID and dataset from env. It supports
  responsive sizes, AVIF/WebP and hotspot cropping, per the parent spec §7.
  The address is assembled by the library, so no origin is written in our
  code.
- **New packages:** `gsap`, `@sanity/client` (script only), and
  `@sanity/image-url` (web). Installing them needs Shai's OK, since
  `npm install` isn't preapproved.

## 9. Constraints that still apply

All of CLAUDE.md's hard rules apply, especially:
- semantic tokens only
- logical properties only
- `<Media>`, never `<img>`
- `import type`
- no email addresses
- no binary images committed

The definition of done stands, except for the reduced-motion line (§7). It
requires `npm run lint`, `typecheck`, `build` and `test:e2e` to pass,
including no horizontal overflow at 390 / 820 / 1440 and the RTL tests.

## 10. Calls made while writing this (Claude's, check them)

- **One builder, one branch, one design pass.** The wave and agent split from
  the parent spec doesn't apply to this pass. The builder may edit:
  - `web/src/styles/theme-default.css`
  - add roles to `theme-contract.css`, and add their utility names to the
    `@source inline(...)` safelist in `global.css`
  - `web/src/components/{media,sections}/`
  - `web/src/lib/sanity/` for the mock module, which the real Sanity query
    later replaces
  - `web/src/pages/index.astro`

  The `h1` with `mt-4` that `tests/wave1/tokens.spec.ts` depends on must stay
  on `/`. The hero heading can carry it.
- **Placeholder flower colors are tokens.** They are `--role-flower-*`
  primitives in `theme-default.css`, mapped through new roles in
  `theme-contract.css`. They never appear as literals in SVG `fill=`
  attributes or in data. They only matter until her scans, which carry their own
  colors as raster images, replace the placeholders.
- **Frozen-file edits after approval:**
  - brand-he "Motion budget": replace "one orchestrated motion moment" with
    "the scroll story runs the whole page, one scene animating at a time;
    transform/opacity only", and drop the reduced-motion requirement.
  - The parent spec's definition-of-done and QA lines about reduced motion get
    the same change.
  - The parent spec's §7 video-poster fallback is out of scope and stays.
- **Reviewing on a phone:** local only in this pass. Use Playwright screenshots
  at 390×844, plus the dev server on Shai's machine. There is no deploy or
  public URL. `npm run dev` and `npm install gsap` are not preapproved, so the
  builder asks Shai before running either.

## 11. Left to the builder

- Exact choreography: scroll distances, pin lengths, easing, the order the
  flowers bloom in, and the shape of the photo mask.
- How the placeholder flowers are drawn, as long as they read as her style
  (§4, §6).
- Component and file breakdown within the paths listed in CLAUDE.md's
  ownership table.
- How many portfolio photos (suggest 4–6) and which stock photos (bridal and
  makeup themed, freely licensed).
