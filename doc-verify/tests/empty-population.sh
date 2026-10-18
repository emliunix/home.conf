#!/usr/bin/env bash
# An empty staged population: the CLI refuses, the pre-commit hook does not block.
#
# Why this exists (#38). `check --staged` with a clean index finds zero artifacts -- the NORMAL
# state of a docs-only commit. `combineVerdicts([])` used to return PASS, so the engine reported a
# clean corpus it had never looked at. It now returns BLOCKED (exit 3).
#
# ⚠ AND THAT IS WHY THIS ARM EXISTS: the fix would otherwise block every docs-only commit. #27's
# settled policy is that pre-commit WARNS and pre-push BLOCKS, so the wrapper maps BLOCKED to 0 at
# the commit stage -- and the verdict must still print, or "warns" silently becomes "passes".
#
# Both halves are asserted here because either alone is a failure:
#   engine refuses  -> nothing is silently green
#   hook does not   -> a normal docs commit is still makeable
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected [$2] got [$3]"; fail=1; fi
}

# The arm is only meaningful on an empty index; say so rather than measuring something else.
staged="$(git diff --cached --name-only | wc -l | tr -d ' ')"
check "precondition: empty index" "0" "$staged"

cli_out="$(mktemp)"; hook_out="$(mktemp)"
set +e
node doc-verify/dist/cli.js check --staged --profile auto --format text >"$cli_out" 2>&1
cli=$?
set -e
check "direct CLI refuses" "3" "$cli"
grep -q "^BLOCKED" "$cli_out" && check "CLI names BLOCKED" "yes" "yes" || check "CLI names BLOCKED" "yes" "no"

set +e
node scripts/run-document-contracts.mjs --auto-setup --stage pre-commit >"$hook_out" 2>&1
hook=$?
set -e
check "pre-commit hook does not block" "0" "$hook"
grep -qi "BLOCKED" "$hook_out" && check "hook still prints the verdict" "yes" "yes" \
  || check "hook still prints the verdict" "yes" "no"
grep -qi "not refused" "$hook_out" && check "hook states it did not refuse" "yes" "yes" \
  || check "hook states it did not refuse" "yes" "no"

# ⚠ THE EXTERNAL STAGE IS A THIRD CONTRACT (#38, @CowBoy's finding). A consumer's hook must keep
# blocking on a REAL finding -- `remote-hook.sh` asserts that -- while not failing a docs-only commit
# on an empty selection. Checking only the local wrapper was why my first version stayed green while
# it broke every consumer with MODULE_NOT_FOUND.
ext_out="$(mktemp)"
set +e
node doc-verify/dist/cli.js check --staged --stage external --profile auto --format text >"$ext_out" 2>&1
ext=$?
set -e
check "external stage does not fail an empty selection" "0" "$ext"
grep -qi "nothing was evaluated" "$ext_out" && check "external stage says why" "yes" "yes" \
  || check "external stage says why" "yes" "no"

# A REAL finding still blocks under the external stage. Measured through the CLI on a throwaway repo
# built from the shipped fixture -- the same way a consumer would meet it. Importing the CLI is not an
# option: import runs main and prints usage instead of evaluating the policy.
finding_dir="$(mktemp -d)"
cp -R "$root/docs/doc-verify-intro/fixture/." "$finding_dir/"
rm -f "$finding_dir/run.sh"
git -C "$finding_dir" init -q
git -C "$finding_dir" -c user.email=t@t -c user.name=t add -A
git -C "$finding_dir" -c user.email=t@t -c user.name=t commit -qm fixture
ext2_out="$(mktemp)"
set +e
(cd "$finding_dir" && node "$root/doc-verify/dist/cli.js" check --paths docs/bad.md \
  --stage external --profile draft --format text) >"$ext2_out" 2>&1
ext2=$?
set -e
check "external stage keeps blocking on a real finding" "1" "$ext2"
grep -qE "^(NO-GO|NEEDS-REVIEW)" "$ext2_out" && check "the finding is named" "yes" "yes" \
  || check "the finding is named" "yes" "no"
rm -rf "$finding_dir"

rm -f "$cli_out" "$hook_out" "$ext_out"
exit "$fail"
