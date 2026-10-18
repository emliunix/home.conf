#!/usr/bin/env bash
# Clean-consumer install witness for #50: a FRESH repo installs the hook from file:// and runs it.
set -uo pipefail
SRC=/tmp/qb-50
REV="$(git -C "$SRC" rev-parse HEAD)"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
cd "$W" || exit 1
git init -q && git config user.email c@c && git config user.name c
cat > .pre-commit-config.yaml <<YAML
repos:
  - repo: file://$SRC
    rev: $REV
    hooks:
      - id: privacy-scan
YAML
git add -A && git commit -qm base
echo "rev $REV"
python3 -c "import base64,os;print('api_key = sk-'+base64.b32encode(os.urandom(20)).decode().lower().rstrip('='))" > secret.txt
git add secret.txt
out=$(prek run 2>&1); rc=$?
echo "--- consumer output ---"; printf '%s\n' "$out" | grep -E "privacy scan|exit code|fp=|no staged|Passed" | head -4
echo "exit=$rc"
echo "leak=$(printf '%s' "$out" | grep -c FAKEconsumer)"
