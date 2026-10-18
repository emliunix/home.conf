#!/usr/bin/env bash
# Clean-consumer witness: a FRESH repository installs the hook from file:// and runs it.
#
# ⚠ TWO DEFECTS THIS REPLACES (#50 review):
#   1. it hardcoded /tmp/qb-50, so it proved one machine's scratch path rather than "a consumer";
#   2. its leak check grepped a FIXED string, so it reported zero leaks regardless of the fixture.
# Now the repo root is derived from this script, and the leak assertion compares captured output against
# the EXACT generated value.
set -uo pipefail
# ⚠ AN ARM THAT PRINTS ITS EXIT BUT NEVER ASSERTS IT IS NOT A TEST (#50 review). Under `set -uo pipefail`
# the script exited 0 whatever its arms observed, so `owned-rule arm exit=0` printed and passed.
fail=0
want() {  # name want got
  if [ "$2" = "$3" ]; then echo "ok   $1 (exit $3)"; else echo "FAIL $1: exit $3, want $2"; fail=1; fi
}
SRC="$(git -C "$(dirname "$0")/../../.." rev-parse --show-toplevel)"
REV="$(git -C "$SRC" rev-parse HEAD)"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
cd "$W" || exit 1
git init -q; git config user.email c@c; git config user.name c
printf 'repos:\n  - repo: file://%s\n    rev: %s\n    hooks:\n      - id: privacy-scan\n' "$SRC" "$REV" > .pre-commit-config.yaml

# ⚠ NO CONFIG IS COPIED. The base config is HOOK-OWNED; copying it into the consumer was what hid
# the false-refusal defect (@CowBoy P1) -- the witness passed while a real consumer was refused.
git add -A; git commit -qm base

value=$(python3 -c 'import base64,os;print("api_key = sk-"+base64.b32encode(os.urandom(20)).decode().lower().rstrip("="))')
printf '%s\n' "$value" > secret.txt
git add secret.txt
# ⚠ `rc=$?` ON ITS OWN LINE. Inline `local out=$(cmd); echo $?` and `export out=$(cmd); echo $?`
# report the ASSIGNMENT status (0), not the command's -- @GameBoy measured both. Separate lines.
out=$(prek run 2>&1)
rc=$?
want "red arm" 1 "$rc"
printf '%s\n' "$out" | grep -E "privacy scan|privacy-gate" | head -3
# ⚠ THE EXACT GENERATED VALUE, not a fixed string.
if printf '%s' "$out" | grep -qF -- "${value#api_key = }"; then echo "LEAK: output contained the value"; exit 1; fi
echo "leak=0"

git rm -q --cached secret.txt; rm -f secret.txt

# ⚠ THE OWNED-RULE ARM IN THE NO-COPY CONSUMER. This is the arm that would have caught P1: the base
# config is hook-owned, and a consumer that copies nothing must still get a refusal for an owned class.
python3 -c 'print("host: buildcorp9" + "." + "internal")' > owned.txt
git add owned.txt
out=$(prek run 2>&1)
rc=$?
want "owned-rule arm" 1 "$rc"

git rm -q --cached owned.txt; rm -f owned.txt
echo "an ordinary change" > note.md; git add note.md
out=$(prek run 2>&1)
rc=$?
want "green arm" 0 "$rc"

echo
echo "witness failures: $fail"
exit $fail
