# `core.ref` spec kind — the committed mutations

A `<rev>:<path>` reference is only worth having if the guards below are load-bearing. Run them:

```
node doc-verify/tests/language/references.mutations.mjs
```

Each mutation is applied **alone** to the file its row names (every target is a **full repository
path**), then `npx vitest run doc-verify/tests/language/references.test.ts` must REDDEN the named case.
The runner exits non-zero unless every row reddens.

⚠⚠ **THE RUNNER IS COMMITTED, AND IT WAS NOT ALWAYS.** This table previously described a harness that
reported `BROKEN` / `HARNESS` — and no such artefact was committed or reachable, so the sentence
promised an enforcement mechanism that was really the author's host-side script. Two reviewers
measured that gap. **A claim about a mechanism must be inspectable, or it is prose.** The runner is `doc-verify/tests/language/references.mutations.mjs`, committed beside this file, and all
three of its non-RED paths are live rather than asserted: a deliberately-broken anchor reports `BROKEN (anchor not found)`, a broken test file reports
`HARNESS (no test line)`, and a mutation that reddens the *wrong* test reports `WRONG-CASE` — **none
scored as a pass**, each exiting 1.

| # | mutation | must redden |
|---|---|---|
| M1 | `facts.ts`: in `spanKind`, delete the `if (specParts(value, context) !== undefined) return "spec";` arm | "spec: a revision-qualified span is its own kind…" — with no arm the span falls through `PATH_SPAN`, which has no `:`, so it is no reference at all |
| M2 | `facts.ts`: in `specParts`, drop the `gitRefs` / hex / `HEAD` test and accept any non-empty left side | "spec: an UNLISTED ref name is not a spec…" — a URL, a port and a predicate indicator all become specs |
| M3 | `facts.ts`: in `specParts`, return the parts for a bare right side too (drop the `file.includes("/") \|\| FILE_EXTENSION` guard) | "spec: an UNLISTED ref name is not a spec…" — `1c71b248:main` becomes a spec naming a file called `main` |
| M4 | `facts.ts`: in `referenceResolves`, return `true` for a `spec` instead of asking the resolver | "spec: an unresolved spec emits `dangling`, and a resolved one does not" |
| M5 | `facts.ts`: emit `spec_unresolved(…, unresolved)` when `context.resolveSpec` is undefined | "spec: with no resolver the span is classified but RESOLUTION IS NOT CLAIMED" — an absent capability becomes a failure |
| M6 | `facts.ts`: remove the `specParts` arm **and its ordering marker**, so the `:` reaches `PATH_SPAN` first | **five cases redden** (measured): the four spec cases plus the end-to-end one. ⚠ **This row previously named "a line locator is still a line locator…", which M6 does NOT redden** — that case survives because M6 deletes the spec arm rather than reordering it behind the locator. The claim was wrong until the runner checked *which* case failed. |
| M7 | `doc-verify/src/checker.ts`: make `specResolver` test the revision with a bare `cat-file -e <rev>` instead of `^{tree}` | **"references: an unresolved spec reddens with the component named…"** — via the **blob-shaped revision** row. ⚠⚠ **This row measured NOTHING until review caught it**: the suite had **no blob case**, so M7 stayed **GREEN 34/34** and the "9/9" below was false as written. A blob IS a git object, so the bare form passes the revision test and then reports the **path** as wrong, for a reference that can never have one. The missing case was added (blob id read from `git rev-parse HEAD:<path>`, not hard-coded); base reddens **1 failed / 33 passed**. |
| M8 | `references.yaml`: change `specs-resolve`'s `forbid` to `core.spec_unresolved(D, S, T, path)` | "references: an unresolved spec reddens with the component named…" — the bad-revision case would no longer redden |
| M9 | `doc-verify/src/checker.ts`: test the revision with `git rev-parse --verify -q <rev>` instead of `cat-file -e <rev>^{tree}` | "references: an unresolved spec reddens with the component named…" — **but ONLY because the case carries a fabricated 40-hex id.** `--verify` asserts FORMAT, not existence: measured, a fabricated 8-hex id fails it, while a fabricated **40-hex** id and a real-but-foreign commit hash both **exit 0**. Without the full-length row this mutation is GREEN. |

| M10 | `doc-verify/lib/examples/receipt.md`: change the `Identity:` revision from `HEAD` to a fabricated id | **"doc-verify:receipt passes its worked example"** (`modules-check.test.ts`) — the ONLY case that drives the LANDED example end-to-end. It reddens `NO-GO` with `module.specs-resolve`, *"whose revision does not resolve to a Git object"*, `basis` = `core.spec_unresolved(…, revision)`. **Card outcome 5's substance**: the example does not merely *mention* the new predicate, it exercises it. |

## ⚠⚠ Two files are called `checker.ts`, and only one is the resolver

`doc-verify/src/checker.ts` (**602 lines**, exports `checkDocuments`, consumes `cli.ts`) holds the
`specResolver` that M7 and M9 target. `doc-verify/src/engine/checker.ts` (**675 lines**, exports
`checkModule`) is a **different file on the same import chain** —
`cli.ts` → `src/checker.ts` → `src/engine/index.ts` → `src/engine/checker.ts`.

**Both are live, and both have a line 417 meaning different things.** Measured: `cat-file` appears
**5×** in the root file and **0×** in the engine file, so an unqualified `checker.ts:417` is
**ambiguous rather than merely mislocated** — and a mutation applied to the wrong one **compiles, runs
a green suite, and measures an unmutated tree.** Every cite in this file therefore names the directory,
and the committed runner targets the full path and reports `BROKEN` (anchor not found) or `HARNESS`
(no test line) rather than scoring it — see the header.

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

Every row above was applied and observed. **M1–M9 redden a `references.test.ts` spec case (9/9), measured
by the committed runner `doc-verify/tests/language/references.mutations.mjs` — M7 included.** M10 is
driven through a different file (`modules-check.test.ts`) and was verified by hand.

⚠⚠ **THE RUNNER CHECKS WHICH CASE FAILED, NOT WHETHER ANYTHING FAILED.** Its first version scored `RED`
on any non-zero exit, so a mutation that reddened an *unrelated* test was scored as if it had reddened
the named one, and the per-row `name` was printed but never compared — which made the claim that a
rename "breaks this file loudly" false. The runner now parses each failing case's title from Vitest's
JSON report and requires the row's own `name` to be among them; anything else is `WRONG-CASE`, unscored,
and exits 1. `git mv`-style renames of a named case therefore fail the runner.

**The stronger check found two rows in this table that named the wrong case, and both are corrected
above rather than deleted:** M4 reddens the `dangling` case (not "the failure NAMES ITS COMPONENT"),
and M6 reddens five cases but **not** "a line locator is still a line locator". Neither was visible
while the runner only asked whether something failed.

⚠⚠ **M7 and M9 were both GREEN when this table was first returned, and both for the same reason: the
table listed a mutation the SUITE COULD NOT SEE.** Neither mutation was bad; each case was missing.
**A count in this table is a measurement, not an intention** — the runner now contains every row it
scores, so "9/9" is the number of rows *executed and observed*, not the number of rows written. The two green rows from the
first attempt are recorded above with the cases that were added to make them redden.
