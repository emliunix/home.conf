#!/usr/bin/env bash
# Optional Git setup for a standalone skeleton, never for a nested subproject.
set -euo pipefail

target="${1:?usage: git.sh TARGET_DIR}"
target="$(cd "$target" && pwd -P)"
existing_root="$(git -C "$target" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$existing_root" && "$existing_root" != "$target" ]]; then
  printf 'Refusing nested Git setup inside %s\n' "$existing_root" >&2
  exit 1
fi

source_dir="$(cd "$(dirname "$0")/../git" && pwd)"
for file in .gitignore .pre-commit-config.yaml; do
  if [[ -e "$target/$file" || -L "$target/$file" ]]; then
    printf 'Refusing to overwrite %s\n' "$target/$file" >&2
    exit 1
  fi
done
cp "$source_dir/.gitignore" "$source_dir/.pre-commit-config.yaml" "$target"/
if [[ -z "$existing_root" ]]; then
  git -C "$target" init -q
fi
printf 'Git files installed in %s. No commit or hook installation was performed.\n' "$target"
