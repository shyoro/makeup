---
name: brand-he
description: Use when writing any component, style, or Hebrew copy for the makeup-artist site — the single source of truth for RTL rules, the token vocabulary, locked aspect ratios, motion budget, and Hebrew copy voice.
---

# brand-he

The one design contract for this project. Every agent reads this before writing
a component. If this file and your instinct disagree, this file wins.

## Hebrew and RTL

- `lang="he"`, `dir="rtl"` on `<html>`. Set once in `RootLayout.astro`.
- **Logical properties only.** `ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-`,
  `border-s`/`border-e`, `text-start`/`text-end`. Never `pl-`/`pr-`, `ml-`/`mr-`,
  `left-`/`right-`, `text-left`/`text-right`. **Unenforced** — checked
  `eslint.config.js` and both guards in `scripts/lint-guards.sh`: neither
  contains a rule about physical vs logical direction. (Guard 2's check 2c
  lists `ml|mr|pl|pr|left|right` among its prefixes, but only to catch an
  arbitrary spacing value like `pl-[13px]`; `pl-4` passes.) Nothing will fail
  if you write the physical form; review is the only backstop.
- Icons that imply direction (arrows, chevrons) must mirror. Decorative and
  brand marks must not. **Unenforced** — no ESLint rule, guard pattern, or
  test checks this; it is a manual review item.
- **Mixed-direction content — numerals, prices, phone numbers.** Wrap the
  whole run in a single `<span dir="ltr">`, and the shekel sign `₪` and its
  digits MUST share that same wrapper, per Hebrew convention `450 ₪`:
  `<span dir="ltr">450 ₪</span>`. Two adjacent isolates —
  `<span dir="ltr">450</span> ₪` or
  `<span dir="ltr">450</span><span dir="ltr">₪</span>` — is a failure, not a
  variant: the sign can still reorder away from its digits in RTL flow even
  though each piece is individually wrapped. `web/src/pages/index.astro` is
  the frozen Wave 1 example of the correct form (`<span dir="ltr">450
  ₪</span>`). `tests/wave1/rtl.spec.ts` enforces the CO-LOCATION
  half of this today — its "every shekel sign shares a dir="ltr" wrapper with
  its digits" test walks every text node containing `₪` and asserts its
  nearest `[dir="ltr"]` ancestor's text also contains a digit. It does NOT
  check the ordering: `₪450` passes the test and is still wrong, so the
  `450 ₪` convention is a review item. Two consequences to know before you
  write markup: a `dir="ltr"` on a CONTAINER rather than the inline run will
  satisfy the test while leaving the sign detached from its number, and a
  digit-free `₪` (a `מחיר (₪)` table header, or prose like `כל המחירים ב₪`)
  FAILS the test even though it is bidi-correct — put such a label outside an
  ltr wrapper, or raise it rather than adding an exemption. The test also
  covers plus the surrounding contract (Hebrew
  `lang`/`dir` on `<html>`, the intended display face actually loaded via
  `document.fonts.check()` rather than just declared, text anchored to the
  right edge, no horizontal overflow at any locked viewport). Still verify
  visually regardless: the DOM can look correct while the rendering is
  wrong.
- Numerals are Western Arabic (0–9).
- No `text-transform: uppercase` — Hebrew has no case, and it breaks nothing
  visibly while signalling that nobody checked. **Unenforced** — checked
  `eslint.config.js` and both guards in `scripts/lint-guards.sh`: neither
  contains a pattern for `uppercase` or `text-transform`. Nothing will fail
  if you write it; review is the only backstop.

## Token vocabulary — the only colors and fonts you may name

Colors (from `web/src/styles/theme-contract.css`): `surface`,
`surface-raised`, `ink`, `ink-muted`, `accent`, `on-accent`, `hairline`, plus
the two non-semantic escapes the contract also defines, `transparent`
(`--color-transparent`) and `current` (`--color-current`, i.e.
`currentColor`). Used as `bg-surface`, `text-ink`, `border-hairline`,
`bg-transparent`, `text-current`, etc. — `bg-transparent`/`text-current` are
available; don't add a redundant token to the frozen contract file for
either.

Type roles: `font-display`, `font-ui`.

Radius: `rounded-card` (`--radius-card`). Section rhythm: `py-section`
(`--spacing-section`).

**A raw hex value or a `font-family` name in a component is a bug — but
Tailwind will not stop you from writing one.** `theme-contract.css` clears
Tailwind's `--color-*`/`--font-*` namespaces, which removes the convenient
path to a raw value, not the escape hatch: `bg-[#f00]`, `p-[13px]`,
`font-[Comic_Sans]`, the bare arbitrary-property form `class="[color:red]"`,
and inline `style="color:#f00"` all still compile. What actually blocks these
is `scripts/lint-guards.sh` together with `eslint.config.js`, both run by
`npm run lint`. See `CLAUDE.md` hard rule 4 for the guard's known gaps
(bare-arbitrary-property spacing, multi-line `style=`, `.svg`/`.json`/`.vue`
files) before assuming a clean lint run means total coverage. If you need a
role that does not exist, add it to `theme-contract.css` as a new semantic
token backed by a new `--role-*` primitive. Never inline the value.

## Fonts

Four families are self-hosted via Fontsource (`web/src/styles/fonts.css`),
each at weights 400 and 700, with separate Hebrew and Latin subsets so mixed
Hebrew/Latin runs (prices, phone numbers, brand names) don't fall back to a
second, unstyled typeface: **Assistant**, **Frank Ruhl Libre**, **Heebo**,
**Noto Serif Hebrew**. `font-ui` maps to Assistant. `font-display` currently
resolves to Frank Ruhl Libre, but the final display face is still the
client's open decision among Frank Ruhl Libre, Heebo, and Noto Serif Hebrew —
do not treat the current choice as locked. Only weights 400/700 exist for any
of these four; a future request for a 500/600 display weight needs a
`@fontsource-variable/*` package, not more static files.

## Breakpoints — two, and only two

Base `0–767px`, unprefixed, and it is the **primary** target. `md:` at 48rem
(768px). `lg:` at 80rem (1280px). Both are locked in `theme-contract.css`,
which clears Tailwind's default breakpoint scale (`sm`/`md`/`lg`/`xl`/`2xl`)
first. Tailwind's other defaults do not exist. Design the mobile composition
first and scale up.

These are CSS breakpoints, not the same thing as the three **locked test
viewports** `playwright.config.ts` defines for `npm run test:e2e`: mobile
390×844 (primary, runs first), tablet 820×1180, desktop 1440×900. A
breakpoint is where your styles change; a locked viewport is a fixed size
the RTL/token tests actually render at. "No horizontal overflow at any
locked viewport" (above, and in `tests/wave1/rtl.spec.ts`) means those three
sizes specifically.

## Locked aspect ratios

`aspect-hero` 16 / 9 · `aspect-portrait` 4 / 5 · `aspect-editorial` 3 / 2 ·
`aspect-avatar` 1 / 1 (from `theme-contract.css`).

Every media slot declares one of these in CSS. Never take a ratio from the
asset — that is what makes CLS ≈ 0. Changing these means the client re-crops
her whole library, so treat them as immovable.

## Type scale

The scale must hold for all three display-face candidates (Frank Ruhl Libre,
Heebo, Noto Serif Hebrew), because the face may still change at Gate A.
Hebrew has no ascenders or descenders in the Latin sense and a large
x-height, so it tolerates tighter line-height than Latin at display sizes and
needs looser line-height at body sizes. Start body at `leading-relaxed` and
verify with real Hebrew, never lorem. Express any new scale step as a named
Tailwind utility or a token added to `theme-contract.css` — never as a
copy-pasteable arbitrary value like `text-[13px]` or `tracking-[0.05em]`;
those are exactly the shapes `scripts/lint-guards.sh` blocks (see CLAUDE.md
hard rule 4), and the utilities for a new scale step belong in the theme
layer, not inline in a component.

## Motion budget

One orchestrated motion moment on the page, not per section. Everything else is
a state transition under 200ms. `prefers-reduced-motion` is honoured globally by
`theme-contract.css`; do not add animation that escapes it, and never animate a
property that triggers layout.

## Copy voice — Hebrew

Sentence case. Active voice. Second person singular feminine when addressing
the visitor, since the audience is overwhelmingly women — `תבחרי`, not `בחר`.
Short sentences. No exclamation marks. No English loanwords where a natural
Hebrew word exists. Never invent a price, a policy, or an availability claim:
those come from Sanity.

## Banned defaults

Per the `frontend-design` skill, and specifically for this project, since there
is no budget for a distinctive licensed typeface, distinctiveness has to come
from layout, scale, contrast and color. That raises the bar on avoiding:

- Purple/indigo-on-white as an accent. It is the house style of AI-generated
  design.
- Centred everything. Hebrew editorial layout has a strong right edge — use it.
- Uniform card grids with equal-weight items and identical rounded corners.
- Generic drop shadows as the only depth cue.
- Full-width hero with centred headline and two pill buttons.
- `text-gray-500` as the answer to every secondary text need.
- Emoji as iconography.
- Gradient text.

**Unenforced.** None of the eight items above has an ESLint rule, a guard
pattern in `scripts/lint-guards.sh`, or a test — checked both files. This
whole list is a manual review item, not a machine-checked one; a clean
`npm run lint` says nothing about it.

## Accessibility

Contrast must pass AA under **every** theme file, not just the default. Focus
states are visible and token-driven, never `outline: none`. Focus order must
follow the visual RTL order. All images carry meaningful Hebrew `alt`;
decorative images carry `alt=""`.
