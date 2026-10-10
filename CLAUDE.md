# CLAUDE.md — Hebrew makeup-artist site

Read `.claude/skills/brand-he/SKILL.md` before writing any component.
Spec: `docs/superpowers/specs/2026-09-13-makeup-site-design.md`.

## Stack

Astro `^7.3.2`, `output: 'static'` (`web/astro.config.mjs`). TypeScript
`^6.0.3` in strict mode. Tailwind `^4.3.3` via `@tailwindcss/vite` —
CSS-first config, there is no `tailwind.config.js`. Sanity for content and
media. Cloudflare Workers for static assets and two API routes. Gemini Flash
for the FAQ bot. npm workspaces: `web/`, `worker/`, `studio/` (see root
`package.json`). Versions above are copied from `web/package.json`; do not
assume a different major.

## Hard rules

1. **The site has no server.** Anything the Astro app knows is public. Keys
   live only in `.env` (local, gitignored) and Worker secrets. Never in
   `web/`.
2. **This repo is public and permanent.** No email address, no API key, no
   client photography may ever be committed. The `.githooks/pre-commit` leak
   guard blocks all of these (secret-shaped strings, every email address,
   generic credential assignments, staged binary image files). Two narrow,
   documented escape hatches exist — read the hook's own comments before
   using either:
   - **`leak-ok`**, appended to a content line, exempts that line from the
     content-pattern scan. It has no allowlist of legitimate cases in the
     hook itself; use it only for a genuine false positive, and expect the
     exemption to be echoed to stderr as `leak-ok exemption: ...` so the
     bypass stays visible.
   - **`ALLOW_BINARY=1`**, set for a single commit, is the only way to stage
     a binary image file (the guard's own comment names "a favicon" as the
     legitimate case). It cannot be scoped to one file or line — it applies
     to the whole commit.
   For anything else the guard blocks — and for `scripts/lint-guards.sh`,
   whose `guard-ok` marker is shared by BOTH its guards (origins, hard rule
   3, and the token contract, hard rule 4) — move the value or fix the code;
   do not add an exemption without asking first.
3. **`SITE_URL` is defined once**, in `web/src/config.ts`, alongside
   `NOINDEX` (true while the site lives on the temporary `workers.dev`
   origin) and `absoluteUrl()`. Build absolute URLs with `absoluteUrl()`. No
   hardcoded origins anywhere else. This is only PARTIALLY machine-enforced,
   and the enforcement does not reach every workspace: `eslint.config.js`'s
   `no-restricted-syntax` rule scopes to `files: ['web/src/**/*.{ts,astro}']`,
   and Guard 1 in `scripts/lint-guards.sh` sets `SRC` to `web/src` by
   default. Both run under `npm run lint`, and both cover `web/src/` only —
   `worker/` and `studio/` have no equivalent check. `web/src/config.ts`
   itself documents that the Worker's CORS allowlist derives from
   `SITE_URL`, which makes `worker-agent` the most likely place this rule
   gets violated with a clean `npm run lint`. Treat this rule as
   review-enforced outside `web/src/`.
4. **Semantic tokens only — and Tailwind does not enforce this by itself.**
   No raw hex, no `font-family` name, no magic spacing number in any
   component. Clearing Tailwind's `--color-*`/`--font-*`/`--breakpoint-*`
   namespaces in `web/src/styles/theme-contract.css` removes the
   *convenient* path to a raw value, not the escape hatch: arbitrary-value
   utilities (`bg-[#f00]`, `p-[13px]`, `font-[Comic_Sans]`), Tailwind's bare
   arbitrary-property syntax (`class="[color:red]"`), and inline `style=`
   all still work and all bypass the token contract. What actually catches
   these is `scripts/lint-guards.sh` plus `eslint.config.js`, both run by
   `npm run lint` — that is the real enforcement, not the framework. If a
   role does not exist, add it to `theme-contract.css` as a new semantic
   token whose value is a `var(--role-*)` indirection to a primitive
   supplied by `theme-*.css` — never a literal value, per
   `theme-contract.css`'s own binding comment on itself. Never inline the
   value.
   - The guard has known gaps: it does not catch magic spacing written as a
     bare arbitrary property (`class="[padding:13px]"` — only
     colour-bearing properties, `font-family`, and custom properties are
     checked in that form), it does not reliably see a `style=` attribute
     split across multiple lines (its scan is line-based), and it does not
     scan `.svg`, `.json`, or `.vue` files at all (only `.astro`, `.ts`,
     `.tsx`, `.jsx`, `.js`, `.mjs`, plus `.css`/`.md`/`.mdx` depending on
     the guard). Colour and font values ARE covered in every syntax form
     the guard does scan. A clean `npm run lint` is not proof of total
     coverage — read the gaps above before trusting it further than that.
   - One documented legitimate exemption exists: a JSON-LD block's
     `"@context": "https://schema.org"` IS a hardcoded origin and the guard
     is right to block it (this is Guard 1, hard rule 3's guard, not Guard
     2, but the exemption mechanism is shared) — its own failure message
     says to append `guard-ok` to that exact line rather than treating the
     block as a bug. `seo-agent` will write this line; do not "fix" it by
     moving `schema.org` into the frozen `web/src/config.ts` instead. Any
     other `guard-ok`/`leak-ok` use needs a human first (see hard rule 2).
5. **Use `<Media>`, never a raw `<img>`.** Every consumer supplies an
   explicit aspect ratio from CSS, never from the asset.
6. **Logical properties only.** `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`.
   Never `pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`. **Unenforced** — checked
   `eslint.config.js` and both guards in `scripts/lint-guards.sh`: neither
   contains a rule about physical vs logical direction. (Guard 2's check 2c
   does list `ml|mr|pl|pr|left|right` among its prefixes, but only to catch
   an arbitrary spacing value like `pl-[13px]`; `pl-4` passes.) A clean `npm
   run lint` does not mean this rule was followed; it is a manual review
   item.
7. **Mobile first.** Base styles target 0–767px. Only `md:` (768px) and
   `lg:` (1280px) exist as breakpoints — Tailwind's other defaults are
   cleared in `theme-contract.css`. These breakpoints are a different thing
   from the three viewports `playwright.config.ts` locks for `npm run
   test:e2e` — 390×844 (`mobile`, the primary target and the project that
   runs first), 820×1180 (`tablet`), 1440×900 (`desktop`). Do not confuse
   the two: a breakpoint is a CSS `@theme` value your components style
   against; a locked viewport is a fixed size Playwright renders at to
   verify no horizontal overflow and correct layout at each size.
8. **No `localStorage` or `sessionStorage`** in components. Enforced by
   `eslint.config.js`'s `no-restricted-globals`/`no-restricted-properties`
   rules under `npm run lint` — but that block carries the same
   `files: ['web/src/**/*.{ts,astro}']` scope as hard rule 3, so `worker/`
   and `studio/` are not covered, and nor are `.tsx`/`.js` files under
   `web/src`.
9. **Free tier only.** No paid service, no paid font.
10. **`verbatimModuleSyntax` is on** (`web/tsconfig.json`, via
    `astro/tsconfigs/strict`). A type-only import MUST be written
    `import type { X } from '...'`. A plain `import { SomeType } from '...'`
    where `SomeType` is only a type fails the build. This is the single
    most likely thing to break a Wave 2 agent's first commit — check every
    import of a type, interface, or Astro `Props` type.

## Ownership — an agent edits only its own paths

```
CLAUDE.md                             → Wave 1, FROZEN
.claude/skills/brand-he/              → Wave 1, FROZEN
web/src/styles/theme-contract.css     → Wave 1, FROZEN (add roles only)
web/src/config.ts                     → Wave 1, FROZEN (values change in Phase 7)
web/src/styles/ (except theme-contract.css, which is frozen above)
                                      → design-system-agent
web/src/components/primitives/        → design-system-agent
web/src/components/media/             → media-agent
web/src/lib/media/                    → media-agent
web/src/components/sections/          → sections-agent
web/src/components/integrations/      → integrations-agent
web/src/lib/sanity/                   → sanity-agent
web/src/lib/seo/                      → seo-agent
studio/                               → sanity-agent
worker/                               → worker-agent
tests/ (except wave1/, hooks/, lint/) → qa-agent
web/src/pages/index.astro             → assembly-agent ONLY, from Wave 4
wrangler.toml / deploy config         → deploy-agent
```

Agents in the same wave must never share a file.

`web/src/styles/global.css`'s import order is load-bearing:
`theme-contract.css` must stay LAST (after Tailwind, `fonts.css`, and
whichever `theme-*.css` is active) — `@theme inline` resolves each
`var(--role-*)` reference at use time, so importing `theme-contract.css`
before the theme file that defines its primitives breaks the resolution.
`design-system-agent` owns all of `web/src/styles/` except the frozen
`theme-contract.css`, so the swap and this ordering are both its job; both `global.css` and
`theme-contract.css` document the constraint on themselves too.

## Definition of done

Runnable today: `npm run lint` passes (ESLint + `scripts/lint-guards.sh` +
Prettier). `npm run typecheck` passes. `npm run build` passes. `npm run
test:e2e` passes — this is the only check on the RTL and token contracts
(`tests/wave1/`) and it is preapproved in `.claude/settings.json`.
`prefers-reduced-motion` respected. Mobile renders correctly before desktop
is considered.

Not runnable yet: "axe reports no violations" has no implementation
anywhere in this repo today — checked `package.json` (root and every
workspace), `playwright.config.ts`, and `tests/`: `axe` appears in none of
them, and no install command for it is preapproved. Do not claim this check
as done; it arrives with Wave 5's `qa-agent`.

## Guardrails

You may navigate, read, screenshot and verify. **Stop and hand back to Shai**
for: creating accounts, signing in, entering any password or key, entering
payment details, accepting terms, changing account settings, adding DNS
records, granting OAuth scopes, and clicking publish/submit/delete on
anything irreversible. Surface the exact values needed, then wait.

## Docs and CLI access

The Sanity and Cloudflare MCP servers are unavailable. Checked
`.claude/settings.json` directly: it allowlists exactly seven `npm run`
scripts — `build`, `typecheck`, `lint`, `test:hooks`, `test:lint-guards`,
`test:wave1`, `test:e2e` — plus read-only `git` commands. `npm run dev` and
`npm run format` are NOT allowlisted despite existing in `package.json`.
There are **no `npx` entries at all**, and none should be added. `npx`
fetches a package from the npm registry and executes it; neither `wrangler`
nor a Sanity CLI package is installed in this repo's `node_modules`
(checked: not in the root, `web/`, `worker/`, or `studio/` workspaces), so
`npx wrangler ...` or `npx sanity ...` would run unreviewed, network-fetched
code under a preapproved command. If a Wave 2+ agent needs a
`wrangler`/`sanity` operation, or `npm run dev`/`format`, none of that is
preapproved — ask first, the same way as any other guardrail item above.
Use WebFetch against the official docs sites for reference. Spec §18.1's
command table is built around `npx sanity ...`/`npx wrangler ...` calls and
predates the decision recorded above to allowlist no `npx` command at all —
do not follow it as written; it is not yours to edit.
