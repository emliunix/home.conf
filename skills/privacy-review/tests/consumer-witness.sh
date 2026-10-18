#!/usr/bin/env bash
# Clean-consumer witness: a FRESH repository installs the hook from file:// and runs it.
#
# ⚠ TWO DEFECTS THIS REPLACES (#50 review):
#   1. it hardcoded /tmp/qb-50, so it proved one machine's scratch path rather than "a consumer";
#   2. its leak check grepped a FIXED string, so it reported zero leaks regardless of the fixture.
# Now the repo root is derived from this script, and the leak assertion compares captured output against
# the EXACT generated value.
set -uo pipefail
SRC="$(git -C "$(dirname "$0")/../../.." rev-parse --show-toplevel)"
REV="$(git -C "$SRC" rev-parse HEAD)"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
cd "$W" || exit 1
git init -q; git config user.email c@c; git config user.name c
printf 'repos:\n  - repo: file://%s\n    rev: %s\n    hooks:\n      - id: privacy-scan\n' "$SRC" "$REV" > .pre-commit-config.yaml

cp "$SRC/.gitleaks.toml" . 2>/dev/null || :
git add -A; git commit -qm base

value=$(python3 -c 'import base64,os;print("api_key = sk-"+base64.b32encode(os.urandom(20)).decode().lower().rstrip("="))')
printf '%s\n' "$value" > secret.txt
git add secret.txt
out=$(prek run 2>&1); rc=$?
echo "red arm  exit=$rc"
printf '%s\n' "$out" | grep -E "privacy scan|privacy-gate" | head -3
# ⚠ THE EXACT GENERATED VALUE, not a fixed string.
if printf '%s' "$out" | grep -qF -- "${value#api_key = }"; then echo "LEAK: output contained the value"; exit 1; fi
echo "leak=0"

git rm -q --cached secret.txt; rm -f secret.txt
echo "an ordinary change" > note.md; git add note.md
out=$(prek run 2>&1); echo "green arm exit=$?"
