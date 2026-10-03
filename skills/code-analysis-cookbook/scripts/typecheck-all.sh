#!/bin/sh
# typecheck-all -- run every workspace package's typecheck and report each one.
#
# WHY THIS EXISTS. Every package declares a `typecheck` script and the
# control-plane tsconfig includes `test/**/*.ts`, but no entry in
# `scripts/check-all.mjs` runs any of them. So `pnpm check` can report
# `10 checks, 0 failed` while a package does not compile -- including its tests,
# which runtime suites cannot catch because `node --test` strips types.
#
# This is the non-gate form: it changes no repository gate. Wiring a `typecheck`
# entry into `check-all.mjs` is a separate decision and a separate card.
#
# USAGE
#   sh scripts/local/typecheck-all.sh          # from the repo root
#
# EXIT
#   0  every package compiled
#   1  at least one package reported errors
#
# READING THE OUTPUT. Errors are attributed to the FILE that carries them, which
# may belong to a DIFFERENT package than the one being checked: a workspace
# package exposes `./src/index.ts` through its `exports`, so an imported
# dependency's file is compiled as part of the importing package. Group by file
# before assigning blame.
#
# A known pre-existing error on this host belongs to #64
# (`impl/build-service/src/listener.ts`: `AddressInfo` is declared in `node:net`,
# not `node:http`). It surfaces in three packages. Do not attribute it to
# whoever adds a typecheck entry.

set -u

TSC="./node_modules/.bin/tsc"
if [ ! -x "$TSC" ]; then
  echo "typecheck-all: $TSC not found -- run 'pnpm install' first" >&2
  exit 1
fi

failed=0
checked=0

for tsconfig in domain/tsconfig.json impl/*/tsconfig.json; do
  [ -f "$tsconfig" ] || continue
  pkg=$(dirname "$tsconfig")
  checked=$((checked + 1))
  if output=$("$TSC" -p "$tsconfig" --noEmit 2>&1); then
    echo "ok      $pkg"
  else
    echo "ERRORS  $pkg"
    printf '%s\n' "$output" | sed 's/^/          /'
    failed=$((failed + 1))
  fi
done

if [ "$checked" -eq 0 ]; then
  echo "typecheck-all: no tsconfig.json found -- this is a COULD-NOT-READ, not a pass" >&2
  exit 1
fi

echo "typecheck-all: $checked package(s) checked, $failed with errors"
[ "$failed" -eq 0 ]
