#!/usr/bin/env bash
# The `prepare` guard: it must skip outside a clone, and still install in the main checkout.
#
# Why this exists (#27). `prepare` compares `--git-dir` with `--git-common-dir` and runs
# `prek install --git-dir <common>` when they are equal. Outside a clone BOTH are the empty
# string, so `"" = ""` is true and the branch runs `prek install --git-dir ""`, which fails:
#
#   error: a value is required for '--git-dir <GIT_DIR>' but none was supplied   (exit 2)
#
# Because npm runs `prepare` on install, that made `npm install` fail outside a clone -- and
# `npm exec --package=github:emliunix/home.conf#<rev>` exits 2 with no output from d91d92ae on,
# which is why longway-pi-team could not bump its pin past 1e33af62.
#
# The guard is lifted verbatim from package.json and evaluated in three contexts. If package.json
# changes shape, this test fails rather than drifting.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
pkg="$root/package.json"

guard="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).scripts.prepare)' "$pkg")"

# Strip the leading `npm run build && `: this test is about the guard, not the build.
case "$guard" in
  "npm run build && "*) body="${guard#npm run build && }" ;;
  *)
    echo "prepare guard test: package.json prepare no longer starts with 'npm run build && ';" >&2
    echo "the test needs updating (this is not a document finding)" >&2
    exit 2
    ;;
esac

fails=0

# Evaluate the guard body in a directory, printing whether it would run prek install.
# A stub `prek` on PATH records that it was called instead of touching a real repo.
probe() {
  local where="$1" expect="$2"
  local tmp
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/prepare-guard.XXXXXX")"
  mkdir -p "$tmp/bin"
  cat >"$tmp/bin/prek" <<'STUB'
#!/usr/bin/env bash
# Record that the guard reached prek FIRST, then emulate the real failure on an empty path.
# The order matters: recording must not be lost to the exit that follows.
if [ "${1:-}" = "install" ] && [ "${2:-}" = "--git-dir" ]; then
  if [ -z "${3:-}" ]; then
    echo "__RAN__"
    echo "error: a value is required for '--git-dir <GIT_DIR>' but none was supplied" >&2
    exit 2
  fi
fi
echo "__RAN__"
STUB
  chmod +x "$tmp/bin/prek"

  local ran
  ran="$(
    cd "$where" || exit 1
    PATH="$tmp/bin:$PATH" bash -c "if false; then :; fi; $body" 2>/dev/null
  )"
  if [ "${ran:-}" = "__RAN__" ]; then
    got="ran"
  else
    got="skipped"
  fi
  if [ "$got" != "$expect" ]; then
    echo "prepare guard test: at $where expected '$expect', got '$got'" >&2
    fails=$((fails + 1))
  else
    echo "prepare guard test: $where -> $got (expected)"
  fi
  rm -rf "$tmp"
}

# 1. Outside any clone: both variables empty. MUST skip (this is the #27 defect).
#
# The precondition is ASSERTED, not assumed: an earlier version of this test passed with the
# defective guard because its "outside" directory turned out to sit inside a git repository,
# so both variables were equal and non-empty and the old guard correctly skipped. A test whose
# premise is unverified is the same false-negative this file exists to catch.
outside="$(mktemp -d "${TMPDIR:-/tmp}/prepare-outside.XXXXXX")"
for p in "$outside" "${TMPDIR:-/tmp}"; do
  if git -C "$p" rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "prepare guard test: $p is inside a git repository; the 'outside a clone' arm" >&2
    echo "cannot run there. Pick a scratch root outside every repository." >&2
    exit 2
  fi
done
# The stub must record the call BEFORE emulating the empty-path failure, and GIT_* is cleared so
# an enclosing session cannot make the directory look like a repo.
stubdir="$(mktemp -d "${TMPDIR:-/tmp}/prepare-stub.XXXXXX")"
mkdir -p "$stubdir/bin"
cat >"$stubdir/bin/prek" <<'STUB'
#!/usr/bin/env bash
if [ "${1:-}" = "install" ] && [ "${2:-}" = "--git-dir" ] && [ -z "${3:-}" ]; then
  echo "__RAN__"
  echo "error: a value is required for '--git-dir <GIT_DIR>' but none was supplied" >&2
  exit 2
fi
echo "__RAN__"
STUB
chmod +x "$stubdir/bin/prek"
ran_outside="$(
  cd "$outside" || exit 1
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR \
    PATH="$stubdir/bin:$PATH" bash -c "if false; then :; fi; $body" 2>/dev/null || true
)"
rm -rf "$stubdir"
if [ -n "$ran_outside" ]; then
  echo "prepare guard test: outside a clone the guard REACHED prek -- the #27 defect is present" >&2
  fails=$((fails + 1))
else
  echo "prepare guard test: outside a clone -> skipped (expected)"
fi
rm -rf "$outside"

# 2. A linked worktree: git-dir != git-common-dir. MUST skip (pre-existing intended behaviour:
#    only the main checkout installs hooks).
linked="$(mktemp -d "${TMPDIR:-/tmp}/prepare-linked.XXXXXX")"
git -C "$linked" init -q
git -C "$linked" config user.email test@example.invalid
git -C "$linked" config user.name "Doc Verify Test"
git -C "$linked" commit -q --allow-empty -m init
wt="${linked}-wt"
git -C "$linked" worktree add -q --detach "$wt"
probe "$wt" "skipped"
rm -rf "$linked" "$wt"

# 3. The main checkout of a clone: equal. MUST run, and MUST pass a non-empty --git-dir.
mainclone="$(mktemp -d "${TMPDIR:-/tmp}/prepare-main.XXXXXX")"
git -C "$mainclone" init -q
git -C "$mainclone" config user.email test@example.invalid
git -C "$mainclone" config user.name "Doc Verify Test"
git -C "$mainclone" commit -q --allow-empty -m init
probe "$mainclone" "ran"
rm -rf "$mainclone"

if [ "$fails" -ne 0 ]; then
  echo "prepare guard test: FAILED ($fails)" >&2
  exit 1
fi

echo "prepare guard test: PASS (outside skips / linked worktree skips / main checkout installs)"
