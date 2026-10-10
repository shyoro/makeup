#!/bin/sh
# Verifies .githooks/pre-commit blocks the patterns that must never enter a
# public repo, and allows ordinary content.
set -eu

HOOK="$(cd "$(dirname "$0")/../.." && pwd)/.githooks/pre-commit"
PASS=0
FAIL=0

# Runs the hook's content scanner against a literal string instead of a git
# index, so the test needs no repo state. The hook exposes this via
# SCAN_STDIN=1.
scan() { printf '%s\n' "$1" | SCAN_STDIN=1 sh "$HOOK" >/dev/null 2>&1; }

expect_block() {
  if scan "$2"; then
    printf 'FAIL: expected BLOCK for %s\n' "$1"; FAIL=$((FAIL+1))
  else
    printf 'ok: blocked %s\n' "$1"; PASS=$((PASS+1))
  fi
}

expect_allow() {
  if scan "$2"; then
    printf 'ok: allowed %s\n' "$1"; PASS=$((PASS+1))
  else
    printf 'FAIL: expected ALLOW for %s\n' "$1"; FAIL=$((FAIL+1))
  fi
}

expect_block "openai-style key"  'const k = "sk-abcdefghijklmnopqrstuvwxyz123456"' # leak-ok
expect_block "resend key"        'RESEND=re_abcdefghijklmnopqrstuvwx' # leak-ok
expect_block "google api key"    'KEY=AIzaSyA1234567890abcdefghijklmnopqrstuv' # leak-ok
expect_block "sanity token"      'TOKEN=skAbcdefghijklmnopqrstuvwxyz0123456789abcdefghij' # leak-ok
expect_block "email address"     'contact us at someone@example.com today' # leak-ok
expect_block "gmail address"     'to: person.name@gmail.com' # leak-ok

expect_allow "ordinary hebrew"   'שירי מאפרת מקצועית'
expect_allow "empty env var"     'CONTACT_TO='
expect_allow "fontsource import" 'import "@fontsource/assistant/hebrew-400-normal.css"'
expect_allow "marked exception"  'see docs@example.com for details # leak-ok'

# --- F3: generic credential assignment (covers Cloudflare, which has no
# distinguishing prefix, and any other prefix-less token). -----------------

expect_block "cloudflare-style api token" 'CF_API_TOKEN=AbCdEfGhIjKlMnOpQrStUvWxYz0123' # leak-ok
expect_block "generic secret assignment"  'secret: "ThisIsALongEnoughSecretValue123"' # leak-ok
expect_block "bearer credential"          'bearer: AbCdEfGhIjKlMnOpQrStUvWxYz012345' # leak-ok

expect_allow "short api_token value (not a credential)" 'API_TOKEN=short123'
expect_allow "real npm lockfile integrity hash" '"integrity": "sha512-1PYE5oj7v6vGE2AqrJHDRnFvHS4kOHL4NN9CepPeaEK4A2ldEzTAK3n6h9WPnQywgpMDzt5m6Mub3xsGaXHbBQ=="'

# --- F2: a leak-ok exemption must be visible on stderr, not silent. -------

expect_announced() {
  OUT=$(printf '%s\n' "$2" | SCAN_STDIN=1 sh "$HOOK" 2>&1 >/dev/null) || true
  if printf '%s\n' "$OUT" | grep -qF "leak-ok exemption: $2"; then
    printf 'ok: announced %s\n' "$1"; PASS=$((PASS+1))
  else
    printf 'FAIL: expected leak-ok exemption announcement for %s\n' "$1"; FAIL=$((FAIL+1))
  fi
}

expect_announced "marked exception is echoed to stderr" 'see docs@example.com for details # leak-ok'

# --- F1: staged binary/image paths (a path check, not a content check, so
# it gets its own scan function rather than bending scan() above). --------

scan_path() { printf '%s\n' "$1" | SCAN_PATHS=1 sh "$HOOK" >/dev/null 2>&1; }
scan_path_allow_binary() { printf '%s\n' "$1" | ALLOW_BINARY=1 SCAN_PATHS=1 sh "$HOOK" >/dev/null 2>&1; }

expect_block_path() {
  if scan_path "$2"; then
    printf 'FAIL: expected BLOCK for %s\n' "$1"; FAIL=$((FAIL+1))
  else
    printf 'ok: blocked %s\n' "$1"; PASS=$((PASS+1))
  fi
}

expect_allow_path() {
  if scan_path "$2"; then
    printf 'ok: allowed %s\n' "$1"; PASS=$((PASS+1))
  else
    printf 'FAIL: expected ALLOW for %s\n' "$1"; FAIL=$((FAIL+1))
  fi
}

expect_allow_path_with_escape() {
  if scan_path_allow_binary "$2"; then
    printf 'ok: allowed under ALLOW_BINARY=1 %s\n' "$1"; PASS=$((PASS+1))
  else
    printf 'FAIL: expected ALLOW under ALLOW_BINARY=1 for %s\n' "$1"; FAIL=$((FAIL+1))
  fi
}

expect_block_path "client jpeg"           'assets/client-before-after.jpg'
expect_block_path "uppercase extension"   'uploads/ClientPhoto.JPG'
expect_block_path "raw camera file"       'shoots/session1/IMG_0001.CR2'

expect_allow_path "svg icon path"         'assets/logo.svg'
expect_allow_path "source file path"      'src/components/Hero.astro'
expect_allow_path_with_escape "favicon needs the escape" 'public/favicon.png'

# --- N1: non-ASCII / space-containing paths must still be caught. These
# exercise check_one_path()'s matching logic directly via scan_path(); the
# real point of caring about git's quoting (quotePath / -z) only shows up
# once git itself is in the loop, which is what the R11 integration tests
# further below are for.

expect_block_path "hebrew-named jpeg"     'תמונה.jpg'
expect_block_path "path containing a space" 'client photos/shot 1.png'
expect_allow_path "hebrew-named source file" 'קומפוננטה.ts'

# --- N2: renamed/copied files land in the diff as their destination path
# under --diff-filter=ACMR (R/C are now included, not just A/M); a rename
# target ending in a blocked extension must still be caught.

expect_block_path "rename destination path" 'archive/logo-renamed-from-notes.jpg'

# --- R11: real-git integration tests. --------------------------------------
#
# Every test above drives scan_content()/scan_paths() directly via
# SCAN_STDIN=1 / SCAN_PATHS=1. Neither ever executes the hook's actual
# git-mode branch (the `git diff --cached -z --name-only
# --diff-filter=ACMRT` call and its NUL-aware read loop), so those tests
# would stay green even if that branch were reverted to `-c
# core.quotePath=false` / `--diff-filter=AM`, or removed outright. These
# tests drive a real `git commit` in a throwaway repo so a regression to
# the git-mode code itself would actually be caught.

SCRATCH=""
cleanup_scratch() {
  [ -n "$SCRATCH" ] && [ -d "$SCRATCH" ] && rm -rf "$SCRATCH"
}
trap cleanup_scratch EXIT INT TERM

SCRATCH=$(mktemp -d)
git -c init.defaultBranch=main init -q "$SCRATCH"
git -C "$SCRATCH" config user.email "leak-hook-test@example.com" # leak-ok
git -C "$SCRATCH" config user.name "leak-hook-test"
git -C "$SCRATCH" config core.hooksPath "$(dirname "$HOOK")"

# Setup step, not an assertion: seed a plain committed file so a later case
# can `git mv` it. Any failure here means the test rig itself is broken,
# not the hook under test.
printf 'some notes\n' > "$SCRATCH/notes.txt"
git -C "$SCRATCH" add notes.txt
if ! git -C "$SCRATCH" commit -q -m "seed commit for rename case" >/tmp/leak-hook-scratch.$$ 2>&1; then
  echo "FATAL: could not seed scratch repo for integration tests:" >&2
  cat /tmp/leak-hook-scratch.$$ >&2
  rm -f /tmp/leak-hook-scratch.$$
  exit 1
fi
rm -f /tmp/leak-hook-scratch.$$

# Runs `git commit` for real against whatever is currently staged in the
# scratch repo. $1 = description, $2 = block|allow, remaining args (if any)
# are passed through as extra environment assignments understood by `env`.
real_commit_case() {
  DESC="$1"
  EXPECT="$2"
  OUT_FILE="/tmp/leak-hook-scratch.$$"
  if (cd "$SCRATCH" && git commit -q -m "test: $DESC") >"$OUT_FILE" 2>&1; then
    COMMITTED=1
  else
    COMMITTED=0
  fi
  if [ "$EXPECT" = "block" ]; then
    if [ "$COMMITTED" -eq 0 ]; then
      printf 'ok: blocked %s (real git)\n' "$DESC"; PASS=$((PASS+1))
    else
      printf 'FAIL: expected BLOCK for %s (real git)\n' "$DESC"; FAIL=$((FAIL+1))
    fi
  else
    if [ "$COMMITTED" -eq 1 ]; then
      printf 'ok: allowed %s (real git)\n' "$DESC"; PASS=$((PASS+1))
    else
      printf 'FAIL: expected ALLOW for %s (real git):\n' "$DESC"; FAIL=$((FAIL+1))
      sed 's/^/  /' "$OUT_FILE"
    fi
  fi
  rm -f "$OUT_FILE"
  # Leave the repo ready for the next case: drop whatever is still staged
  # (a blocked commit leaves its file staged) without touching history.
  git -C "$SCRATCH" reset -q >/dev/null 2>&1 || true
}

# 1. Hebrew-named jpeg blocks (real git, real -z path).
printf 'fakejpegbytes' > "$SCRATCH/תמונה.jpg"
git -C "$SCRATCH" add "תמונה.jpg"
real_commit_case "hebrew-named jpeg" block

# 2. A literal double-quote in the path plus a .jpg extension blocks (R9:
# git always C-quotes '"', regardless of core.quotePath).
mkdir -p "$SCRATCH/sub"
QUOTE_NAME='sub/a"b.jpg'
printf 'fakejpegbytes' > "$SCRATCH/$QUOTE_NAME"
(cd "$SCRATCH" && git add "$QUOTE_NAME")
real_commit_case "double-quote path with .jpg extension" block

# 3. A path containing a space blocks.
mkdir -p "$SCRATCH/client photos"
printf 'fakepngbytes' > "$SCRATCH/client photos/shot 1.png"
(cd "$SCRATCH" && git add "client photos/shot 1.png")
real_commit_case "path containing a space" block

# 4. A git mv rename whose destination ends .jpg blocks (R10: diff-filter
# now includes R, and --name-only reports the destination path).
(cd "$SCRATCH" && git mv notes.txt client-photo-renamed.jpg)
real_commit_case "git mv rename destination is .jpg" block

# 5. A Hebrew-named .ts source file commits fine.
printf 'export const x = 1;\n' > "$SCRATCH/קומפוננטה.ts"
git -C "$SCRATCH" add "קומפוננטה.ts"
real_commit_case "hebrew-named .ts source file" allow

# 6. A plain source file commits fine.
printf 'export const y = 2;\n' > "$SCRATCH/plain.ts"
git -C "$SCRATCH" add plain.ts
real_commit_case "plain source file" allow

# 7. ALLOW_BINARY=1 lets an image through, but a secret staged in the same
# commit still blocks — proving the escape only suppresses the path check,
# not the content scan.
mkdir -p "$SCRATCH/public"
printf 'fakepngbytes' > "$SCRATCH/public/favicon.png"
printf 'leaked = "sk-abcdefghijklmnopqrstuvwxyz123456"\n' > "$SCRATCH/secret.txt" # leak-ok
git -C "$SCRATCH" add public/favicon.png secret.txt
OUT_FILE="/tmp/leak-hook-scratch.$$"
if ALLOW_BINARY=1 sh -c "cd \"$SCRATCH\" && git commit -q -m 'test: allow_binary with secret present'" >"$OUT_FILE" 2>&1; then
  printf 'FAIL: expected BLOCK (secret) even under ALLOW_BINARY=1 (real git)\n'; FAIL=$((FAIL+1))
else
  if grep -q 'OpenAI-style key' "$OUT_FILE"; then
    printf 'ok: blocked secret under ALLOW_BINARY=1 while image was exempted (real git)\n'; PASS=$((PASS+1))
  else
    printf 'FAIL: blocked for the wrong reason under ALLOW_BINARY=1 (real git):\n'; FAIL=$((FAIL+1))
    sed 's/^/  /' "$OUT_FILE"
  fi
fi
rm -f "$OUT_FILE"
git -C "$SCRATCH" reset -q >/dev/null 2>&1 || true

# --- P1/P2: POSIX-sh portability. ------------------------------------------
#
# Every test above (including the R11 integration cases) invokes the hook as
# `sh "$HOOK"`, and on macOS /bin/sh is bash 3.2. That hid a Critical bug for
# four rounds: the git-mode path loop used `while IFS= read -r -d '' P`, and
# `read -d` is a bash/ksh extension. dash — which is /bin/sh on Debian,
# Ubuntu and most Linux CI images — rejects it with "read: Illegal option
# -d". Because a failing `read` is the normal way a `while read` loop
# terminates rather than a command failure, `set -eu` does NOT catch it: the
# loop body never ran, the staged-path guard scanned zero files, and the hook
# exited 0. Every client photograph would have committed cleanly.
#
# So these cases run the hook under a shell that is explicitly NOT bash.
# If dash is unavailable the skip is printed loudly rather than silently,
# because a silent skip is how this class of bug survives.

PORT_SH=$(command -v dash 2>/dev/null || true)

if [ -z "$PORT_SH" ]; then
  printf 'SKIP: dash not installed, portability case not verified\n'
  printf 'SKIP: the hook was only exercised under %s\n' "$(command -v sh)"
else
  # P1 — unit assertion on the NUL-splitting idiom itself, under dash. This
  # fails immediately if a future agent reintroduces `read -d`, rather than
  # at commit time on someone else's machine.
  IDIOM_OUT=$("$PORT_SH" -c 'printf "a\0b\0" | tr "\0" "\n" | while IFS= read -r P; do printf "SAW:[%s]\n" "$P"; done' 2>&1 || true)
  if [ "$IDIOM_OUT" = "$(printf 'SAW:[a]\nSAW:[b]')" ]; then
    printf 'ok: NUL-splitting idiom works under dash (tr + POSIX read)\n'; PASS=$((PASS+1))
  else
    printf 'FAIL: NUL-splitting idiom broken under dash, got: %s\n' "$IDIOM_OUT"; FAIL=$((FAIL+1))
  fi

  # And assert the bashism it replaced really is rejected by dash, so the
  # test above is known to be testing something that matters.
  BASHISM_OUT=$("$PORT_SH" -c 'printf "a\0b\0" | while IFS= read -r -d "" P; do printf "SAW:[%s]\n" "$P"; done' 2>&1 || true)
  if printf '%s\n' "$BASHISM_OUT" | grep -qi 'illegal option'; then
    printf 'ok: dash rejects the read -d bashism (guard test is meaningful)\n'; PASS=$((PASS+1))
  else
    printf 'FAIL: expected dash to reject read -d, got: %s\n' "$BASHISM_OUT"; FAIL=$((FAIL+1))
  fi

  # P2 — run the hook's real git-mode path scan under dash against a real
  # staged image in the scratch repo. This is the case that was broken.
  # Invoked as `$PORT_SH "$HOOK"` rather than via `git commit`, because git
  # honours the hook's shebang and would give us bash again.
  port_hook_case() {
    DESC="$1"
    EXPECT="$2"
    OUT_FILE="/tmp/leak-hook-port.$$"
    if (cd "$SCRATCH" && "$PORT_SH" "$HOOK") >"$OUT_FILE" 2>&1; then
      PASSED_HOOK=1
    else
      PASSED_HOOK=0
    fi
    # An "Illegal option" / syntax complaint means the hook is not POSIX sh,
    # regardless of the exit status it happened to produce.
    if grep -qiE 'illegal option|bad option|not found: |syntax error|unexpected' "$OUT_FILE"; then
      printf 'FAIL: hook is not POSIX sh, dash complained for %s:\n' "$DESC"; FAIL=$((FAIL+1))
      sed 's/^/  /' "$OUT_FILE"
    elif [ "$EXPECT" = "block" ]; then
      if [ "$PASSED_HOOK" -eq 0 ]; then
        printf 'ok: blocked %s (dash, git mode)\n' "$DESC"; PASS=$((PASS+1))
      else
        printf 'FAIL: expected BLOCK for %s (dash, git mode)\n' "$DESC"; FAIL=$((FAIL+1))
      fi
    else
      if [ "$PASSED_HOOK" -eq 1 ]; then
        printf 'ok: allowed %s (dash, git mode)\n' "$DESC"; PASS=$((PASS+1))
      else
        printf 'FAIL: expected ALLOW for %s (dash, git mode):\n' "$DESC"; FAIL=$((FAIL+1))
        sed 's/^/  /' "$OUT_FILE"
      fi
    fi
    rm -f "$OUT_FILE"
    git -C "$SCRATCH" reset -q >/dev/null 2>&1 || true
  }

  # A staged image must block under dash. Under `read -d` this exited 0.
  git -C "$SCRATCH" reset -q >/dev/null 2>&1 || true
  printf 'fakejpegbytes' > "$SCRATCH/portability-client-photo.jpg"
  git -C "$SCRATCH" add portability-client-photo.jpg
  port_hook_case "staged jpeg" block

  # A Hebrew-named image too, so the -z quoting behaviour is also covered
  # under dash and not only under bash.
  printf 'fakejpegbytes' > "$SCRATCH/דש-תמונה.jpg"
  git -C "$SCRATCH" add "דש-תמונה.jpg"
  port_hook_case "hebrew-named jpeg" block

  # And an ordinary source file must still pass under dash — proving the
  # loop actually runs and reaches a clean verdict, rather than the block
  # above coming from a shell error that happened to be non-zero.
  printf 'export const z = 3;\n' > "$SCRATCH/portability-plain.ts"
  git -C "$SCRATCH" add portability-plain.ts
  port_hook_case "plain source file" allow

  # The content scan must also work under dash, not just the path scan.
  if printf 'k = "sk-abcdefghijklmnopqrstuvwxyz123456"\n' | SCAN_STDIN=1 "$PORT_SH" "$HOOK" >/dev/null 2>&1; then # leak-ok
    printf 'FAIL: expected BLOCK for openai-style key (dash, content scan)\n'; FAIL=$((FAIL+1))
  else
    printf 'ok: blocked openai-style key (dash, content scan)\n'; PASS=$((PASS+1))
  fi
fi

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
