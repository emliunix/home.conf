# Worklog - module docs convention

## C1 - Draft (2026-10-16)

Bob (Raft agent) drafted design 08 at the owner's request, after an audit of the
doc-verify module documents against `main` at `1fd1bb6`:

- `git diff --stat b9e950d origin/main -- docs design` is empty, while the same range
  changes `doc-verify/src/report.ts`, `src/engine/index.ts` and `src/types.ts` (#317).
- `docs/modules/language/contract.md` lists an `evaluate` module; `src/evaluate.ts`
  was deleted by PR #11.
- `design/` on `main` stops at 04; 05 to 07 are on `dv/trusted-kernel-trials` only.
- `src/snapshot.ts` already computes the change set for `--staged` and `--range`.



## C2 - Rescoped to the skills (2026-10-16)

The C1 draft proposed an engine gate (`governs:` in companions, change-set facts,
`module-docs-track-code`). It came from misreading the owner's "the impacted paths",
which asked which skills the formalization touches. The owner then accepted a
skills-and-template scope, with home.conf's own module documents as a follow-up.
The engine gate is a non-goal. Rebased onto `main` at `c94f19e` (after PRs #12 and
#13); PR #15 touches no skill or template file.
