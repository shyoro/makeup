#!/bin/sh
# Verifies scripts/lint-guards.sh actually catches what it claims to catch.
# A guard nobody tested is a guard that silently stops working; this is
# that test, mirroring tests/hooks/leak-hook.test.sh's structure.
#
# Fix-round tags: (fix-round-1: Cn/In/Mn), (fix-round-2: Nn),
# (fix-round-3: An), (fix-round-4: Bn) and (fix-round-5: R5A..R5D,
# one tag per item of the round-5 brief) mark
# assertions added to cover a bypass the reviewer empirically verified
# against the guard as it stood before that round.
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GUARD="$ROOT/scripts/lint-guards.sh"
# Which shell the guard itself runs under. Defaults to /bin/sh; set
# GUARD_SH=dash to re-run the whole suite against a strict POSIX shell.
# Running this harness under dash is NOT enough on its own: the harness
# always invokes the guard as a separate process, and on macOS /bin/sh is
# bash in sh-mode, which accepts bashisms dash rejects. A bashism in the
# guard has already shipped once and made it scan zero files everywhere
# /bin/sh is dash while every test passed locally.
GUARD_SH="${GUARD_SH:-sh}"
PASS=0
FAIL=0

FIXTURE="$(mktemp -d)"
cleanup() { rm -rf "$FIXTURE"; }
trap cleanup EXIT

# Runs the guard against a fresh fixture tree containing exactly one file
# with the given content, and returns the guard's exit status.
run_guard() {
  rm -rf "$FIXTURE"
  mkdir -p "$FIXTURE"
  FILE="$FIXTURE/$1"
  mkdir -p "$(dirname "$FILE")"
  printf '%s\n' "$2" > "$FILE"
  LINT_GUARD_SRC="$FIXTURE" "$GUARD_SH" "$GUARD" >/dev/null 2>&1
}

expect_block() {
  if run_guard "$2" "$3"; then
    printf 'FAIL: expected BLOCK for %s\n' "$1"; FAIL=$((FAIL+1))
  else
    printf 'ok: blocked %s\n' "$1"; PASS=$((PASS+1))
  fi
}

expect_allow() {
  if run_guard "$2" "$3"; then
    printf 'ok: allowed %s\n' "$1"; PASS=$((PASS+1))
  else
    printf 'FAIL: expected ALLOW for %s\n' "$1"; FAIL=$((FAIL+1))
  fi
}

# --- Guard 1: hardcoded absolute origins -----------------------------------

expect_block "http literal in .ts" \
  "lib/seo/probe.ts" \
  'export const bad = "https://example.com";'

expect_block "absolute origin in raw Astro template markup (not frontmatter)" \
  "pages/about.astro" \
  '<link rel="canonical" href="https://makeup.workers.dev/about">'

expect_allow "origin literal inside the real config.ts is exempt" \
  "config.ts" \
  'export const SITE_URL = "https://makeup.workers.dev";'

expect_block "I3: a DIFFERENT file merely named config.ts is NOT exempt" \
  "components/x/config.ts" \
  'export const u = "https://evil.example.com";'

expect_block "I3: a TemplateLiteral origin in a nested config.ts is caught by the text-level guard even though ESLint's Literal-only selector misses it" \
  "lib/sanity/config.ts" \
  'export const u = `https://${projectId}.apicdn.sanity.io`;'

expect_allow "xmlns namespace URI alone is exempt" \
  "components/media/icon.astro" \
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>'

expect_block "I6: a real origin sharing a line with an xmlns attribute still blocks" \
  "components/media/sprite.astro" \
  '<svg xmlns="http://www.w3.org/2000/svg"></svg><link href="https://evil.example.com">'

# fix-round-2 N1: the xmlns exemption must not over-match. A real SVG
# sprite carries BOTH a bare xmlns and a prefixed xmlns:xlink, and either
# quote style, and neither is a hardcoded site origin.
expect_allow "N1: xmlns plus xmlns:xlink on the same line (standard SVG sprite pattern) is exempt" \
  "components/media/sprite2.astro" \
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>'

expect_allow "N1: single-quoted xmlns is exempt" \
  "components/media/icon2.astro" \
  "<svg xmlns='http://www.w3.org/2000/svg'></svg>"

expect_allow "guard-ok marker exempts a genuine false positive" \
  "lib/seo/notes.ts" \
  '// see https://example.com/spec for background guard-ok'

expect_allow "plain relative path has no origin" \
  "pages/index.astro" \
  '<a href="/about">about</a>'

expect_block "M13: schema.org JSON-LD context IS a real hardcoded origin and should still block" \
  "components/integrations/jsonld.astro" \
  '<script type="application/ld+json">{"@context": "https://schema.org"}</script>'

expect_block "C1: absolute origin in a .jsx file" \
  "components/Widget.jsx" \
  'export const bad = "https://example.com";'

# fix-round-2 N5: .js must also be scanned by Guard 1 (added alongside
# .mjs per the fix-round-2 one-liner).
expect_block "N5: absolute origin in a .js file" \
  "lib/seo/probe.js" \
  'export const bad = "https://example.com";'

# fix-round-2 N2: Guard 1 must NOT scan .md/.mdx — an ordinary prose link
# in a future content collection is not a hard-rule-3 violation. This is
# the deliberate asymmetry with Guard 2 (which DOES scan .md/.mdx for
# utility bypass, tested below).
expect_allow "N2: an ordinary prose URL in a .md file passes Guard 1 (Guard 1 does not scan .md/.mdx)" \
  "content/post.md" \
  '[the official page](https://www.dior.com/en_gb)'

# --- Guard 2: arbitrary-value colour/font/spacing and inline styles -------

expect_block "arbitrary hex colour utility (bg-[#ff0000])" \
  "components/primitives/button.astro" \
  '<button class="bg-[#ff0000]">Go</button>'

expect_block "arbitrary short hex colour utility (text-[#0f0])" \
  "components/primitives/badge.astro" \
  '<span class="text-[#0f0]">New</span>'

expect_block "arbitrary font utility (font-[Comic_Sans])" \
  "components/primitives/heading.astro" \
  '<h1 class="font-[Comic_Sans]">Hi</h1>'

expect_block "arbitrary px spacing utility (p-[13px])" \
  "components/sections/hero.astro" \
  '<div class="p-[13px]">Hero</div>'

expect_block "arbitrary rem spacing utility (mt-[2rem])" \
  "components/sections/hero.astro" \
  '<div class="mt-[2rem]">Hero</div>'

expect_block "inline style hex colour, double-quoted" \
  "components/primitives/card.astro" \
  '<div style="color:#f00">Card</div>'

expect_allow "token-scale class is untouched" \
  "components/primitives/button.astro" \
  '<button class="bg-surface text-ink px-6 py-section">Go</button>'

expect_allow "raw hex in a real .css file is untouched (token values legitimately live there)" \
  "styles/theme-extra.css" \
  '.legacy { color: #ff0000; }'

expect_allow "guard-ok marker exempts a genuine false positive" \
  "components/primitives/notes.astro" \
  '<!-- example only: bg-[#ff0000] is what we must not write guard-ok -->'

expect_allow "bg-[var(--role-accent)] is the intended token indirection, left alone" \
  "components/primitives/button.astro" \
  '<button class="bg-[var(--role-accent)]">Go</button>'

expect_block "C1: arbitrary hex colour in an .mdx content-collection body" \
  "content/post.mdx" \
  '<div class="bg-[#ff0000] p-[13px]">inline in markdown</div>'

# fix-round-2 N2 (the Guard 2 side of the asymmetry): raw hex in a .md
# file (not just .mdx) must still be caught by Guard 2, even though a
# prose URL in the same file type passes Guard 1 (tested above).
expect_block "N2: arbitrary hex colour in a .md content-collection body" \
  "content/post.md" \
  '<div class="bg-[#ff0000]">inline in markdown</div>'

# fix-round-2 N5: .js and .mjs must be scanned by Guard 2 too.
expect_block "N5: arbitrary hex colour utility in a .js file" \
  "components/Widget.js" \
  'const cls = "bg-[#ff0000]";'

expect_block "N5: arbitrary hex colour utility in a .mjs file" \
  "lib/build-helper.mjs" \
  'const cls = "bg-[#ff0000]";'

expect_block "I4/I5: a non-.css file physically located under styles/ is still scanned" \
  "styles/evil.astro" \
  '<div class="bg-[#ff0000]">not a stylesheet</div>'

expect_block "I7: arbitrary rgb() colour utility" \
  "components/primitives/alert.astro" \
  '<div class="bg-[rgb(255,0,0)]">Alert</div>'

expect_block "I7: arbitrary oklch() colour utility" \
  "components/primitives/alert.astro" \
  '<div class="bg-[oklch(0.7_0.2_30)]">Alert</div>'

expect_block "I7: inline style rgb() colour" \
  "components/primitives/alert.astro" \
  '<div style="color:rgb(255,0,0)">Alert</div>'

expect_block "I8: inline style hex colour, single-quoted" \
  "components/primitives/card.astro" \
  "<div style='color:#f00'>Card</div>"

expect_block "I8: inline style hex colour in a JS/Astro expression attribute" \
  "components/primitives/card.astro" \
  '<div style={`color:#f00`}>Card</div>'

expect_block "M10: arbitrary px font-size utility (text-[13px])" \
  "components/primitives/heading.astro" \
  '<h1 class="text-[13px]">Hi</h1>'

expect_block "M10: arbitrary px line-height utility (leading-[21px])" \
  "components/primitives/paragraph.astro" \
  '<p class="leading-[21px]">Body</p>'

expect_block "M10: arbitrary em letter-spacing utility (tracking-[0.05em])" \
  "components/primitives/paragraph.astro" \
  '<p class="tracking-[0.05em]">Body</p>'

expect_block "M10: text-[#0f0] is still caught as a colour, not missed" \
  "components/primitives/badge.astro" \
  '<span class="text-[#0f0]">New</span>'

# --- fix-round-2 N3: colour denylist-with-exception evasions --------------

expect_block "N3: uppercase colour function (bg-[RGB(255,0,0)]) — case-insensitivity evasion" \
  "components/primitives/alert2.astro" \
  '<div class="bg-[RGB(255,0,0)]">Alert</div>'

expect_block "N3: uppercase colour function in a style attribute (style=\"COLOR:RGB(1,2,3)\")" \
  "components/primitives/alert3.astro" \
  '<div style="COLOR:RGB(1,2,3)">Alert</div>'

expect_block "N3: Tailwind underscore-as-space form (bg-[_rgb(255,0,0)])" \
  "components/primitives/alert4.astro" \
  '<div class="bg-[_rgb(255,0,0)]">Alert</div>'

expect_block "N3: named CSS colour in a Tailwind utility (bg-[red])" \
  "components/primitives/alert5.astro" \
  '<div class="bg-[red]">Alert</div>'

expect_block "N3: named CSS colour in another colour-bearing prefix (text-[white])" \
  "components/primitives/alert6.astro" \
  '<span class="text-[white]">Alert</span>'

expect_block "N3: named CSS colour in an inline style (style=\"color:red\")" \
  "components/primitives/alert7.astro" \
  '<div style="color:red">Alert</div>'

expect_allow "N3: bg-[var(--role-surface)] still passes after the inversion" \
  "components/primitives/button2.astro" \
  '<button class="bg-[var(--role-surface)]">Go</button>'

expect_allow "N3: style=\"color:var(--role-ink)\" still passes after the inversion" \
  "components/primitives/card2.astro" \
  '<div style="color:var(--role-ink)">Card</div>'

# --- one-liner fix: $SRC must be regex-escaped before interpolation -----
# A checkout path containing ERE metacharacters ('+', '[', ']', '*', ...)
# must not corrupt the config.ts anchor: it must still exempt the real
# config.ts and still block everything else. Uses its own fixture (not
# the run_guard()/FIXTURE pair above) because it needs a directory name
# with metacharacters in it, not just a file name.
METADIR="$(mktemp -d)/weird+dir[x]*name"
mkdir -p "$METADIR"
printf 'export const SITE_URL = "https://makeup.workers.dev";\n' > "$METADIR/config.ts"
printf 'export const evil = "https://evil.example.com";\n' > "$METADIR/other.ts"
OUT=$(LINT_GUARD_SRC="$METADIR" "$GUARD_SH" "$GUARD" 2>&1) && STATUS=0 || STATUS=$?
rm -rf "$(dirname "$METADIR")"
if [ "$STATUS" -ne 0 ] \
  && ! printf '%s\n' "$OUT" | grep -q 'config\.ts:1:export const SITE_URL' \
  && printf '%s\n' "$OUT" | grep -q 'other\.ts:1:export const evil'; then
  printf 'ok: regex-metacharacter checkout path — config.ts stays exempt, sibling file still blocks\n'; PASS=$((PASS+1))
else
  printf 'FAIL: regex-metacharacter checkout path mishandled $SRC escaping\n'; FAIL=$((FAIL+1))
fi

# --- fix-round-3 A5: mutation coverage for every --include flag ----------
# One fixture per extension per guard, each carrying the violation that
# guard actually detects, so deleting any --include flag from either
# guard fails a test (verified in the fix-round-3 report by actually
# deleting each flag and re-running this file).

expect_block "A5: absolute origin in a .tsx file (Guard 1 .tsx coverage)" \
  "components/Widget.tsx" \
  'export const bad = "https://example.com";'

expect_block "A5: absolute origin in a .mjs file (Guard 1 .mjs coverage)" \
  "lib/build-helper.mjs" \
  'export const bad = "https://example.com";'

expect_block "A5: absolute origin in a .css file (Guard 1 .css coverage)" \
  "styles/evil-url.css" \
  '.hero { background: url(https://evil.example.com/x.png); }'

expect_block "A5: arbitrary hex colour utility in a .tsx file (Guard 2 .tsx coverage)" \
  "components/Widget2.tsx" \
  'const cls = "bg-[#ff0000]";'

expect_block "A5: arbitrary hex colour utility in a .ts file (Guard 2 .ts coverage)" \
  "lib/seo/classes.ts" \
  'export const cls = "bg-[#ff0000]";'

expect_block "A5: arbitrary hex colour utility in a .jsx file (Guard 2 .jsx coverage)" \
  "components/Widget3.jsx" \
  'const cls = "bg-[#ff0000]";'

# --- fix-round-3 A1: unquoted `for FILE in $(...)` word-splits a path ----
# containing a space, silently scanning ZERO files for 2a (the flagship
# colour check) while 2b/2c/2d stay unaffected (they pass "$SRC" quoted
# to a single grep -r). mktemp -d never produces a path with a space, so
# this needs its own fixture directory, not run_guard()'s shared FIXTURE.
SPACEDIR="$(mktemp -d)/space dir"
mkdir -p "$SPACEDIR"
printf '<div class="bg-[#ff0000]">A</div>\n' > "$SPACEDIR/a.astro"
OUT=$(LINT_GUARD_SRC="$SPACEDIR" "$GUARD_SH" "$GUARD" 2>&1) && STATUS=0 || STATUS=$?
rm -rf "$(dirname "$SPACEDIR")"
if [ "$STATUS" -ne 0 ] && printf '%s\n' "$OUT" | grep -q 'a\.astro:1:'; then
  printf 'ok: A1: a checkout path containing a space still blocks a colour violation\n'; PASS=$((PASS+1))
else
  printf 'FAIL: A1: a checkout path containing a space made 2a scan nothing\n'; FAIL=$((FAIL+1))
fi

# --- fix-round-3 A2: var(--x,fallback) is a hardcoded-colour bypass ------

expect_block "A2: bg-[var(--x,#f00)] — a fallback comma hides a real hardcoded colour" \
  "components/primitives/fallback1.astro" \
  '<div class="bg-[var(--x,#f00)]">A</div>'

expect_block "A2: style=\"color:var(--x,#f00)\" — same bypass via inline style" \
  "components/primitives/fallback2.astro" \
  '<div style="color:var(--x,#f00)">A</div>'

# --- fix-round-3 A3: the inversion's blast radius, pinned value-by-value -

expect_allow "A3: ring-[3px] is a width, not a colour" \
  "components/primitives/a3-ring.astro" \
  '<div class="ring-[3px]">A</div>'

expect_allow "A3: outline-[2px] is a width, not a colour" \
  "components/primitives/a3-outline.astro" \
  '<div class="outline-[2px]">A</div>'

expect_allow "A3: decoration-[3px] is a width, not a colour" \
  "components/primitives/a3-decoration.astro" \
  '<div class="decoration-[3px]">A</div>'

expect_allow "A3: border-[length:2px] — Tailwind's own not-a-colour hint" \
  "components/primitives/a3-border-length.astro" \
  '<div class="border-[length:2px]">A</div>'

expect_allow "A3: bg-[url(/hero.webp)] is an image, not a colour" \
  "components/primitives/a3-bg-url.astro" \
  '<div class="bg-[url(/hero.webp)]">A</div>'

expect_allow "A3: shadow-[0_1px_2px_var(--role-shadow)] is fully token-routed" \
  "components/primitives/a3-shadow.astro" \
  '<div class="shadow-[0_1px_2px_var(--role-shadow)]">A</div>'

expect_allow "A3: from-[30%]/to-[80%] gradient stop positions pass (the per-token percentage allowance)" \
  "components/primitives/a3-from.astro" \
  '<div class="from-[30%] to-[80%]">A</div>'

# The colour cases from earlier rounds must still block after A3's wider
# ALLOW-list — the inversion widened what's exempt, not what's caught.
expect_block "A3 regression check: bg-[red] (named colour) still blocks" \
  "components/primitives/a3-red.astro" \
  '<div class="bg-[red]">A</div>'

# --- fix-round-3 A4: CSS-wide keywords/currentColor on colour properties -

expect_allow "A4: style=\"fill:none\" — the standard SVG no-fill idiom" \
  "components/media/a4-fill-none.astro" \
  '<svg><path style="fill:none"/></svg>'

expect_allow "A4: style=\"fill:currentColor\" — the token-safe SVG icon idiom" \
  "components/media/a4-fill-current.astro" \
  '<svg><path style="fill:currentColor"/></svg>'

expect_allow "A4: style=\"stroke:currentColor\"" \
  "components/media/a4-stroke-current.astro" \
  '<svg><path style="stroke:currentColor"/></svg>'

expect_allow "A4: style=\"color:inherit\"" \
  "components/primitives/a4-color-inherit.astro" \
  '<div style="color:inherit">A</div>'

# --- fix-round-3 A6: shorthand colour properties, checked per token ------

expect_block "A6: style=\"background:red\" — the commonest hand-written inline colour form" \
  "components/primitives/a6-bg-red.astro" \
  '<div style="background:red">A</div>'

expect_block "A6: style=\"border:1px solid #ccc\" — raw hex caught via its own token" \
  "components/primitives/a6-border-hex.astro" \
  '<div style="border:1px solid #ccc">A</div>'

expect_allow "A6: style=\"border:1px solid currentColor\" passes (A4's keywords apply per-token too)" \
  "components/primitives/a6-border-current.astro" \
  '<div style="border:1px solid currentColor">A</div>'

expect_allow "A6: style=\"background:url(/hero.webp)\" is an image, not a colour" \
  "components/primitives/a6-bg-url.astro" \
  '<div style="background:url(/hero.webp)">A</div>'

# --- fix-round-3 fold-in: lowercase-only var(--...) is covered on its own,
# not only via case-insensitivity of an uppercase variant -----------------

expect_allow "fold-in: lowercase var(--role-ink) with no fallback passes 2d on its own" \
  "components/primitives/lowercase-var.astro" \
  '<div style="color:var(--role-ink)">A</div>'

# --- fix-round-3 fold-in: 2a de-duplicates a line with two violations ----
# (verified as a single BLOCKED entry, not two, in the fix-round-3 report
# via direct output inspection — grep -c counts lines just fine here
# because a passing test only needs the guard's exit status, not its
# line count, so this is exercised directly with the real script rather
# than through expect_block/run_guard.)
DEDUPDIR="$(mktemp -d)"
printf '<div class="bg-[red] text-[white]">A</div>\n' > "$DEDUPDIR/dup.astro"
DEDUP_OUT=$(LINT_GUARD_SRC="$DEDUPDIR" "$GUARD_SH" "$GUARD" 2>&1) && DEDUP_STATUS=0 || DEDUP_STATUS=$?
rm -rf "$DEDUPDIR"
DEDUP_COUNT=$(printf '%s\n' "$DEDUP_OUT" | grep -c 'dup\.astro:1:' || true)
if [ "$DEDUP_STATUS" -ne 0 ] && [ "$DEDUP_COUNT" -eq 1 ]; then
  printf 'ok: fold-in: one line with two colour violations is reported once, not twice\n'; PASS=$((PASS+1))
else
  printf 'FAIL: fold-in: expected exactly 1 report line for dup.astro:1, got %s (status=%s)\n' "$DEDUP_COUNT" "$DEDUP_STATUS"; FAIL=$((FAIL+1))
fi

# --- fix-round-4 B1: the unit case matched the WHOLE bracket value ------
# `[0-9]*px|[0-9]*rem|[0-9]*em|[0-9]*%` accepted anything starting with a
# digit and ending in a unit, so appending one more shadow segment to an
# already-caught value laundered the colour. Values are now split on `_`
# and every token judged.

expect_block "B1: shadow-[0_0_10px_#ff0000_0_0_1px] — a second shadow segment must not launder the hex" \
  "components/primitives/b1-shadow-multi.astro" \
  '<div class="shadow-[0_0_10px_#ff0000_0_0_1px]">A</div>'

expect_block "B1: shadow-[0_0_0_#ff0000_1em] — trailing unit must not launder the hex" \
  "components/primitives/b1-shadow-em.astro" \
  '<div class="shadow-[0_0_0_#ff0000_1em]">A</div>'

expect_block "B1: shadow-[0_0_10px_#ff0000] (the single-segment form) still blocks" \
  "components/primitives/b1-shadow-single.astro" \
  '<div class="shadow-[0_0_10px_#ff0000]">A</div>'

# --- fix-round-4 B2: a data-type hint is not evidence of a non-colour ---
# The hint is now stripped and the remainder re-judged.

expect_block "B2: bg-[length:#ff0000] — hint wrapped round a hex colour" \
  "components/primitives/b2-length-hex.astro" \
  '<div class="bg-[length:#ff0000]">A</div>'

expect_block "B2: bg-[size:red] — hint wrapped round a named colour" \
  "components/primitives/b2-size-red.astro" \
  '<div class="bg-[size:red]">A</div>'

expect_block "B2: bg-[image:linear-gradient(red,blue)] — valid shipping CSS with two hardcoded colours" \
  "components/primitives/b2-image-gradient.astro" \
  '<div class="bg-[image:linear-gradient(red,blue)]">A</div>'

expect_allow "B2: border-[length:2px] — stripping the hint leaves a width, still allowed" \
  "components/primitives/b2-length-px.astro" \
  '<div class="border-[length:2px]">A</div>'

# --- fix-round-4 B3: url(...) must not launder a hex fragment ----------

expect_block "B3: bg-[url(#ff0000)] — a hex colour in a url costume" \
  "components/primitives/b3-url-hex.astro" \
  '<div class="bg-[url(#ff0000)]">A</div>'

expect_allow "B3: bg-[url(#some-gradient)] — a real SVG paint-server reference is not a colour" \
  "components/primitives/b3-url-frag.astro" \
  '<div class="bg-[url(#some-gradient)]">A</div>'

# --- fix-round-4 B4: var() must not exempt the rest of the value -------

expect_block "B4: shadow-[0_0_0_#ff0000_var(--x)] — a var() token must not exempt a sibling hex token" \
  "components/primitives/b4-shadow-var.astro" \
  '<div class="shadow-[0_0_0_#ff0000_var(--x)]">A</div>'

expect_block "B4: bg-[linear-gradient(var(--a),red)] — var() inside a larger expression laundered nothing" \
  "components/primitives/b4-gradient-var.astro" \
  '<div class="bg-[linear-gradient(var(--a),red)]">A</div>'

expect_allow "B4: shadow-[0_1px_2px_var(--role-shadow)] — the correct remediation for a shadow violation MUST pass" \
  "components/primitives/b4-shadow-ok.astro" \
  '<div class="shadow-[0_1px_2px_var(--role-shadow)]">A</div>'

# --- fix-round-4 B5 (2d): a bare unitless number is legal CSS ----------

expect_allow "B5: style=\"box-shadow:0 1px 2px var(--role-shadow)\" — the inline analogue of B4's allowed case" \
  "components/primitives/b5-boxshadow.astro" \
  '<div style="box-shadow:0 1px 2px var(--role-shadow)">A</div>'

expect_allow "B5: style=\"border:0\"" \
  "components/primitives/b5-border0.astro" \
  '<div style="border:0">A</div>'

expect_allow "B5: style=\"outline:0 solid transparent\"" \
  "components/primitives/b5-outline0.astro" \
  '<div style="outline:0 solid transparent">A</div>'

expect_allow "B5: style=\"background:0 0\"" \
  "components/primitives/b5-bg00.astro" \
  '<div style="background:0 0">A</div>'

# --- fix-round-4 B6 (2d): background position/size/repeat keywords ------

expect_allow "B6: style=\"background:url(/hero.webp) center/cover no-repeat\" — a hero image carries no colour" \
  "components/primitives/b6-hero.astro" \
  '<div style="background:url(/hero.webp) center/cover no-repeat">A</div>'

expect_allow "B6: style=\"background:LEFT top / cover\" — keywords are case-insensitive and a bare / is not a value" \
  "components/primitives/b6-bgpos.astro" \
  '<div style="background:LEFT top / cover">A</div>'

expect_block "B6: style=\"background:red center/cover no-repeat\" — the keywords must not exempt the colour token" \
  "components/primitives/b6-bgred.astro" \
  '<div style="background:red center/cover no-repeat">A</div>'

# --- fix-round-4 B7: from/via/to restored to 2a's prefix list -----------
# The five verdicts the counterfactual produced, pinned individually so
# the position/colour distinction is a test rather than an argument.

expect_allow "B7: from-[30%] is a gradient stop POSITION" \
  "components/primitives/b7-from-pct.astro" \
  '<div class="from-[30%]">A</div>'

expect_allow "B7: to-[80%] is a gradient stop POSITION" \
  "components/primitives/b7-to-pct.astro" \
  '<div class="to-[80%]">A</div>'

expect_allow "B7: via-[var(--x)] is the token indirection" \
  "components/primitives/b7-via-var.astro" \
  '<div class="via-[var(--x)]">A</div>'

expect_block "B7: from-[red] is a gradient stop COLOUR" \
  "components/primitives/b7-from-red.astro" \
  '<div class="from-[red]">A</div>'

expect_block "B7: from-[#ff0000] is a gradient stop COLOUR" \
  "components/primitives/b7-from-hex.astro" \
  '<div class="from-[#ff0000]">A</div>'

# --- fix-round-4 B8: the comma rule is scoped to inside var()'s parens -

expect_allow "B8: shadow-[0_1px_2px_var(--a),0_2px_4px_var(--b)] — a comma as CSS's real list separator" \
  "components/primitives/b8-shadow-list.astro" \
  '<div class="shadow-[0_1px_2px_var(--a),0_2px_4px_var(--b)]">A</div>'

expect_allow "B8: style=\"box-shadow:0 1px 2px var(--a), 0 2px 4px var(--b)\" — same list, inline" \
  "components/primitives/b8-shadow-list-inline.astro" \
  '<div style="box-shadow:0 1px 2px var(--a), 0 2px 4px var(--b)">A</div>'

expect_block "B8: bg-[var(--x,#f00)] — a comma INSIDE the parens is still fallback laundering" \
  "components/primitives/b8-fallback.astro" \
  '<div class="bg-[var(--x,#f00)]">A</div>'

expect_block "B8: style=\"color:var(--x,#f00)\" — same, inline" \
  "components/primitives/b8-fallback-inline.astro" \
  '<div style="color:var(--x,#f00)">A</div>'

# --- fix-round-4 B9: STYLE_PROP_ALT's four missing properties ----------

expect_block "B9: style=\"background-image:linear-gradient(red,blue)\"" \
  "components/primitives/b9-bgimage.astro" \
  '<div style="background-image:linear-gradient(red,blue)">A</div>'

expect_block "B9: style=\"text-shadow:0 1px 2px #000\"" \
  "components/primitives/b9-textshadow.astro" \
  '<div style="text-shadow:0 1px 2px #000">A</div>'

expect_block "B9: style=\"border-image:linear-gradient(red,blue) 1\"" \
  "components/primitives/b9-borderimage.astro" \
  '<div style="border-image:linear-gradient(red,blue) 1">A</div>'

expect_block "B9: style=\"column-rule:1px solid #ccc\"" \
  "components/primitives/b9-columnrule.astro" \
  '<div style="column-rule:1px solid #ccc">A</div>'

expect_block "B9: style=\"column-rule-color:red\" — the longer name is not shadowed by column-rule" \
  "components/primitives/b9-columnrulecolor.astro" \
  '<div style="column-rule-color:red">A</div>'

expect_block "B9: style=\"background-color:red\" is not shadowed by the new background-image entry" \
  "components/primitives/b9-bgcolor.astro" \
  '<div style="background-color:red">A</div>'

# --- fix-round-5 R5A: the url( branch must not prefix-match -------------
# Before round 5 the url branch stripped `url(` and a TRAILING `)`, then
# tested only the remainder, so anything between the real closing paren
# and the end of the token was discarded from judgement and a hardcoded
# colour rode through. `background:url(/a.png)#abc no-repeat` is real
# shipping CSS: it resolves to `background: #abc url("/a.png") no-repeat`.

expect_block "R5A: style=\"background:url(/a.png)#abc no-repeat\" — a hex colour after the closing paren" \
  "components/primitives/r5a-bg-url-hex.astro" \
  '<div style="background:url(/a.png)#abc no-repeat">A</div>'

expect_block "R5A: style=\"background:url(x)#f00\" — shortest form of the same bypass" \
  "components/primitives/r5a-bg-url-f00.astro" \
  '<div style="background:url(x)#f00">A</div>'

expect_block "R5A: bg-[url(/a.svg)#f00] — same bypass through 2a" \
  "components/primitives/r5a-2a-url-hex.astro" \
  '<div class="bg-[url(/a.svg)#f00]">A</div>'

expect_block "R5A: shadow-[url(/a)#f00] — same bypass on another colour-bearing prefix" \
  "components/primitives/r5a-2a-shadow-url.astro" \
  '<div class="shadow-[url(/a)#f00]">A</div>'

expect_block "R5A: bg-[url(#FF0000)] — the hex fragment test is case-insensitive" \
  "components/primitives/r5a-url-upper.astro" \
  '<div class="bg-[url(#FF0000)]">A</div>'

expect_allow "R5A: bg-[url(#some-gradient-id)] — a real SVG paint-server reference still passes" \
  "components/primitives/r5a-url-frag.astro" \
  '<div class="bg-[url(#some-gradient-id)]">A</div>'

expect_allow "R5A: bg-[url(/hero.webp)] — a plain image reference still passes" \
  "components/primitives/r5a-url-img.astro" \
  '<div class="bg-[url(/hero.webp)]">A</div>'

expect_block "R5A: bg-[url(/a] — an unterminated url( is not proof of anything and fails closed" \
  "components/primitives/r5a-url-open.astro" \
  '<div class="bg-[url(/a]">A</div>'

# --- fix-round-5 R5B: Tailwind 4 bare arbitrary properties (2e) --------
# `<div class="[color:red]">` is valid Tailwind 4 and was scanned by
# neither guard: 2a requires a `prefix-[` and 2d requires `style=`.
# 2e judges the bracket group itself, so leading variants (md:, hover:)
# are covered by the same pattern.

expect_block "R5B: [color:red] — bare arbitrary property with a named colour" \
  "components/primitives/r5b-color-red.astro" \
  '<div class="[color:red]">A</div>'

expect_block "R5B: [background-color:#f00] — bare arbitrary property with a hex colour" \
  "components/primitives/r5b-bgcolor-hex.astro" \
  '<div class="[background-color:#f00]">A</div>'

expect_block "R5B: [--my-var:red] — a custom property is judged by its value" \
  "components/primitives/r5b-customprop.astro" \
  '<div class="[--my-var:red]">A</div>'

expect_block "R5B: [COLOR:RED] — CSS property names are case-insensitive" \
  "components/primitives/r5b-upper.astro" \
  '<div class="[COLOR:RED]">A</div>'

expect_block "R5B: md:[color:red] — a responsive variant does not launder the arbitrary property" \
  "components/primitives/r5b-md.astro" \
  '<div class="md:[color:red]">A</div>'

expect_block "R5B: hover:[color:red] — nor does a state variant" \
  "components/primitives/r5b-hover.astro" \
  '<div class="hover:[color:red]">A</div>'

expect_block "R5B: [color:var(--x,#f00)] — the var()-fallback rule applies to 2e too" \
  "components/primitives/r5b-fallback.astro" \
  '<div class="[color:var(--x,#f00)]">A</div>'

expect_block "R5B: [font-family:Comic_Sans] — a hardcoded font name in the bare form" \
  "components/primitives/r5b-font.astro" \
  '<div class="[font-family:Comic_Sans]">A</div>'

expect_allow "R5B: [color:var(--role-ink)] — the correct remediation MUST pass" \
  "components/primitives/r5b-color-var.astro" \
  '<div class="[color:var(--role-ink)]">A</div>'

expect_allow "R5B: [font-family:var(--font-ui)] — same, for fonts" \
  "components/primitives/r5b-font-var.astro" \
  '<div class="[font-family:var(--font-ui)]">A</div>'

expect_allow "R5B: [mask-type:luminance] — not a colour-bearing property, not 2e's business" \
  "components/primitives/r5b-masktype.astro" \
  '<div class="[mask-type:luminance]">A</div>'

expect_allow "R5B: [aspect-ratio:16/9] — likewise" \
  "components/primitives/r5b-aspect.astro" \
  '<div class="[aspect-ratio:16/9]">A</div>'

# --- fix-round-5 R5C: token splitting must respect paren depth ---------
# Round 4 split on `,` with no regard to nesting, so a fully token-routed
# gradient — the CORRECT remediation for a real violation — was blocked
# with no compliant rewrite available. Splitting is now depth-aware and a
# gradient function is judged by recursing on its arguments. Colour
# FUNCTIONS are not in that recursion list, so rgb()/oklch()/color-mix()
# still block.

expect_allow "R5C: bg-[linear-gradient(var(--a),var(--b))] — a fully token-routed gradient MUST pass" \
  "components/primitives/r5c-grad-ok.astro" \
  '<div class="bg-[linear-gradient(var(--a),var(--b))]">A</div>'

expect_allow "R5C: bg-[linear-gradient(to_right,var(--a),var(--b))] — a direction keyword is geometry, not colour" \
  "components/primitives/r5c-grad-dir.astro" \
  '<div class="bg-[linear-gradient(to_right,var(--a),var(--b))]">A</div>'

expect_allow "R5C: bg-[radial-gradient(circle_at_center,var(--a),var(--b))] — radial geometry keywords too" \
  "components/primitives/r5c-grad-radial.astro" \
  '<div class="bg-[radial-gradient(circle_at_center,var(--a),var(--b))]">A</div>'

expect_allow "R5C: bg-[repeating-linear-gradient(45deg,var(--a),var(--b))] — an angle is not a colour" \
  "components/primitives/r5c-grad-angle.astro" \
  '<div class="bg-[repeating-linear-gradient(45deg,var(--a),var(--b))]">A</div>'

expect_allow "R5C: bg-[conic-gradient(from_45deg,var(--a),var(--b))] — conic geometry keyword" \
  "components/primitives/r5c-grad-conic.astro" \
  '<div class="bg-[conic-gradient(from_45deg,var(--a),var(--b))]">A</div>'

expect_allow "R5C: bg-[linear-gradient(in_oklch,var(--a),var(--b))] — a colour SPACE is not a colour" \
  "components/primitives/r5c-grad-space.astro" \
  '<div class="bg-[linear-gradient(in_oklch,var(--a),var(--b))]">A</div>'

expect_block "R5C: bg-[linear-gradient(in_oklch,var(--a),oklch(0.7_0.2_30))] — naming the space does not exempt a colour IN it" \
  "components/primitives/r5c-grad-space-colour.astro" \
  '<div class="bg-[linear-gradient(in_oklch,var(--a),oklch(0.7_0.2_30))]">A</div>'

expect_block "R5C: bg-[linear-gradient(var(--a),url(#f00))] — a hex fragment nested in a gradient stop" \
  "components/primitives/r5c-grad-urlhex.astro" \
  '<div class="bg-[linear-gradient(var(--a),url(#f00))]">A</div>'

expect_block "R5C: bg-[image:url(/a)#f00] — a data-type hint over the round-5 url bypass" \
  "components/primitives/r5c-hint-url-tail.astro" \
  '<div class="bg-[image:url(/a)#f00]">A</div>'

expect_allow "R5C: style=\"background:linear-gradient(var(--a),var(--b))\" — the inline analogue" \
  "components/primitives/r5c-grad-inline.astro" \
  '<div style="background:linear-gradient(var(--a),var(--b))">A</div>'

expect_block "R5C: bg-[linear-gradient(var(--a),red)] — one hardcoded stop still blocks" \
  "components/primitives/r5c-grad-red.astro" \
  '<div class="bg-[linear-gradient(var(--a),red)]">A</div>'

expect_block "R5C: bg-[linear-gradient(var(--a),#ff0000)] — likewise a hex stop" \
  "components/primitives/r5c-grad-hex.astro" \
  '<div class="bg-[linear-gradient(var(--a),#ff0000)]">A</div>'

expect_block "R5C: bg-[LINEAR-GRADIENT(var(--a),red)] — CSS function names are case-insensitive" \
  "components/primitives/r5c-grad-upper.astro" \
  '<div class="bg-[LINEAR-GRADIENT(var(--a),red)]">A</div>'

expect_block "R5C: bg-[linear-gradient(var(--a),rgb(1,2,3))] — a colour function nested inside the gradient" \
  "components/primitives/r5c-grad-rgb.astro" \
  '<div class="bg-[linear-gradient(var(--a),rgb(1,2,3))]">A</div>'

expect_block "R5C: bg-[rgb(255,0,0)] — depth-aware splitting must NOT launder a colour function" \
  "components/primitives/r5c-rgb.astro" \
  '<div class="bg-[rgb(255,0,0)]">A</div>'

expect_block "R5C: bg-[oklch(0.7_0.2_30)] — nor this one" \
  "components/primitives/r5c-oklch.astro" \
  '<div class="bg-[oklch(0.7_0.2_30)]">A</div>'

expect_block "R5C: bg-[color-mix(in_srgb,var(--a),red)] — color-mix() is colour-producing and is not recursed into" \
  "components/primitives/r5c-colormix.astro" \
  '<div class="bg-[color-mix(in_srgb,var(--a),red)]">A</div>'

expect_block "R5C: bg-[linear-gradient(var(--a),var(--b))#f00] — a remainder after the closing paren is judged" \
  "components/primitives/r5c-grad-tail.astro" \
  '<div class="bg-[linear-gradient(var(--a),var(--b))#f00]">A</div>'

expect_block "R5C: bg-[var(--x,#f00)] — the var()-fallback rule is unaffected by depth-aware splitting" \
  "components/primitives/r5c-fallback.astro" \
  '<div class="bg-[var(--x,#f00)]">A</div>'

expect_allow "R5C: shadow-[0_1px_2px_var(--a),0_2px_4px_var(--b)] — a top-level comma still splits" \
  "components/primitives/r5c-list.astro" \
  '<div class="shadow-[0_1px_2px_var(--a),0_2px_4px_var(--b)]">A</div>'

# --- fix-round-5 R5D: token loops must not glob against the cwd -------
# `for PART in $(...)` let a token containing `*` undergo pathname
# expansion, so the verdict depended on the contents of the invoking
# directory. Both assertions below plant the SAME value and expect the
# SAME verdict from two very different cwds; that is the cwd-insensitivity
# this pins.

run_guard_in_cwd() {
  rm -rf "$FIXTURE"
  mkdir -p "$FIXTURE"
  FILE="$FIXTURE/$2"
  mkdir -p "$(dirname "$FILE")"
  printf '%s\n' "$3" > "$FILE"
  ( cd "$1" && LINT_GUARD_SRC="$FIXTURE" "$GUARD_SH" "$GUARD" >/dev/null 2>&1 )
}

# Every filename here is itself an ALLOWED token shape (a bare number).
# That is the point: if a `*` token were pathname-expanded against this
# directory it would turn into "0" and "2", every one of which passes,
# and the value would be ALLOWED — a verdict that flips with the
# contents of whatever directory the developer happened to be in.
GLOBDIR="$(mktemp -d)"
: > "$GLOBDIR/0"
: > "$GLOBDIR/2"
EMPTYDIR="$(mktemp -d)"
cleanup_r5d() { rm -rf "$FIXTURE" "$GLOBDIR" "$EMPTYDIR"; }
trap cleanup_r5d EXIT

if run_guard_in_cwd "$GLOBDIR" "components/primitives/r5d-calc.astro" '<div class="bg-[calc(100%_*_2)]">A</div>'; then
  printf 'FAIL: expected BLOCK for R5D: bg-[calc(100%%_*_2)] from a cwd full of glob-matching files\n'; FAIL=$((FAIL+1))
else
  printf 'ok: blocked R5D: bg-[calc(100%%_*_2)] from a cwd full of glob-matching files\n'; PASS=$((PASS+1))
fi

if run_guard_in_cwd "$EMPTYDIR" "components/primitives/r5d-calc.astro" '<div class="bg-[calc(100%_*_2)]">A</div>'; then
  printf 'FAIL: expected BLOCK for R5D: bg-[calc(100%%_*_2)] from an empty cwd (same verdict as above)\n'; FAIL=$((FAIL+1))
else
  printf 'ok: blocked R5D: bg-[calc(100%%_*_2)] from an empty cwd (same verdict as above)\n'; PASS=$((PASS+1))
fi

if run_guard_in_cwd "$GLOBDIR" "components/primitives/r5d-star.astro" '<div style="background:0 * 0">A</div>'; then
  printf 'FAIL: expected BLOCK for R5D: style="background:0 * 0" from a cwd full of glob-matching files\n'; FAIL=$((FAIL+1))
else
  printf 'ok: blocked R5D: style="background:0 * 0" from a cwd full of glob-matching files\n'; PASS=$((PASS+1))
fi

if run_guard_in_cwd "$EMPTYDIR" "components/primitives/r5d-star.astro" '<div style="background:0 * 0">A</div>'; then
  printf 'FAIL: expected BLOCK for R5D: style="background:0 * 0" from an empty cwd (same verdict as above)\n'; FAIL=$((FAIL+1))
else
  printf 'ok: blocked R5D: style="background:0 * 0" from an empty cwd (same verdict as above)\n'; PASS=$((PASS+1))
fi


if run_guard_in_cwd "$GLOBDIR" "components/primitives/r5d-shadow.astro" '<div class="shadow-[0_*_0]">A</div>'; then
  printf 'FAIL: expected BLOCK for R5D: shadow-[0_*_0] from a cwd whose filenames are all allowed token shapes\n'; FAIL=$((FAIL+1))
else
  printf 'ok: blocked R5D: shadow-[0_*_0] from a cwd whose filenames are all allowed token shapes\n'; PASS=$((PASS+1))
fi

if run_guard_in_cwd "$EMPTYDIR" "components/primitives/r5d-shadow.astro" '<div class="shadow-[0_*_0]">A</div>'; then
  printf 'FAIL: expected BLOCK for R5D: shadow-[0_*_0] from an empty cwd (same verdict as above)\n'; FAIL=$((FAIL+1))
else
  printf 'ok: blocked R5D: shadow-[0_*_0] from an empty cwd (same verdict as above)\n'; PASS=$((PASS+1))
fi

# --- coordinator adjudication R6A: the split mode must survive the -------
# gradient recursion. A whitespace-bearing inline gradient is the CORRECT
# token-routed remediation; blocking it teaches agents to reach for
# guard-ok, which is the failure this guard exists to prevent.
expect_allow "R6A: inline gradient with a space after the comma" \
  "one.astro" '<div style="background-image:linear-gradient(var(--a), var(--b))">A</div>'
expect_allow "R6A: inline gradient with a `to right` direction" \
  "one.astro" '<div style="background:linear-gradient(to right,var(--a),var(--b))">A</div>'
expect_allow "R6A: inline radial gradient with `circle at center`" \
  "one.astro" '<div style="background:radial-gradient(circle at center,var(--a),var(--b))">A</div>'
expect_block "R6A: a named colour in a spaced inline gradient still blocks" \
  "one.astro" '<div style="background:linear-gradient(var(--a), red)">A</div>'
expect_block "R6A: a hex colour in a spaced inline gradient still blocks" \
  "one.astro" '<div style="background:linear-gradient(var(--a), #ff0000)">A</div>'

# --- coordinator adjudication R6B: every *-color longhand, not an --------
# enumeration of the ones someone remembered.
expect_block "R6B: [border-top-color:red]" \
  "one.astro" '<div class="[border-top-color:red]">A</div>'
expect_block "R6B: [border-bottom-color:#f00]" \
  "one.astro" '<div class="[border-bottom-color:#f00]">A</div>'
expect_block "R6B: [text-emphasis-color:red]" \
  "one.astro" '<div class="[text-emphasis-color:red]">A</div>'
expect_block "R6B: [-webkit-text-fill-color:red] — vendor prefix" \
  "one.astro" '<div class="[-webkit-text-fill-color:red]">A</div>'
expect_block "R6B: [scrollbar-color:red_blue] — two-colour property" \
  "one.astro" '<div class="[scrollbar-color:red_blue]">A</div>'
expect_block "R6B: [stop-color:red] — SVG paint" \
  "one.astro" '<div class="[stop-color:red]">A</div>'
expect_block "R6B: [text-decoration:underline_red] — colour in a shorthand" \
  "one.astro" '<div class="[text-decoration:underline_red]">A</div>'
expect_block "R6B: style=\"border-top-color:red\" — 2d, by the prop list not by accident" \
  "one.astro" '<div style="border-top-color:red">A</div>'
expect_allow "R6B: [color:var(--role-ink)] — the token-routed form still passes" \
  "one.astro" '<div class="[color:var(--role-ink)]">A</div>'
expect_allow "R6B: [border-radius:8px] — a widened prefix must not flag geometry" \
  "one.astro" '<div class="[border-radius:8px]">A</div>'
expect_allow "R6B: style=\"background-position:50% 50%\"" \
  "one.astro" '<div style="background-position:50% 50%">A</div>'

# --- coordinator adjudication R6C: Tailwind's per-side/axis border and ---
# divide colour utilities are their own prefixes; `border-[` cannot see them.
expect_block "R6C: border-t-[#f00]" \
  "one.astro" '<div class="border-t-[#f00]">A</div>'
expect_block "R6C: border-e-[red] — logical side, the RTL-correct spelling" \
  "one.astro" '<div class="border-e-[red]">A</div>'
expect_block "R6C: divide-x-[#f00]" \
  "one.astro" '<div class="divide-x-[#f00]">A</div>'
expect_allow "R6C: border-t-[var(--role-hairline)] — token-routed side colour" \
  "one.astro" '<div class="border-t-[var(--role-hairline)]">A</div>'
expect_allow "R6C: border-t-[2px] — a side WIDTH is not a colour" \
  "one.astro" '<div class="border-t-[2px]">A</div>'

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
