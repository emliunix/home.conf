# Proposals — measured as unreachable, or not yet run

**These are not recipes.** A recipe in this skill means a seat on this host
executed the invocation and recorded what its failure looked like. Nothing here
has cleared that bar. Kept because the prerequisites and the known bounds are
real, measurable facts.

## Structural index / query — Glean

**Status: RUN END TO END in a Linux container, but NOT yet a recipe.** The
indexer, the query layer, and the partial-coverage instrument have each been
exercised on real facts. What has *not* been measured is the strict case —
**completeness reported by a running server** — and until it is, this stays a
proposal. Do not cite it as a working recipe.

### Measured since the macOS block (2026-10-03, seat @GameBoy, `4b21c6cb` `ec59e021`)

The macOS block above stands and is unchanged — **this does not build on macOS**.
The measured path is the Linux container, and it changes what the open question
is, because three of its clauses now have answers.

```
# produce the artifact the indexer reads — it does NOT parse source
ghc -fwrite-ide-info -fno-code A.hs                    ->  A.hie (939 bytes)

# let the INDEXER create the DB (see trap 1)
hie-indexer /work --repo-name direct --repo-hash 2 --db-root /indexes --db direct/2
  -> hs.UnitName 3 · hs.ValBind 1 · hs.XRef 6 · src.File 1 · src.FileLines 1
```

Three query classes return typed structured facts: `hs.ValBind _` (definition),
`hs.XRef _` (cross-reference), `src.File _` (file identity). **`hs.XRef` is the
one that matters** — it is an entity carrying a typed target, a reference *kind*,
and a byte span, so it distinguishes a use from a definition and can say *which*
symbol a span refers to. Text search structurally cannot produce that.

**Trap 1 — the database must be created BY THE INDEXER, not from the schema
source.** A DB built from `glean/schema/source` gives:

```
Thread killed: schema ID in batch (7cb6848b…) does not match schema ID of DB (66a80a62…)
```

The message names both IDs, which is a good refusal — **but only on the
standalone path.** Through the server the same mismatch surfaces as a
**`Bad Gateway`**, which reads as a transport failure and sends you looking in
the wrong place. A seat lost time to exactly that.

**Trap 2 — Angle rejects a variable used only once.** The natural query shape
`hs.ValBind { name = N }` is **refused**; the working form is `hs.ValBind _`. The
error names the variable but not the fix. Four of five query attempts hit this.
`BadQuery: One or more variables were mentioned only once … This is usually a
mistake, so it is disallowed in Angle.`

**The artifact prerequisite is the real cost, and it is language-dependent.**
Glean does not index a checkout. Haskell needs a full package build with
`-fwrite-ide-info` before any index exists; C++ needs a compilation database;
TypeScript needs a SCIP producer. **Budget "indexer time + per-language artifact
production", not one number.**

**What is measured about partial coverage, and what is not.** In **standalone**
mode (`--db-root`, no server) the database reports its own completeness:
`(incomplete)` before `glean finish`, then `(complete)` plus a separate
`Completed:` timestamp. That is explicit and dated, not inferred — the instrument
the question asks for. **Unmeasured: whether the same state is visible to a
*running server*.** That is the stricter case, because a server is a long-lived
process holding state and "which revision is in there" is not readable from a
path.

**Merge-time check, from the same card.** `git rev-parse --git-path hooks` answers
where git **dispatches** (it honours `core.hooksPath`, which on this host is the
global `/Users/ppio/.git-hooks`), not where a clone **installs**
(`<git-common-dir>/hooks`). And an "install is *outside* `core.hooksPath`" test is
satisfied by **equality** — it stays green in exactly the collapse it guards. Any
rerun-hook wiring must canonicalise both sides and assert they are *distinct*.

### Preconditions measured on macOS (2026-10-03, seat @GameBoy, `4b21c6cb`)

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
- **Not the same claim as "it works."** On *this* platform the prerequisites and
  the failure were measured and the tool **does not build**. The end-to-end run
  happened in the Linux container, above — the platform gate is unchanged, and
  the two are different claims.

**Open questions a run must answer before this becomes a recipe.** The
standalone run answered three of the clauses: a repository's *artifact* can be
ingested, symbol/reference facts can be queried, and partial coverage is visible
as an explicit state. **The clause still open is the strict one** — whether that
completeness state survives into **server mode**, where the answer is a
query-time property of a long-lived process rather than a readable path. An index
that reports success on partial coverage is a green that cannot be reddened, and
it would be worse than no index because it reads as authoritative.

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
