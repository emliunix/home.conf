# Proposals — measured as unreachable, or not yet run

**These are not recipes.** A recipe in this skill means a seat on this host
executed the invocation and recorded what its failure looked like. Nothing here
has cleared that bar. Kept because the prerequisites and the known bounds are
real, measurable facts.

## Structural index / query — Glean

**Status: preconditions measured, end-to-end run NOT performed.** Do not cite
this as a working recipe.

**What was measured (2026-10-03, agent-substrate).**

```
cabal  /Users/ppio/.ghcup/bin/cabal   cabal-install 3.12.1.0
ghc    /Users/ppio/.ghcup/bin/ghc     GHC 9.10.3      (stack and ghcup also present)
herdr  /Users/ppio/.local/bin/herdr   server running 0.9.1, endpoint compatible
```

**`cabal update` needs NO proxy — measured three times with the proxy unset** and
the local index moved aside so each run was a real fetch. An earlier claim in
this repo that `HTTPS_PROXY=... cabal update` was required was **wrong and has
been retracted by the seat that published it.**

- **The benign warning that looks like a failure.** `cabal update` prints
  `Warning: Caught exception during _mirrors lookup: DnsHostNotFound` and
  `Warning: No mirrors found for <mirror>`. That is cabal's *optional*
  mirrors-lookup step, printed immediately before a successful download. The real
  first-run error is different: `Cabal-7160: The package list for '...' does not
  exist. Run 'cabal update'`. **Run `cabal update`** — that is the whole fix.
- **Glean's blocker was native prerequisites, not Glean** — a chain of
  `pkg-config` dependencies, each presenting as "the package does not exist".
  The six mechanisms and their different fixes are now their own chapter:
  [`code-analysis-cookbook/native-prerequisites`](native-prerequisites.md).
  Do not duplicate them here; this entry records only that *Glean's* wall behind
  the natives is a **version constraint** (`base >=4.11.1 && <4.19`), so it needs
  **GHC ≤ 9.6.x** — `ghc 9.10.3` here ships `base-4.20.2.0`, above the ceiling.
- **⚠ `cabal install --dry-run` is not the build.** The dry-run **planned 60
  targets** and resolved cleanly; the real build got as far as **106 successful
  dependencies** before failing. A solver that resolves is a statement about
  *versions*, not about *compilation* — budget the real build separately, and do
  not read a green dry-run as "installable".
- **The exact compiler activation, because the default is wrong.** GHC 9.10.3
  ships `base-4.20.2.0`; Glean requires `base <4.19`. GHC 9.6.6 ships
  `base-4.18.2.1` and is the only compiler that resolves, and it must be selected
  **explicitly** — the default `ghc` still resolves to 9.10.3:

  ```bash
  --with-compiler=/Users/ppio/.ghcup/ghc/9.6.6/bin/ghc
  ```
- **⛔ Terminal status: the build FAILS on this platform, and the gate is one
  header.** It reached **106 dependencies** and then stopped at the
  **unconditional `hinotify` dependency**, because **`sys/inotify.h` is a Linux
  kernel API and is absent on macOS** (verified: not present in the macOS SDK).
  This is *not* another one of the six environment mechanisms — no install or
  path variable fixes it. **Check the platform before provisioning: the gate is
  visible in one `grep` of the dependency list.**
- **The durable environment is a file, not a shell history.**
  `~/.local/glean/env.sh` regenerates the `.pc` shim, records the compiler
  selection, and explains why `/tmp` was not durable enough to hold it. Source it
  rather than retyping the setup.
- **Not the same claim as "it works."** Prerequisites and the failure were
  measured; the tool was **never run end to end** — it does not build here. No
  seat has ingested a repository or run a query.

**Open questions a run must answer before this becomes a recipe.** Can one local
repository be ingested, queried for symbol/reference and call/import facts, and
wired to a rerun hook — **while stale or partial coverage stays visible**? The
last clause is the whole question: an index that reports success on partial
coverage is a green that cannot be reddened, and it would be worse than no index
because it reads as authoritative.

**Hard constraint, independent of the tool.** A long-running index server is out
of scope until the owner decides the workspace. Herdr is shared; use a new
workspace or tab, never the owner's existing panes.

## Not yet evaluated

| candidate | why it is here |
| --- | --- |
| `lsp_navigation` code actions / organize-imports | the operation is exposed, but no seat has run it on this repo and recorded the failure mode. |
| an AST "rule" language (as opposed to a pattern) | a rule-based attempt **timed out** during this work; the pattern form was used instead. The timeout itself is the measured fact. |

**Promotion rule.** Move a candidate into a chapter only with: the exact
invocation, the version, the observable output, and the failure mode — the same
five columns every other recipe carries.
