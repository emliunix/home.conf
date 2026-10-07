#!/bin/sh
# Bootstrap a project from this template: ./bootstrap.sh TARGET_DIR NAME
set -eu
TARGET="${1:?usage: bootstrap.sh TARGET_DIR NAME}"
NAME="${2:?usage: bootstrap.sh TARGET_DIR NAME}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$TARGET"
cp -R "$HERE"/. "$TARGET"/
cd "$TARGET"
rm -f bootstrap.sh
[ -d .git ] || git init -q .
perl -pi -e "s/skeleton-project/$NAME/g" pyproject.toml
perl -pi -e "s/# Project — /# $NAME — /g" docs/architecture.md docs/index.md
git add -A
git -c user.email=bootstrap@local -c user.name=bootstrap commit -qm "Bootstrap from project-skeleton"
ln -sf "${HOME}/.config/doc-verify/credentials.env" .env.doc-verify 2>/dev/null || true
echo "bootstrapped $TARGET — run: doc-verify check --all && pytest -q"
