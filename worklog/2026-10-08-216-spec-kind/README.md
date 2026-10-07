# #216 — a revision-qualified reference kind (`<rev>:<path>`)

Base `1c71b248` (the landed tree, as the card requires). Object returned at `origin/gb/216-spec`.

## What this fixes

`doc-verify:receipt`'s worked example mandates an `Identity:` field:

> `- **Identity:** `2222222:doc-verify/src/checker.ts` resolves to the reviewed blob`

**Nothing read it.** `references.yaml` quantifies over `core.ref(D, S, T, link)` and
`(…, path)`, and the span classifier admits a path only when it matches
`PATH_SPAN = /^[A-Za-z0-9_./-]+$/` — **which has no colon**. So the one field carrying the object's
identity was invisible to the rule that was supposed to check it, and the example passed *because* of
the blind spot: `2222222` is not an object, and the example was green anyway.

Measured at the base, three distinct mechanisms, no identity form visible:

| span | findings at base |
| --- | --- |
| `sub/nope.ts` (missing, slashed) | **1** — the rule fires |
| `deadbeef:impl/zz/nope.ts` | **0** |
| `deadbeef:doc-verify/src/checker.ts` | **0** |
| `doc-verify/src/checker.ts` (real) | 0 |

## The change

A fourth kind, `spec`, plus a fact that names **which component failed**.

- **`facts.ts`** — `specParts()` decides the kind: the revision is a 7–40 hex object id, a
  `HEAD`-relative expression, or a name the reference context lists from `git for-each-ref`; the path
  must look like a repository path. `spanKind` asks it **before** the path rules (which is the whole
  point — `PATH_SPAN` refuses the colon). `core.spec_unresolved(D, S, Target, Component)` is emitted
  and added to `CORE_DERIVED`.
- **`checker.ts`** — `specResolver()` asks the revision and the path **separately** and refuses a
  parse failure rather than calling it resolved.
- **`references.yaml`** — two constraints, one per component, each naming its own repair.
- **`examples/receipt.md`** — the `Identity:` example now names a real object (`HEAD:<path>`) and
  exercises the new predicate. **The example is part of acceptance, not frozen prose.**

## ⚠ Three decisions that are the difference between a check and a promise

**1. `^{tree}`, not a bare object id.** A revision must be able to *prefix a path*, which only a
tree-ish can. `git cat-file -e <blob>` succeeds, but `<blob>:<path>` is meaningless — so a bare
existence test would report "the path is wrong" for a reference that can never have a path at all.
Measured both ways, and the failure is attributed to the **revision**.

**2. An absent capability is not a failure.** With no resolver the span is classified but resolution
is **not claimed**, mirroring `exists === undefined`. The alternative — emitting
`spec_unresolved(…, unresolved)` — would red every correct document in a context that simply cannot
answer the question.

**3. The failure names its component.** "The revision is wrong" and "the path is wrong" are different
repairs; `dangling` alone cannot tell a reader which to make. Two constraints, two messages, and the
finding's `basis` says which fired.

## ⚠⚠ Two mutations were GREEN, and the cases were added because of it

This is the part worth reading. `references.mutations.md` lists 8 mutations; **the first run left two
of them green.**

| mutation | first run | what was wrong |
| --- | --- | --- |
| **M4** — `referenceResolves` returns `true` for a `spec` instead of asking the resolver | **GREEN** | the `spec` arm changed **no verdict**, because the constraints read `core.spec_unresolved`, not `core.dangling`. The arm was unobservable. |
| **M8** — `specs-resolve`'s `forbid` component changed from `revision` to `path` | **GREEN** | a **facts-level** case cannot see which component a *constraint* forbids. |

Neither mutation was bad; each broke a real rule. What was missing was the case. So:

- a case was added pinning `dangling(_, _, _, spec)` **directly**, which reddens M4;
- a case was added that drives `checkDocuments` **end to end** and asserts the finding's `basis`,
  which reddens M8.

**Final: 7/7 mutations redden a spec case.** The two green rows are kept in the table with the cases
that were added to redden them — a mutation table whose green rows are deleted rather than fixed
measures the table, not the code.

## Evidence

- **Suite**: `npx vitest run doc-verify` → **24 files / 209 tests**, 209 pass (201 before, 8 new).
- **Typecheck**: `npx tsc -p doc-verify/tsconfig.json --noEmit` → 0.
- **Build**: `npx tsc -p doc-verify/tsconfig.build.json` → 0. ⚠ The 23 `subprocess` CLI tests fail
  without this, because they invoke `doc-verify/dist/cli.js`; that is a missing build, not a defect.
- **Repo check**: `npm run check` → **PASS** (4 artifacts / 83 sections).
- **Mutations**: 7/7 redden a spec case.
- **Preservation**: the plain-path, line-locator and URL cases are asserted unchanged, and
  `PATH_SPAN`/`GIT_REF_PREFIX` are untouched.
- ⚠ **`npx eslint doc-verify/src doc-verify/tests` reports one pre-existing error** at
  `present.test.ts:83` (`no-unsafe-assignment`, AstraBoy's #190 regression). **Not mine, not touched
  by this object.**

## Grammar and resolution scope (card outcome 4)

```
spec        := revision ":" path
revision    := /[0-9a-f]{7,40}/ | "HEAD"(("~"|"^")[0-9]*)* | <a name `git for-each-ref` lists>
path        := [A-Za-z0-9_./-]+  (a "/" or a known extension required; not "/"-initial, not only extensions)
resolution  := revision must peel to a TREE (`cat-file -e <rev>^{tree}`);
               then `<rev>:<path>` must resolve in that revision
failure     := core.spec_unresolved(D, S, Target, revision | path)
not claimed := no resolver supplied -> classified `spec`, no resolution fact
```

A bare object id (a hex string with no `:`) is **deliberately not** this kind: it names an object and
no path, so folding it in would claim a checked path that was never checked. It stays a different
claim and, per the card's grammar boundary, is not added here.

## Bounds honoured

`GIT_REF_PREFIX` is unchanged. A plain path is **not** treated as satisfying identity — `spec` is a
separate kind with its own constraints. The example was updated because the card now includes it in
acceptance. No production action; no deploy.
