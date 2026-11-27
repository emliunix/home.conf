# 13 - Docs consolidation: review record

Review record for [design/13](../design/13-docs-consolidation.md). The survey is
[inventory.md](13-docs-consolidation/inventory.md).

## Attack angles (round 1)

1. **Heads**: is "no owner and no trust" the one problem, and is the scope drawn at the real
   edge? In particular: is keeping every path the right call, and is the README carve-out what the
   owner said?
2. **Authority table**: is each fact's authority the right one, is any duplicate missing (check
   the inventory against `docs/` and the README), and does a cited authority actually hold the
   fact?
3. **Package assignment**: do `kernel` and `mutate` earn modules under `project-skeleton`
   §Module docs, and is every `doc-verify/src` file assigned or named as a helper?
4. **Verification**: does each witness fail on its seeded defect, and is the contract gate the
   cheapest honest observer? Is the configured-count arithmetic right?
5. **Migration completeness**: does any step move, rename or delete a configured document, or
   leave a reference stale (P-ids, `design/NN §` citations, code comments, fixtures)?

Skipped: observability, schema and UI angles (no runtime writer, schema or UI changes).

## Round 1 findings and adjudication (2026-11-27)

One independent seat (Sonnet) reviewed all five angles. §0 project contract: clear. Every angle
came back NEEDS-FIX. The lead checked each premise against the code before ruling.

| Angle | Finding | Ruling | Design change |
|---|---|---|---|
| 1 Heads | `constraintReports` exists (alias, `diagnostics.ts:15`); the missing export is `cli` `main` (`cli.ts:39`, not exported) | P1 accept, verified | Problem statement rewritten; inventory item 2 corrected |
| 1 Heads | kernel seam misdescribed: callers are `engine/index.ts` and `kernel-bridge.ts`, and kernel imports language types (cycle) | P1 accept, verified | Packages paragraph restates the seam and the cycle |
| 1 Heads | the skeleton ships `index` / `architecture` under `canon.yaml`, not an invented `docs-index` | P1 accept | adopt `canon.yaml`, add `docs/architecture.md` |
| 1 Heads | design 08's follow-up includes the `AGENTS.md` pointer and PR rule; kernel waits on an owner ruling | P1 accept | `AGENTS.md` §Documentation in scope; the kernel ruling is an open question for the owner |
| 1 Heads | the one-authority row contradicts the owner's README carve-out | P1 accept | authority table splits `docs/` citations from user-facing copies |
| 2 Authority | `--range A..B` in `selection/contract.md` and CLI help vs `BASE...HEAD` in code (`snapshot.ts:590`); `FILE|GLOB`; BLOCKED wording in `report/model.md`; wider two-bound residue; README pointers to designs 02/04; README:352 quotes the error; intro deck restates CLI; `section_ref`, `judgePrerequisiteGap` omitted | P1 accept | corrections flow code → authority → copy; CLI help in scope as a user copy; intro deck exempt as a frozen capture; the refresh covers every item |
| 3 Packages | `engine/demand.ts` unassigned; `trace.ts` has no production importer; `hash.ts` and `types.ts` are cross-package | P1 accept | `demand.ts` to language; `types.ts`/`hash.ts` named as the shared foundation, with the convention gap recorded as a follow-up; `trace.ts` recorded as a smell |
| 4 Verification | count wrong (39 then, not 38); bare count hides a swap; gate one-directional; export check must resolve aliases; paths-resolve row is warning-only; kernel-slow tier excluded from `npm test`; error-text witness is a literal pin | P1 accept | path-list comparison with counts 29/30/32/40; bidirectional pairing and test-file existence; TypeScript compiler API; paths-resolve row dropped; tier stated per kernel row; heading-existence assertion |
| 5 Migration | README corrections unscheduled; README:352 must move with the error text; PR 2 would cite a stale authority; index can't link kernel/mutate before PR 4; P-language-04 row | P2 accept | three PRs: refresh and dedupe together in PR 2; README:352 in the same commit; index rows for new modules in PR 3 |

## Recorded smells (not fixed here)

- `doc-verify/src/engine/diagnostics.ts:15`: alias re-export `constraintReportsFromKernel as constraintReports`.
- `doc-verify/src/trace.ts`: no production importer; cites a design 19 that is not on `main`.
- File-level import cycle: `doc-verify/src/engine/index.ts` ↔ `doc-verify/src/kernel/translate.ts`.
- `skills/project-skeleton` §Module docs: no slot for a shared foundation imported by every package.
- The constitution and the model are not governed by doc-verify.

## Configured document lists

Expected `check --all` artifact paths: 29 at `6a87056`; 30 after PR 1 (`design/13-docs-consolidation.md`);
32 after PR 2 (`docs/index.md`, `docs/architecture.md`); 40 after PR 3 (`docs/modules/{kernel,mutate}/`
quads), or 36 if the owner holds the kernel module. Each PR compares the full path list, not the count.

## Round 2 (rematch, same seat)

Angles 2 and 3 PASS. Still open, all accepted and applied:

| Angle | Finding | Change |
|---|---|---|
| 1 | kernel callers are `engine/index.ts` (direct) and `kernel-bridge.ts` (imported only by `engine/diagnostics.ts`); the kernel also imports `engine/checker.ts`, `engine/module.ts`, `compileModule` and `OracleStore` | `kernel-bridge.ts` moves to `report`; the kernel's imports listed in full |
| 3 (minor) | the kernel imports neither `types.ts` nor `hash.ts` | "every package except the kernel" |
| 4 | `cli.ts` exports nothing, so the grammar forbade the CLI authority row; clause 4 had no row grammar; the tier row relied on the reviewer; no 36 list for the hold case | `none (entry point)` plus a `## Command line` section; verification-row grammar with a tier prefix; new clause 5 checks the tier against `vitest.config.ts`; 36 list added |
| 4 (detail) | the skeleton's `index.yaml` depends on a root `constitution.md` that home.conf lacks | companions written for home.conf, not copied |
| 5 | PR 1's entry points would route to contracts still stale until PR 2 | reordered: the corrections go in PR 1 with the design, the entry points in PR 2, the new modules in PR 3 |

## Round 3 (rematch, same seat)

No blocker. Hardening items accepted and applied: every cyclic package edge (language ↔ report,
language ↔ oracles, language ↔ kernel) and `types.ts` → `engine/diagnostics.ts` go to the
architecture page and the smells list; the Module cell must be a file; Check paths must be test
files; witness rows for clauses 1 and 6; contract omissions go to the reviewer row, with a
mechanical check recorded as a follow-up; the README routing line moves to PR 2; PR 1's language
documents cite only the model. Each PR's description carries the full expected path list.

Review gate: complete. Design status `reviewed`.

### Smells added at round 3

- Package import cycles: language ↔ report, language ↔ oracles (in addition to language ↔ kernel).
- `doc-verify/src/types.ts` imports `EngineReport` from `doc-verify/src/engine/diagnostics.ts`.

### Follow-ups

- A mechanical check that a contract lists every export another package imports.
- `skills/project-skeleton` §Module docs: a slot for a shared foundation.
- Governing the constitution and the model with doc-verify.

## PR 1 execution (2026-11-27)

- The module-docs gate (`doc-verify/tests/docs/module-docs.test.ts`) was run on main's documents
  first: 38 violations, all clause 6 (bare Module names; Limit cells with no tier). Each clause was
  then seen failing on its seeded defect in the same test file; `constraintReports` (an alias
  re-export) is accepted.
- The migration-message test was seen failing with the README heading renamed, then restored.
- P-language-04 retired with its row; P-language-03 restated against the model; P-report-03 split
  into P-report-03 (verdict codes, unit) and P-report-06 (refusal codes, subprocess) so each row has
  one tier.
- Rebased onto #26 (`89f0980`); one conflict in `docs/modules/selection/verification.md` resolved by keeping #26's deletion witness in the P-selection-05 row under the tier grammar.
- Gates: `npm test` 41 files / 400 tests pass; `npm run typecheck` 0; `npm run lint` 0;
  `check --all --profile draft` PASS, 30 artifacts (29 at `6a87056` plus
  `design/13-docs-consolidation.md`).
- Forward references in design 13 (`docs/index.md`, `docs/architecture.md`,
  `doc-verify/modules/canon.yaml`, the kernel and mutate quads) are `paths-resolve` warnings until
  PRs 2 and 3 create them.
