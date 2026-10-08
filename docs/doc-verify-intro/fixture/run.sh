#!/bin/sh
# Re-run the deck's keyless demos: copy this fixture into a throwaway Git repository (doc-verify
# reads documents from Git) and check each document with home.conf's built engine.
# Usage, from the home.conf root after `npm ci && npm run build`:
#   sh docs/doc-verify-intro/fixture/run.sh
set -u
root=$(git rev-parse --show-toplevel)
cli="$root/doc-verify/dist/cli.js"
work=$(mktemp -d)
cp -R "$(dirname "$0")/." "$work/"
rm -f "$work/run.sh"
cd "$work" || exit 1
git init -q && git add -A && git -c user.name=demo -c user.email=demo@example.invalid commit -qm fixture
for doc in docs/good.md docs/bad.md docs/decisions.md; do
  echo "== $doc"
  node "$cli" check --paths "$doc"
  echo "exit $?"
done
rm -rf "$work"
