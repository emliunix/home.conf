#!/usr/bin/env bash
# Copy the document spine into a new project or an existing subproject.
set -euo pipefail

target="${1:?usage: init.sh TARGET_DIR NAME}"
name="${2:?usage: init.sh TARGET_DIR NAME}"
if [[ ! "$name" =~ ^[a-z][a-z0-9-]*$ ]]; then
  printf 'NAME must be a lowercase project slug\n' >&2
  exit 2
fi

source_dir="$(cd "$(dirname "$0")/../init" && pwd)"
mkdir -p "$target"
while IFS= read -r -d '' source_file; do
  relative="${source_file#"$source_dir"/}"
  if [[ -e "$target/$relative" || -L "$target/$relative" ]]; then
    printf 'Refusing to overwrite %s\n' "$target/$relative" >&2
    exit 1
  fi
done < <(find "$source_dir" -type f -print0)

cp -R "$source_dir"/. "$target"/
perl -pi -e "s/skeleton-project/$name/g" "$target/pyproject.toml"
perl -pi -e "s/^# (?:Project|demo-proj) /# $name /g" \
  "$target/docs/architecture.md" "$target/docs/index.md"
printf 'Initialized %s without Git setup. Replace example claims before using the docs as law.\n' "$target"
target_abs="$(cd "$target" && pwd -P)"
git_root="$(git -C "$target_abs" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$git_root" && "$git_root" != "$target_abs" ]]; then
  printf 'Subproject: wire .doc-verify.yaml and the hook at Git root %s; do not use nested Git.\n' "$git_root"
fi
