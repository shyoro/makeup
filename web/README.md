# web

The Astro static site for a Hebrew (RTL) makeup-artist one-page site.

Before writing any component, read `CLAUDE.md` at the repo root and
`.claude/skills/brand-he/SKILL.md` (both land in Task 8; if they don't exist
yet, don't invent conventions in their place).

Design spec: `docs/superpowers/specs/2026-09-13-makeup-site-design.md`.

Run from the repo root, not from `web/`:

- `npm run dev`
- `npm run build`
- `npm run typecheck`

`web/src/styles/global.css` has a load-bearing import order; Tasks 4 and 5
add to it.
