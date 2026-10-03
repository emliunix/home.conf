# Typecheck a package (and its tests)

**Task.** Learn whether a package compiles, and whether its *tests* compile. The
second half is the one that gets forgotten: a test file is TypeScript, and the
runner that executes it does not typecheck it.

**Invocation.**

```bash
# one package
./node_modules/.bin/tsc -p impl/control-plane/tsconfig.json --noEmit

# every package, one line each (see script below)
for ts in domain/tsconfig.json impl/*/tsconfig.json; do
  ./node_modules/.bin/tsc -p "$ts" --noEmit >/dev/null 2>&1 \
    && echo "ok      $(dirname "$ts")" || echo "ERRORS  $(dirname "$ts")"
done
```

**Prerequisites.** `pnpm install` must have run (workspace packages resolve to
each other through `node_modules`). `typescript` is a root devDependency;
`./node_modules/.bin/tsc` is the repository's own copy.

**Observable result.** `tsc` exits **0** for a clean package and **2** for errors
(non-zero, but not 1 — distinguish it from a shell failure). Errors are printed
as `path(line,col): error TS<code>: message`.

**The gap this recipe exists for.** Every package declares a `typecheck` script
and `impl/control-plane/tsconfig.json` includes `test/**/*.ts` — but **no entry
in `scripts/check-all.mjs` runs any of them**. So `pnpm check` can report
`10 checks, 0 failed` while a package does not compile, including its tests.
Measured at `939c7fda`: three errors in a *test* file that nine green checks said
nothing about, and that the test runner could not see because `node --test`
strips types and runs the JavaScript.

**Failure modes — the column that matters.**

| what you see | what it means |
| --- | --- |
| exit **2**, errors in **another package's** `src/` | the tsconfig's `include` is local, but an imported dependency package exposes `./src/index.ts` via its `exports`, so a dependency's file is compiled as part of your package. A clean package can therefore report a dependency's error. Group output **by file**, not by package, before assigning blame. |
| exit **0** on a package whose tests are broken | `tsconfig.json` may not include `test/`. `node --test` will still fail at runtime, but a *type* error in a test is invisible to it. Check `include` before trusting a clean run. |
| no output, exit 0 | this is the clean case — but confirm the command actually resolved a tsconfig. `tsc -p` on a missing path errors; a **bare** `tsc` with no `-p` prints help and exits 0, which reads as clean. |
| the test you care about is executed but never typechecked | that is the default, not an anomaly. A runtime suite certifies behaviour; only `tsc` certifies annotations. |
| `error TS18003: No inputs were found in config file` | the tsconfig matched **no files** — an empty or wrongly-pathed `include`. Exit **2**. This is the good failure: the tool says it read nothing rather than reporting a clean compile of nothing. **A gate that cannot produce this error cannot distinguish checked-and-clean from could-not-read.** |
| **`tsc` with no `-p`** | prints the version and help and exits **1** (measured, 5.9.3) — a help dump, not a compile. Useful only as a negative control: it proves the binary runs without asserting anything about your code. |

**Named pre-existing bound on this host (not caused by the change you are
making).** `impl/build-service/src/listener.ts:20` does
`import type { AddressInfo, Server } from "node:http"`. `AddressInfo` is declared
in **`node:net`**, and `@types/node` 26.6.3's `http.d.ts` has zero occurrences of
it. It surfaces in the typecheck of **three** packages (build-service, substrate,
control-plane — all reach it through the dependency graph) and belongs to #64.
**Attribute it there** rather than to whoever adds a typecheck entry to the gate.

**Related.** The language server is a weaker instrument for this task: it refuses
files over its size limit (stock pi-lens 4.3.0 is 5000 lines; this host patches
it to 10000 — see `code-analysis-cookbook/symbol-edit`), and it reports a
per-file view rather than a project compile, so it cannot see a cross-package
`exports` error at all.
