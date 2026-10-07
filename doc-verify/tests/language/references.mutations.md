# `core.ref` spec kind — the committed mutations

A `<rev>:<path>` reference is only worth having if the guards below are load-bearing. Each mutation
is applied alone to `doc-verify/src/engine/facts.ts` (or the named file), then
`npx vitest run doc-verify/tests/language/references.test.ts` must REDDEN the named spec case.

| # | mutation | must redden |
|---|---|---|
| M1 | `facts.ts`: in `spanKind`, delete the `if (specParts(value, context) !== undefined) return "spec";` arm | "spec: a revision-qualified span is its own kind…" — with no arm the span falls through `PATH_SPAN`, which has no `:`, so it is no reference at all |
| M2 | `facts.ts`: in `specParts`, drop the `gitRefs` / hex / `HEAD` test and accept any non-empty left side | "spec: an UNLISTED ref name is not a spec…" — a URL, a port and a predicate indicator all become specs |
| M3 | `facts.ts`: in `specParts`, return the parts for a bare right side too (drop the `file.includes("/") \|\| FILE_EXTENSION` guard) | "spec: an UNLISTED ref name is not a spec…" — `1c71b248:main` becomes a spec naming a file called `main` |
| M4 | `facts.ts`: in `referenceResolves`, return `true` for a `spec` instead of asking the resolver | "spec: an unresolved spec emits `dangling`, and a resolved one does not" |
| M5 | `facts.ts`: emit `spec_unresolved(…, unresolved)` when `context.resolveSpec` is undefined | "spec: with no resolver the span is classified but RESOLUTION IS NOT CLAIMED" — an absent capability becomes a failure |
| M6 | `facts.ts`: move the `specParts` arm BELOW `isLineLocator`'s callers (i.e. let `PATH_SPAN` run first) | "spec: a line locator is still a line locator…" and every spec case — the `:` is refused before the arm is reached |
| M7 | `checker.ts`: make `specResolver` test the revision with a bare `cat-file -e <rev>` instead of `^{tree}` | a blob-shaped revision would be reported as a bad PATH rather than a bad revision |
| M8 | `references.yaml`: change `specs-resolve`'s `forbid` to `core.spec_unresolved(D, S, T, path)` | "references: an unresolved spec reddens with the component named…" — the bad-revision case would no longer redden |
| M9 | `checker.ts`: test the revision with `git rev-parse --verify -q <rev>` instead of `cat-file -e <rev>^{tree}` | "references: an unresolved spec reddens with the component named…" — **but ONLY because the case carries a fabricated 40-hex id.** `--verify` asserts FORMAT, not existence: measured, a fabricated 8-hex id fails it, while a fabricated **40-hex** id and a real-but-foreign commit hash both **exit 0**. Without the full-length row this mutation is GREEN. |

## Why the ordering arm (M6) is the interesting one

`isLineLocator` runs before the spec arm and claims any stem with a numeric tail. A `<rev>:<path>`
has a PATH tail, so the two rules cannot both match — but if the spec arm were placed after the
`PATH_SPAN` test, a spec would die on the colon exactly as it did before #216, and the whole change
would be a no-op that still passed the two spec classifier cases (because those spans would simply
be absent, and `toEqual` on a shorter list fails only if the expectation is the shorter one).

## ⚠⚠ TWO ROWS WERE GREEN UNTIL A CASE WAS ADDED, AND THAT IS THE POINT OF KEEPING THEM

M4 and M8 both left the suite **fully green** in the first version of this table. Neither was a bad
mutation — each broke a real rule. What was missing was the **case**:

- **M4** (`referenceResolves` bypassed for a spec) changed no verdict, because the constraints read
  `core.spec_unresolved` rather than `core.dangling`. The arm was unobservable, so a case was added
  that pins `dangling(_, _, _, spec)` directly.
- **M8** (the constraint's `forbid` component swapped) was invisible to a **facts-level** case, since
  facts do not know which component a constraint forbids. A case was added that drives
  `checkDocuments` end to end and asserts the finding's **basis**.

Both rows are kept, and the two cases exist **because** the mutations did not redden. A mutation
table whose green rows are deleted rather than fixed measures the table, not the code.

## ⚠⚠ M9 — AN INSTRUMENT THAT LOOKS STRICTER AND IS NOT

M9 replaces `cat-file -e <rev>^{tree}` with `git rev-parse --verify -q <rev>`. That reads as a
*stronger* check and is a **weaker** one: `--verify` asserts only that the string can be turned into a
raw object name. Measured in a real worktree:

| probe | `rev-parse --verify -q` | `cat-file -e <rev>^{tree}` |
| --- | --- | --- |
| fabricated 8-hex `deadbeef` | exit 1 | exit 1 |
| fabricated **40-hex** `aaaa…` | **exit 0** | exit 1 |
| a real **foreign** commit (`home.conf`'s `43a97a73…`) | **exit 0** | exit 1 |

Git's own manual names the gap: add `^{type}` to be sure the object is in the object database.

⚠ **The original case set could not catch this.** Its fabricated id was 8 characters, which fails
`--verify` for the *other* reason (bad format), so M9 left the suite **green**. A reviewer measured
the instrument property; the case that discriminates is a **well-formed but absent** id, and it was
added. Re-verified: removing that row makes M9 green again.

## Verified, not asserted

Every row above was applied and observed: **8/8 redden a spec case**. The two green rows from the
first attempt are recorded above with the cases that were added to make them redden.
