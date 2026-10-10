#!/bin/sh
# Two lint-time content guards that ESLint cannot express on its own.
# Wired into `npm run lint` (see root package.json). Both scan plain text
# with grep, so they see raw Astro template markup — not just the
# JavaScript/TypeScript AST that ESLint's no-restricted-syntax rule is
# limited to.
#
# GUARD 1 (hard rule 3 backstop): no `http://`/`https://` literal under
# web/src/, except web/src/config.ts (the one file allowed to write
# SITE_URL). eslint.config.js's `no-restricted-syntax` rule already blocks
# most of this in TS/frontmatter *expressions* (a JS `Literal` AST node —
# and in this eslint-plugin-astro version, also quoted HTML attribute
# values), but it cannot see plain template TEXT content, and it never
# matches a TemplateLiteral (a backtick string), so a Sanity client config
# written as `https://${projectId}.apicdn.sanity.io` slips past ESLint
# entirely. This guard is the text-level backstop for all of that.
# Verify with: npm run test:lint-guards (the Guard 1 section; assertions
# tagged I3, I6, N1, N5, M13, A5).
#
# Guard 1 scans .astro/.ts/.tsx/.jsx/.js/.mjs/.css — deliberately NOT
# .md/.mdx. Guard 2 (below) scans .md/.mdx because Tailwind's `@source`
# glob generates utility classes from markdown, but that rationale has no
# bearing on hardcoded origins: an ordinary external link in prose, e.g.
# `[the official page](https://example.com)` in a future content
# collection, is not a hard-rule-3 violation and must not need guard-ok on
# every outbound link.
# Verify with: npm run test:lint-guards (assertions tagged N2, N5, A5).
#
# GUARD 2 (token-contract backstop): the token contract clears Tailwind's
# default color/font namespaces, but that only removes the *convenient*
# path to a raw color. Tailwind 4's arbitrary-value syntax
# (`bg-[#ff0000]`, `bg-[oklch(0.7_0.2_30)]`, `bg-[rgb(255,0,0)]`,
# `bg-[red]`, `font-[Comic_Sans]`), its BARE arbitrary-property syntax
# (`class="[color:red]"`, which needs no utility prefix at all),
# raw-pixel/rem/em arbitrary spacing (`p-[13px]`, `mt-[2rem]`,
# `tracking-[0.05em]`), and inline `style="color:#f00"` (single- or
# double-quoted, or a `{}` expression attribute) all bypass the contract
# entirely and were never blocked by clearing the namespaces. This guard
# rejects all of that.
# Verify with: npm run test:lint-guards (the Guard 2 section; assertions
# tagged M10, N3, A3..A6, B1..B9, R5A..R5D).
#
# Guard 2 scans .astro/.ts/.tsx/.jsx/.js/.mjs/.md/.mdx — .md/.mdx because
# a content collection body under web/src/ is picked up by the `@source`
# glob in web/src/styles/global.css and really does reach the shipped
# CSS. .css itself is excluded: web/src/styles/ is where token *values*
# legitimately live in CSS, but only .css files there are exempt — an
# .astro/.md file that happens to sit under web/src/styles/ is still
# scanned like anywhere else.
# Verify with: npm run test:lint-guards (assertions tagged C1, N2, N5,
# I4/I5, A5, plus "raw hex in a real .css file is untouched").
#
# Colour detection (2a: Tailwind bracket utilities on colour-bearing
# prefixes; 2d: inline style="..." colour/shorthand properties; 2e:
# Tailwind's bare `[prop:value]` arbitrary properties) is a
# DENYLIST with exceptions, not an allowlist of colour forms. An
# allowlist of hex + named colour-function calls was tried first and
# defeated three ways: CSS function names are case-insensitive
# (`RGB(...)`), Tailwind's underscore-as-space convention lets a function
# call start with `_` (`bg-[_rgb(...)]`), and CSS has ~148 named colours
# (`bg-[red]`, `style="color:red"`) that no partial list should pretend to
# cover. Rejecting anything that isn't one of a small set of NON-colour
# shapes closes all three at once, without enumerating colour forms.
# Verify with: npm run test:lint-guards (assertions tagged N3, A4, B2,
# R5B, R5C).
#
# A value is never judged as one opaque string. It is split into TOKENS
# first — on `_` (Tailwind's encoding of a space) and on `,` (CSS's list
# separator) for 2a and 2e, on whitespace and `,` for 2d — and EVERY
# token must be a non-colour shape for the value to pass. Judging the
# whole string let a colour ride along inside an otherwise-innocent value
# (`shadow-[0_0_10px_#ff0000_0_0_1px]`, `bg-[image:linear-gradient(red,blue)]`).
# The same went for judging any token by its PREFIX alone:
# `url(/a.png)#abc` was accepted on the strength of its `url(`, with the
# `#abc` after the real closing paren never looked at. Nothing is
# accepted as proof for more of the value than it actually covers.
#
# The split happens at parenthesis depth 0 ONLY, so a function call
# survives as a single token and is judged as a call. Splitting blind on
# `,` tore `linear-gradient(var(--a),var(--b))` into two unrecognisable
# halves and blocked a fully token-routed gradient — the correct
# remediation of a real violation — with no compliant rewrite available.
# Verify with: npm run test:lint-guards (assertions tagged B1..B6, B9,
# R5A, R5C).
#
# The non-colour shapes a single TOKEN may take (case-insensitive):
#   - a number, with an optional px/rem/em/% unit and an optional sign —
#     including a bare unitless number, which CSS shorthands use
#     constantly (`border:0`, `box-shadow:0 1px 2px ...`);
#   - `url(...)`, an image/fragment reference — and ONLY when the token
#     is exactly that, with nothing after the closing paren. Rejected
#     when the fragment is itself hex-colour-shaped (`url(#ff0000)`),
#     which is a colour in a url costume, and rejected when anything
#     follows the closing paren, that remainder being judged as its own
#     token (`url(/a.png)#abc`). `url(#some-gradient-id)` — a real SVG
#     paint-server reference — stays allowed;
#   - a gradient function (`linear-gradient(...)`, `radial-gradient`,
#     `conic-gradient` and the three `repeating-` variants): a container,
#     not a colour, so it is judged by RECURSING on its arguments, which
#     may additionally be gradient geometry (a direction/shape keyword or
#     an angle — none of those keywords is a CSS named colour). The list
#     is an allowlist of container functions, not a denylist of colour
#     functions: `rgb()`, `oklch()`, `color-mix()` and every other
#     unlisted call is still rejected outright, because recursing into an
#     arbitrary function would have laundered `rgb(255,0,0)` into three
#     innocent numbers;
#   - a Tailwind data-type hint (`length:`, `size:`, `image:`, ...): the
#     hint is STRIPPED and the remainder re-judged. A hint is not by
#     itself evidence that the value is not a colour — `bg-[size:red]`
#     and `bg-[image:linear-gradient(red,blue)]` are hints wrapped round
#     hardcoded colours;
#   - exactly `var(--name)` — the intended token indirection. A `var(`
#     appearing anywhere else does not launder what surrounds it: the
#     surrounding text is either an unlisted call, and rejected whole, or
#     a listed container whose OTHER arguments are each judged on their
#     own, so `linear-gradient(var(--a),red)` still blocks on its `red`;
#   - (2d only) a CSS keyword that legitimately appears in the shorthand
#     properties 2d scans: the CSS-wide keywords and `currentColor`, the
#     border-style keywords, and the background position/size/repeat/
#     attachment/origin keywords (`center`, `cover`, `no-repeat`, ...).
#     A `position/size` token is split on `/` and each half judged.
#     Needed because `style="fill:currentColor"`,
#     `style="border:1px solid currentColor"` and
#     `style="background:url(/hero.webp) center/cover no-repeat"` are all
#     token-safe forms this project's components write normally.
#
# Separately from the per-token check, a comma INSIDE a `var()` call's
# parentheses (`var(--x,#f00)`) rejects the whole value: Tailwind never
# needs a fallback for a project-defined token, and a literal colour in
# the fallback is the hardcoded value the contract forbids wearing the
# one costume this guard otherwise trusts. The test is scoped to the
# parentheses, so a comma used as CSS's real list separator
# (`shadow-[0_1px_2px_var(--a),0_2px_4px_var(--b)]`) is not affected.
# Verify with: npm run test:lint-guards (assertions tagged B8).
#
# `from`/`via`/`to` (gradient stops) ARE in 2a's prefix list. The
# per-token percentage allowance distinguishes a stop POSITION from a
# stop COLOUR, so `from-[30%]` passes while `from-[red]` blocks — verify
# with: npm run test:lint-guards (assertions tagged B7).
#
# The spacing pattern (2c) stays a separate, plain allowlist of prefixes
# and units: units are a genuinely small, bounded set (px/rem/em), unlike
# colour forms, and 2c's own prefix list (which includes `text`/`border`,
# also colour-bearing prefixes in 2a) is independent of 2a's ALLOW logic
# above — by design the two patterns can both fire on the same non-colour
# value 2a wrongly thought was a colour, but with the ALLOW-list above,
# 2a now recognises `text-[13px]`/`border-[3px]` as non-colour shapes on
# its own and won't double-fire; 2c is the only one that flags them, as a
# spacing violation.
# Verify with: npm run test:lint-guards (assertions tagged M10, A3).
#
# Exemption: same convention as .githooks/pre-commit's `leak-ok` — append
#   guard-ok
# to a line that is a genuine false positive (a comment explaining the
# rule, e.g.) and it is skipped, with the exemption echoed to stderr so the
# bypass stays visible rather than silent. The most common genuine
# exception for Guard 1 is JSON-LD's `"@context": "https://schema.org"` —
# that IS a hardcoded origin and the guard is right to block it; append
# guard-ok to that line rather than treating the block as a bug.
# Verify with: npm run test:lint-guards (the two "guard-ok marker exempts
# a genuine false positive" assertions, and M13).
#
# xmlns namespace URIs (xmlns="http://www.w3.org/2000/svg",
# xmlns:xlink='http://www.w3.org/1999/xlink') are exempted, but only the
# xmlns(:prefix)?="..."/'...' substring itself — not the whole line — is
# stripped before testing, so a real origin sharing a line with an xmlns
# attribute (e.g. an inline SVG sprite followed by a hardcoded <link> on
# the same line) still blocks.
# Verify with: npm run test:lint-guards (assertions tagged N1, I6).
#
# This file must stay POSIX sh: it runs under whatever /bin/sh is, which
# is bash in sh-mode on macOS and dash on Debian/Ubuntu, and dash rejects
# constructs bash accepts. Verify with: GUARD_SH=dash npm run
# test:lint-guards, which re-runs the whole suite with the guard itself
# invoked via dash (running the HARNESS under dash does not test this —
# the harness always starts the guard as a separate /bin/sh process).
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# LINT_GUARD_SRC lets the test suite (tests/lint/lint-guards.test.sh) point
# this at an isolated fixture directory instead of the real web/src, so
# planted violations never touch the actual source tree. It overrides a
# DIRECTORY, not behaviour: every assertion runs the production script.
# Verify with: npm run test:lint-guards (every assertion in the file goes
# through it).
SRC="${LINT_GUARD_SRC:-$ROOT/web/src}"
FAIL=0

# $SRC, escaped for safe interpolation into an ERE (a checkout path
# containing '.', '[', '*', '+', etc. would otherwise corrupt the
# config.ts anchor below and could either miss the real exemption or
# accidentally exempt something else).
# Verify with: npm run test:lint-guards (the "regex-metacharacter
# checkout path" assertion).
SRC_RE=$(printf '%s' "$SRC" | sed -e 's/[]\.\[(){}?+*^$|\\]/\\&/g')

# Guard 1 deliberately excludes *.md/*.mdx (see the module docstring's
# GUARD 1 section for why). Guard 2 includes them but excludes *.css.
# Verify with: npm run test:lint-guards (assertions tagged N2, C1, A5,
# one per extension per guard).
GUARD1_INCLUDES="--include=*.astro --include=*.ts --include=*.tsx --include=*.jsx --include=*.js --include=*.mjs --include=*.css"
GUARD2_INCLUDES="--include=*.astro --include=*.ts --include=*.tsx --include=*.jsx --include=*.js --include=*.mjs --include=*.md --include=*.mdx"

# Prints "BLOCKED (label): ..." for every match found ($2), one per line.
# Verify with: npm run test:lint-guards (the "one line with two colour
# violations is reported once" assertion inspects this output directly).
report_hits() {
  LABEL="$1"
  HITS="$2"
  if [ -n "$HITS" ]; then
    printf 'BLOCKED (%s):\n' "$LABEL" >&2
    printf '%s\n' "$HITS" | sed 's/^/  /' >&2
    FAIL=1
  fi
}

# Announces every guard-ok exemption on stderr (visibility, matching
# leak-ok's convention), then returns the same match set with exempted
# lines removed.
# Verify with: npm run test:lint-guards (the two "guard-ok marker exempts
# a genuine false positive" assertions, one per guard).
filter_exemptions() {
  printf '%s\n' "$1" | grep 'guard-ok' 2>/dev/null | while IFS= read -r LINE; do
    printf 'guard-ok exemption: %s\n' "$LINE" >&2
  done || true
  printf '%s\n' "$1" | grep -v 'guard-ok' 2>/dev/null || true
}

# Guard 1 only: drops a "path:line:content" hit if the only reason it
# matched https?:// is an xmlns(:prefix)?="..."/'...' namespace URI on
# that line. Strips just that substring (both quote styles, with or
# without a "xmlns:xlink"-style prefix) and re-tests the remainder, so a
# real origin sharing the line with an xmlns attribute still blocks.
# Verify with: npm run test:lint-guards (assertions tagged N1, I6).
filter_xmlns() {
  printf '%s\n' "$1" | while IFS= read -r LINE; do
    [ -n "$LINE" ] || continue
    CONTENT=$(printf '%s\n' "$LINE" | sed -E 's/^[^:]*:[0-9]+://')
    SANITIZED=$(printf '%s\n' "$CONTENT" | sed -E \
      -e 's/xmlns(:[A-Za-z0-9_-]+)?="https?:\/\/[^"]*"//g' \
      -e "s/xmlns(:[A-Za-z0-9_-]+)?='https?:\/\/[^']*'//g")
    if printf '%s\n' "$SANITIZED" | grep -qE 'https?://'; then
      printf '%s\n' "$LINE"
    fi
  done
}

# True when a comma appears INSIDE a var() call's parentheses — the
# `var(--x,#f00)` fallback-laundering form. `[^)]*` cannot cross the
# closing paren, so a comma separating two independent values in a CSS
# list (`0_1px_2px_var(--a),0_2px_4px_var(--b)`) does not match.
# Verify with: npm run test:lint-guards (assertions tagged B8, R5B, R5C).
value_has_var_fallback() {
  printf '%s' "$1" | grep -qE 'var\([^)]*,'
}

# Splits a value into one token per line, breaking ONLY at parenthesis
# depth 0. $2 selects the separator set: "class" (default) splits on `_`
# (Tailwind's encoding of a space) and `,`; "style" splits on whitespace
# and `,`. Depth-awareness is what lets a function call survive as a
# single token so it can be judged as a call rather than as unrelated
# fragments — splitting blind on `,` made
# `linear-gradient(var(--a),var(--b))` look like `linear-gradient(var(--a`
# plus `var(--b))`, neither of which is a recognisable shape, so a fully
# token-routed gradient was rejected with no compliant rewrite.
# An unbalanced `)` does not push depth below 0.
# Verify with: npm run test:lint-guards (assertions tagged R5C).
split_top_level() {
  printf '%s' "$1" | awk -v mode="${2:-class}" '
    {
      d = 0
      out = ""
      n = length($0)
      for (i = 1; i <= n; i++) {
        c = substr($0, i, 1)
        if (c == "(") { d++; out = out c; continue }
        if (c == ")") { if (d > 0) d--; out = out c; continue }
        if (mode == "class") {
          issep = (c == "," || c == "_")
        } else {
          issep = (c == "," || c == " " || c == "\t")
        }
        if (d == 0 && issep) { out = out "\n" } else { out = out c }
      }
      print out
    }'
}

# Decides whether ONE token of a value (see the module docstring's token
# list) is a non-colour shape. Returns 0 (allowed) or 1 (treat as a
# possible colour, i.e. a violation) via exit status, so callers write
# `if token_is_allowed "$T"; then ... fi`. Every branch below is an
# allowance; anything reaching the bottom is rejected.
# Verify with: npm run test:lint-guards (assertions tagged B1..B4, B7,
# R5A, R5C).
token_is_allowed() {
  T=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  # $2 is the SPLIT MODE ("class" or "style") and must be threaded through
  # every recursion below. Hardcoding "class" here made whitespace a
  # non-separator inside an inline gradient, so
  # `style="background:linear-gradient(var(--a), var(--b))"` — the correct
  # token-routed remediation — blocked while the space-free spelling passed.
  # Verify with: npm run test:lint-guards (assertions tagged R6A).
  T_MODE="${2:-class}"
  case "$T" in
    '') return 0 ;;
  esac
  # url(...): an image or fragment reference. Two separate rejections:
  # the fragment being itself hex-colour-shaped (`url(#ff0000)` — a
  # colour in a url costume, while `url(#some-gradient-id)`, a real SVG
  # paint-server reference, stays allowed), and ANY remainder after the
  # url's real closing paren. Stripping a *trailing* `)` and testing only
  # what was left discarded that remainder from judgement, so
  # `url(/a.png)#abc` — real shipping CSS, resolving to
  # `background: #abc url("/a.png") no-repeat` — passed on the strength of
  # its prefix. The remainder is now judged as a token of its own, and a
  # `url(` with no closing paren is not proof of anything and fails
  # closed.
  # Verify with: npm run test:lint-guards (assertions tagged B3, R5A).
  case "$T" in
    url\(*)
      U=${T#url\(}
      case "$U" in
        *\)*) ;;
        *) return 1 ;;
      esac
      AFTER=${U#*\)}
      U=${U%%\)*}
      if printf '%s' "$U" | grep -qE '^#[0-9a-f]{3,8}$'; then
        return 1
      fi
      token_is_allowed "$AFTER" "$T_MODE"
      return $?
      ;;
  esac
  # A gradient function is not itself a colour: it is a container whose
  # ARGUMENTS carry the colours. Judge it by recursing on those, the same
  # move the data-type hint below makes. The list is an allowlist of
  # container functions, NOT a denylist of colour functions: rgb(),
  # oklch(), color-mix() and friends are deliberately absent, so they
  # fall through to the reject at the bottom of this function. Recursing
  # into an arbitrary function would have laundered `rgb(255,0,0)` into
  # three innocent numbers.
  # Verify with: npm run test:lint-guards (assertions tagged R5C).
  case "$T" in
    linear-gradient\(*\) | radial-gradient\(*\) | conic-gradient\(*\) \
      | repeating-linear-gradient\(*\) | repeating-radial-gradient\(*\) \
      | repeating-conic-gradient\(*\))
      G_ARGS=${T#*\(}
      G_ARGS=${G_ARGS%\)}
      value_tokens_allowed "$G_ARGS" "$T_MODE" gradient
      return $?
      ;;
  esac
  # A Tailwind data-type hint says how Tailwind should INTERPRET the
  # value; it says nothing about whether the value is a colour. Strip it
  # and judge the remainder.
  # Verify with: npm run test:lint-guards (assertions tagged B2, R5C).
  case "$T" in
    length:* | width:* | number:* | percentage:* | position:* | size:* | image:*)
      token_is_allowed "${T#*:}" "$T_MODE"
      return $?
      ;;
  esac
  # Exactly a bare token reference. Anything with extra text around the
  # var() (e.g. `linear-gradient(var(--a),red)`) falls through and is
  # judged above as a call or rejected below.
  # Verify with: npm run test:lint-guards (assertions tagged N3, B4,
  # R5C).
  case "$T" in
    var\(--*\)) return 0 ;;
  esac
  if printf '%s' "$T" | grep -qE '^[+-]?([0-9]+(\.[0-9]+)?|\.[0-9]+)(px|rem|em|%)?$'; then
    return 0
  fi
  return 1
}

# One argument of a gradient function. Beyond the shapes any token may
# take, a gradient argument may describe the gradient's GEOMETRY — a
# direction/shape keyword or an angle. None of the keywords listed is a
# CSS named colour, and an angle cannot be one, so allowing them here
# cannot let a colour through; without them the correct remediation of a
# real gradient violation (`linear-gradient(to_right,var(--a),var(--b))`)
# would be rejected.
# Verify with: npm run test:lint-guards (assertions tagged R5C).
gradient_arg_is_allowed() {
  G=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  G_MODE="${2:-class}"
  case "$G" in
    to | at | in | from | circle | ellipse | left | right | top | bottom | center) return 0 ;;
    closest-side | closest-corner | farthest-side | farthest-corner) return 0 ;;
    # Interpolation colour SPACES and hue-interpolation keywords
    # (`linear-gradient(in oklch shorter hue, ...)`). A colour space is
    # not a colour: every colour form that names one wears parentheses
    # (`oklch(0.7 0.2 30)`), and a parenthesised call is a different
    # token shape that never reaches this list.
    # Verify with: npm run test:lint-guards (the two R5C `in_oklch`
    # assertions — the space alone passes, a colour IN it still blocks).
    srgb | srgb-linear | display-p3 | a98-rgb | prophoto-rgb | rec2020) return 0 ;;
    lab | oklab | lch | oklch | hsl | hwb | xyz | xyz-d50 | xyz-d65) return 0 ;;
    shorter | longer | increasing | decreasing | hue) return 0 ;;
  esac
  if printf '%s' "$G" | grep -qE '^[+-]?([0-9]+(\.[0-9]+)?|\.[0-9]+)(deg|grad|rad|turn)$'; then
    return 0
  fi
  token_is_allowed "$G" "$G_MODE"
}

# Splits a value with split_top_level ($2 = class|style) and requires
# every resulting token to pass: token_is_allowed by default,
# gradient_arg_is_allowed when $3 is "gradient", style_token_is_allowed
# when $3 is "style".
#
# The loop body runs in a SUBSHELL on purpose. It needs both IFS=newline
# (so only split_top_level's line breaks separate tokens — a token may
# legitimately contain a space or tab) and noglob (`set -f`, so a token
# containing `*` or `?` is judged as written instead of being pathname-
# expanded against whatever happens to sit in the invoking directory).
# Both settings are local to a subshell, which keeps them from leaking
# out of the recursive calls token_is_allowed makes back into here.
# Verify with: npm run test:lint-guards (assertions tagged R5C, R5D).
value_tokens_allowed() {
  (
    IFS='
'
    set -f
    for PART in $(split_top_level "$1" "${2:-class}"); do
      case "${3:-token}" in
        gradient) gradient_arg_is_allowed "$PART" "${2:-class}" || exit 1 ;;
        style) style_token_is_allowed "$PART" || exit 1 ;;
        *) token_is_allowed "$PART" "${2:-class}" || exit 1 ;;
      esac
    done
    exit 0
  )
}

# Decides whether a whole bracket VALUE (the content of a Tailwind
# arbitrary-value utility, e.g. "0_1px_2px_var(--x)" from
# "shadow-[0_1px_2px_var(--x)]" — WITHOUT the trailing "]") is free of
# hardcoded colours, by splitting it into depth-0 tokens on `_` and `,`
# and requiring every token to be an allowed shape.
# Verify with: npm run test:lint-guards (assertions tagged B1..B4, B7,
# B8, R5A, R5C).
value_is_allowed() {
  if value_has_var_fallback "$1"; then
    return 1
  fi
  value_tokens_allowed "$1" class token
}

# Guard 2a: Tailwind arbitrary bracket utility on a colour-bearing prefix
# whose value is not one of value_is_allowed()'s non-colour shapes. See
# the module docstring for why this is a denylist rather than an
# allowlist of colour forms.
# Verify with: npm run test:lint-guards (assertions tagged M10, N3, A3,
# B1..B4, B7, B8, R5A, R5C).
scan_color_prefix_denylist() {
  # The per-side/axis border and divide utilities are separate prefixes:
  # `border-t-[#f00]` is a valid Tailwind border-top-color and the bare
  # `border` alternative cannot see it, because the pattern needs
  # `<prefix>-[`.
  # Verify with: npm run test:lint-guards (assertions tagged R6C).
  COLOR_PREFIX_ALT='bg|text|border|border-t|border-r|border-b|border-l|border-x|border-y|border-s|border-e|fill|stroke|ring|ring-offset|shadow|outline|decoration|accent|caret|divide|divide-x|divide-y|placeholder|selection|from|via|to'
  TMP=$(mktemp)
  trap 'rm -f "$TMP"' EXIT
  # A1: pipe the file list through `while read`, not an unquoted `for FILE
  # in $(...)` — the latter word-splits on whitespace, so a checkout path
  # containing a space would silently make this the ONLY one of the four
  # 2a-2e checks that scans zero files (2b/2c/2d/2e each pass "$SRC"
  # quoted to a single grep -r, so they're unaffected).
  # Verify with: npm run test:lint-guards (the A1 assertion, "a checkout
  # path containing a space still blocks a colour violation").
  # shellcheck disable=SC2086
  grep -rlE $GUARD2_INCLUDES -- "\\b($COLOR_PREFIX_ALT)-\\[" "$SRC" 2>/dev/null | while IFS= read -r FILE; do
    [ -n "$FILE" ] || continue
    grep -noE "\\b($COLOR_PREFIX_ALT)-\\[[^]]*\\]" "$FILE" 2>/dev/null | while IFS=: read -r LN VAL; do
      [ -n "${LN:-}" ] || continue
      # `\[`, not a bare `[`: in a shell PATTERN a lone `[` opens a
      # bracket expression, and dash refuses to match an unterminated
      # one, so `${VAL#*[}` stripped nothing there and left the whole
      # `bg-[...]` utility as the "value" — which no allowed shape
      # matches, so every 2a ALLOW case turned into a BLOCK everywhere
      # /bin/sh is dash. bash's sh-mode tolerates the lone `[`, so the
      # suite passed on macOS throughout.
      # Verify with: GUARD_SH=dash npm run test:lint-guards (the whole
      # suite; the 2a ALLOW assertions tagged A3, B2, B3, B4, B7, B8,
      # R5A, R5C are the ones that fail without this).
      INNER="${VAL#*\[}"
      INNER="${INNER%]}"
      if value_is_allowed "$INNER"; then
        continue
      fi
      LINE_TEXT=$(sed -n "${LN}p" "$FILE" 2>/dev/null || true)
      printf '%s:%s:%s\n' "$FILE" "$LN" "$LINE_TEXT" >> "$TMP"
    done
  done
  # De-duplicate: a single line with two violating utilities (e.g.
  # "bg-[red] text-[white]") produces two identical FILE:LN:LINE_TEXT
  # rows above; report each such line once.
  # Verify with: npm run test:lint-guards (the "one line with two colour
  # violations is reported once, not twice" assertion).
  awk '!seen[$0]++' "$TMP" 2>/dev/null || true
  rm -f "$TMP"
  trap - EXIT
}

# 2d only. The CSS keywords that legitimately appear in the shorthand
# properties 2d scans (border/outline/box-shadow/background/...)
# alongside — or instead of — a colour. Does NOT handle a `/`; see
# style_token_is_allowed.
# Verify with: npm run test:lint-guards (assertions tagged A4, A6, B5,
# B6).
style_keyword_or_value_allowed() {
  K=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  case "$K" in
    '') return 0 ;;
    # CSS-wide keywords and currentColor.
    none | currentcolor | inherit | transparent | unset | initial | revert) return 0 ;;
    # Border / box-shadow styles.
    hidden | dotted | dashed | solid | double | groove | ridge | inset | outset) return 0 ;;
    # background-position / background-size.
    center | left | right | top | bottom | cover | contain | auto) return 0 ;;
    # background-repeat.
    no-repeat | repeat | repeat-x | repeat-y | space | round) return 0 ;;
    # background-attachment.
    scroll | fixed | local) return 0 ;;
    # background-origin / background-clip.
    border-box | padding-box | content-box) return 0 ;;
  esac
  token_is_allowed "$K" style
}

# 2d only. One whitespace-separated token of an inline style value.
# A `position/size` token (`center/cover`) is split on the slash and each
# half judged, EXCEPT for url(...), whose path legitimately contains
# slashes and is judged whole.
# Verify with: npm run test:lint-guards (assertions tagged B6, A6).
style_token_is_allowed() {
  case "$1" in
    [uU][rR][lL]\(*)
      token_is_allowed "$1" style
      return $?
      ;;
    */*)
      # `\012` (newline), not a space: this runs inside
      # value_tokens_allowed's subshell, where IFS is newline so that a
      # token may contain a space. Splitting on a space here would
      # produce one unsplit "center cover" token.
      # Verify with: npm run test:lint-guards (assertions tagged B6).
      for SLASH_PART in $(printf '%s' "$1" | tr '/' '\012'); do
        style_keyword_or_value_allowed "$SLASH_PART" || return 1
      done
      return 0
      ;;
  esac
  style_keyword_or_value_allowed "$1"
}

# The colour and colour-shorthand CSS properties that 2d (inline
# style=) and 2e (Tailwind's bare arbitrary-property syntax) both judge.
# Each alternative is anchored by the `:` that both patterns require
# after it, which is what stops `background` from matching the
# `background-image:` declaration — the alternation ORDER is irrelevant
# (POSIX ERE is leftmost-longest, not first-alternative-wins); only the
# `:` anchoring does that work.
# Verify with: npm run test:lint-guards (assertions tagged B9, R5B).
# `[-a-z]*color` is a SHAPE, not an enumeration: it covers color,
# background-color, border-top-color, text-emphasis-color, scrollbar-color,
# stop-color and -webkit-text-fill-color alike. Enumerating the longhands
# instead left `[border-top-color:red]` a one-word bypass of 2e.
# Verify with: npm run test:lint-guards (assertions tagged R6B).
STYLE_PROP_ALT='[-a-z]*color|background[-a-z]*|border[-a-z]*|outline[-a-z]*|text-decoration[-a-z]*|text-emphasis[-a-z]*|column-rule[-a-z]*|caret[-a-z]*|accent[-a-z]*|box-shadow|text-shadow|fill|stroke'

# Guard 2e: Tailwind 4's BARE arbitrary-property syntax,
# `class="[color:red]"`. Neither 2a nor 2d could see it: 2a requires a
# `prefix-[` and 2d requires a `style=` attribute, so this was a complete
# bypass of the token contract. The property must be colour-bearing
# (STYLE_PROP_ALT), `font-family`, or a custom property (`--name`, which
# can hold anything, so it is judged by its value); every other property
# (`[mask-type:luminance]`, `[aspect-ratio:16/9]`) is not this check's
# business. The value goes through the same value_is_allowed() machinery
# 2a uses. The pattern matches the BRACKET GROUP itself rather than
# anchoring on the start of the class, so leading variants
# (`md:[color:red]`, `hover:[color:red]`) are covered by construction.
# Verify with: npm run test:lint-guards (assertions tagged R5B).
scan_arbitrary_property_denylist() {
  ARB_PROP_ALT="--[A-Za-z0-9_-]+|font-family|$STYLE_PROP_ALT"
  # shellcheck disable=SC2086
  CANDIDATES=$(grep -rnoiE $GUARD2_INCLUDES -- "\\[($ARB_PROP_ALT)[[:space:]]*:[^]]*\\]" "$SRC" 2>/dev/null || true)
  [ -n "$CANDIDATES" ] || return 0
  printf '%s\n' "$CANDIDATES" | while IFS= read -r RAW_HIT; do
    [ -n "$RAW_HIT" ] || continue
    FILE=$(printf '%s' "$RAW_HIT" | sed -E 's/^([^:]*):[0-9]+:.*$/\1/')
    LN=$(printf '%s' "$RAW_HIT" | sed -E 's/^[^:]*:([0-9]+):.*$/\1/')
    OCC=$(printf '%s' "$RAW_HIT" | sed -E 's/^[^:]*:[0-9]+://')
    VAL=$(printf '%s' "$OCC" | sed -E 's/^\[[^:]*:[[:space:]]*//; s/\]$//')
    if value_is_allowed "$VAL"; then
      continue
    fi
    LINE_TEXT=$(sed -n "${LN}p" "$FILE" 2>/dev/null || true)
    printf '%s:%s:%s\n' "$FILE" "$LN" "$LINE_TEXT"
  done | awk '!seen[$0]++'
}

# Guard 2d: an inline style="..."/'...'/{...} attribute assigning a
# disallowed value to a colour or colour-shorthand property. Shorthand
# properties (background/border/outline/box-shadow) are checked
# token-by-token (split on whitespace) rather than as one opaque string,
# so `border:1px solid #ccc` is caught via its "#ccc" token without
# `border:1px solid currentColor` or `background:url(...)` being flagged.
# Case-insensitive throughout: CSS property/function/keyword names are
# case-insensitive (`COLOR:RGB(...)`).
# Verify with: npm run test:lint-guards (assertions tagged N3, A4, A6,
# B5, B6, B8, B9, R5A, R5C).
scan_style_color_denylist() {
  # shellcheck disable=SC2086
  CANDIDATES=$(grep -rnE $GUARD2_INCLUDES -- 'style[[:space:]]*=[[:space:]]*["'"'"'{]' "$SRC" 2>/dev/null || true)
  [ -n "$CANDIDATES" ] || return 0
  printf '%s\n' "$CANDIDATES" | while IFS= read -r LINE; do
    [ -n "$LINE" ] || continue
    CONTENT=$(printf '%s\n' "$LINE" | sed -E 's/^[^:]*:[0-9]+://')
    OCCURRENCES=$(printf '%s\n' "$CONTENT" | grep -ioE "($STYLE_PROP_ALT)[[:space:]]*:[[:space:]]*[^;\"'}]*" || true)
    [ -n "$OCCURRENCES" ] || continue
    HIT=0
    printf '%s\n' "$OCCURRENCES" | while IFS= read -r OCC; do
      [ -n "$OCC" ] || continue
      VAL=$(printf '%s\n' "$OCC" | sed -E 's/^[^:]*:[[:space:]]*//')
      if value_has_var_fallback "$VAL"; then
        echo hit
        continue
      fi
      # Split the value on whitespace and on `,` (CSS's list separator,
      # so a two-shadow box-shadow is judged shadow-part by
      # shadow-part) — at parenthesis depth 0 only, so a nested
      # `linear-gradient(var(--a),var(--b))` survives as one token and is
      # judged as the function call it is — and check each token: a
      # single colour property (color:, fill:, ...) yields exactly one
      # token; a shorthand (border:, box-shadow:, ...) yields several,
      # and only one of them needs to fail for the whole declaration to
      # block.
      # Verify with: npm run test:lint-guards (assertions tagged B5, B6,
      # B9, R5A, R5C, R5D).
      if ! value_tokens_allowed "$VAL" style style; then
        echo hit
      fi
    done | grep -q hit && HIT=1
    if [ "$HIT" -eq 1 ]; then
      printf '%s\n' "$LINE"
    fi
  done
}

[ -d "$SRC" ] || exit 0

echo "== Guard 1: hardcoded absolute origins under web/src/ (except config.ts) =="
# shellcheck disable=SC2086
RAW=$(grep -rnE $GUARD1_INCLUDES -- 'https?://' "$SRC" 2>/dev/null \
  | grep -vE "^$SRC_RE/config\.ts:" \
  || true)
HITS=$(filter_xmlns "$RAW")
HITS=$(filter_exemptions "$HITS")
report_hits "hardcoded absolute origin — import absoluteUrl() from src/config.ts instead. If this is JSON-LD's \"@context\": \"https://schema.org\", that block is correct (it IS a hardcoded origin); append guard-ok to that line rather than treating it as a false positive" "$HITS"

echo "== Guard 2: arbitrary-value color/font/spacing utilities and inline colour styles under web/src/ (.css excluded — styles/*.css is where token values legitimately live) =="

# All grep calls below put every option BEFORE the literal `--` that ends
# option parsing, with only the (possibly `-`-leading) pattern and nothing
# else after it. Putting `--` before options like --include would make
# grep treat those options as literal filenames instead — silently
# disabling them. That is a claim about grep, not about this file.
# Verify with (in a directory holding one .ts and one .md file, both
# containing an x):
#   grep -rn -- x '--include=*.ts' . ; echo "exit=$?"
# which reports `grep: --include=*.ts: No such file or directory` and
# then matches the .md file anyway, instead of honouring the include. The per-extension consequence of losing an
# --include is pinned by npm run test:lint-guards (assertions tagged
# A5, one fixture per extension per guard).

HITS=$(filter_exemptions "$(scan_color_prefix_denylist)")
report_hits "arbitrary colour value on a colour-bearing utility — use a design token class instead. Every token of the value (split on _ and ,) must be a non-colour shape: a number with an optional px/rem/em/% unit, url(...), or exactly var(--name); see the module docstring for the full list" "$HITS"

# 2b: Tailwind arbitrary font utility, e.g. font-[Comic_Sans].
# Verify with: npm run test:lint-guards (the "arbitrary font utility
# (font-[Comic_Sans])" assertion; R5B covers the bare
# `[font-family:...]` form, which has no `font-[` for this to match).
# shellcheck disable=SC2086
RAW=$(grep -rnE $GUARD2_INCLUDES -- '\bfont-\[[^]]+\]' "$SRC" 2>/dev/null || true)
HITS=$(filter_exemptions "$RAW")
report_hits "arbitrary font utility — use the font-{ui,display,...} token classes instead" "$HITS"

# 2c: Tailwind arbitrary utility with a raw px/rem/em number, covering
# spacing (p-[13px], mt-[2rem]), type scale (text-[13px], leading-[21px],
# tracking-[0.05em]), and the other single-value utilities that share the
# same bracket-number-unit shape (size, basis, translate, border width,
# rounded radius). This is a plain allowlist, unlike 2a: units are a
# small, genuinely bounded set. See the module docstring for how this
# relates to 2a's own (separate) non-colour allowance.
# Verify with: npm run test:lint-guards (assertions tagged M10, A3).
# shellcheck disable=SC2086
RAW=$(grep -rnE $GUARD2_INCLUDES -- '\b(m|p|mt|mb|ml|mr|mx|my|pt|pb|pl|pr|px|py|top|bottom|left|right|inset|gap|w|h|min-w|min-h|max-w|max-h|text|leading|tracking|space-x|space-y|size|basis|translate|border|rounded)-\[[0-9]+(\.[0-9]+)?(px|rem|em)\]' "$SRC" 2>/dev/null || true)
HITS=$(filter_exemptions "$RAW")
report_hits "arbitrary raw px/rem/em utility — use the spacing/type-scale token instead" "$HITS"

HITS=$(filter_exemptions "$(scan_style_color_denylist)")
report_hits "inline style= colour property or shorthand assigned a disallowed value — use a design token class instead" "$HITS"

HITS=$(filter_exemptions "$(scan_arbitrary_property_denylist)")
report_hits "Tailwind bare arbitrary property (class=\"[prop:value]\") setting a colour-bearing property, font-family or a custom property to a disallowed value — use a design token class, or reference the token via var(--role-...)" "$HITS"

if [ "$FAIL" -eq 1 ]; then
  cat >&2 <<'MSG'

A lint guard above blocked this. If it is a genuine false positive, append
guard-ok to that exact line (the exemption will be echoed above so it
stays visible). Guard 2 violations should instead move the value into
web/src/styles/*.css, where design-token values legitimately live (as a
raw .css file, not an .astro/.md file that happens to sit under styles/ —
those are still scanned), or reference the token via var(--role-...).
MSG
  exit 1
fi

echo "lint-guards: clean"
exit 0
