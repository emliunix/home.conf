# Round 12 — does the judge do better when it sees where the subject sits? (design/07 phase 1)

Plan written 2026-10-14 by `lead` before the build; the independent seat's review is appended under
`## Review` before the run. Builds on round 11's reading of headings; built after round 11 lands.

## Hypothesis

Showing the judge the subject's address in a separate "Where:" block, with the evidence and the
question unchanged, moves `evidence_reasons` toward the lead's labels and moves no right cell to
wrong on any oracle. Refuted by: a right→wrong move on any oracle in both repeats, or
`evidence_reasons` gaining fewer than 2 right cells and less than +0.10 mean P(expected) on its
near-threshold stratum.

## Axis

What the "Where:" block holds, with the subject fixed: nothing (shipped), the subject's address, or
the address plus the claim the subject is evidence for.

## Candidates

- **N — none** (shipped libraries, unchanged).
- **A — address**: `context: [P]` with `P` from the path relations of design/07:
  `evidence_reasons` `[title, heading, row_key('Requirement'), column]`;
  `witness_observable_in_row` `[title, heading, column]` (no `row_key`: its evidence already holds
  the Property cell); the module-page oracles `[title, heading]`.
- **C — address + claim** (`evidence_reasons` only): A plus `Q`, the path `[title, heading]` of the
  requirement section the row cites, found by `core.section_keyed(D, Key, S)`, the section whose
  heading's first token equals `Key`. A goal's requirements are headings (`### R1 - A trusted
  kernel, not an invented one`), and the row's key is `R1`. `core.section_keyed/3` is a core
  relation in `core.pl` over heading text (structure decided in a rule, invariant 7).

Built for all arms (design/07 §Scope, phase 1): `core.header_pos/4` and `core.cell_text/4` facts;
`core.path/4`, `core.cell_path/5` and `core.section_keyed/3` as dedicated literal kinds (checker,
translator, `core.pl` with text and proof clauses, sandbox primitives); the oracle `context:` field
with its renderer, outbound scan, `max_bytes` share and both cache keys; the two-part echo rule; the
key round-trip test; the cache tests. Arms are module variants beside the shipped libraries, as
round 9's were.

## Tracks and fixtures (all existing; no new labels)

| Track | Oracle | Fixture set | Arms |
| --- | --- | --- | --- |
| E-fix | `evidence_reasons` | round 4 `oracle-fixtures/evidence_reasons/` (13 documents × 5 cells) | N, A, C |
| E-real | `evidence_reasons` | round 10 `real-cells/labels-r10.yaml` (13 real cells of goals 01 and 04) | N, A, C |
| W-fix | `witness_observable_in_row` | round 4c `oracle-fixtures/witness_observable_in_row/` | N, A |
| W-real | `witness_observable_in_row` | round 10 `real-cells/witness-labels-r10.yaml` | N, A |
| M | module-page oracles | round 8 `module_*_pages/` and `real-cells/module-pages.yaml` | N, A |

Per-atom, cache off, two repeats, ABBA order per document (as round 8). A cell counts as moved only
when both repeats agree; a disagreement is a flip, reported apart. Near-threshold stratum: cells
whose N-arm peak is in 0.45–0.70 in the first repeat (round 8's definition).

## Predicate

```sh
npx vitest run doc-verify/tests/kernel/path.test.ts doc-verify/tests/kernel/keys-roundtrip.test.ts doc-verify/tests/oracles/context.test.ts
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle <set> --request-shape per-atom --repeat 2 --no-spans --ledger round12-<track>-<arm> --cap <n>   # per track and arm
node worklog/kernel-trials/probe/compare-arms.mjs round12-<track>-N round12-<track>-<arm>       # moves, flips, shifts with CIs; complete flag
```

`compare-arms.mjs` (built in this round from round 8's `compare-shapes.mjs`) prints per oracle:
right→wrong and wrong→right moves (both repeats), flips, mean P(expected) shift with a 95%
bootstrap interval overall and on the near-threshold stratum, context bytes (median, max) against
`max_bytes`, atom-key length growth, and `complete: true|false`. Caps are set from a mock cost run
before the live run, as in earlier rounds.

## Expected outcomes (recorded before the run)

| Track | Expectation |
| --- | --- |
| E-fix, E-real under A | no gain: the row key `R1` and the table's place add nothing the question does not already say; shift within ±0.05; 0 right→wrong |
| E-fix, E-real under C | gain: the requirement's title is the claim the cell must draw; ≥ 2 more right cells or ≥ +0.10 near-threshold; 0 right→wrong |
| W-fix, W-real under A | neutral (±0.05), 0 moves; item 11's wrong-row case not caught (accepted gap) |
| M under A | neutral to slightly positive; 0 right→wrong |
| cost | context adds ≤ 300 bytes per atom; no `max_bytes` refusal on any fixture |
| echo | the echo rule refuses round 9's E1 module rewritten with a `row_key` step; no shipped library is refused |

## Decision rows (fixed before the run)

| Outcome | Decision |
| --- | --- |
| C meets the bar and 0 right→wrong anywhere | ship `context:` with the C form on `evidence_reasons`; A on the others only where it moved nothing wrong; phase 3 opens (a claim from another document is the next step) |
| A meets the bar, C does not | ship A on `evidence_reasons`; phase 3 stays closed |
| neither meets the bar, 0 right→wrong | the relations ship for rules; `context:` stays in the language unused by any shipped library; phases 2 and 3 declined by decision row |
| any right→wrong in both repeats | that arm does not ship on that oracle, whatever else it gains |

Phase 2 (list items) opens only if a shipped oracle's subject or needed context is a list item; the
census in this round's verdict lists every shipped oracle by evidence grain and context need.

## Seeded defects

- `context:` rendered into the evidence instead of apart: the context test sees the "Where:" text
  inside the evidence block;
- the context left out of the cache key: the cache test re-uses an answer after an ancestor heading
  edit;
- `core_cell_path/5` removed from the sandbox primitives: the boundary test prints `rejected` for a
  module using it (expected), and the same module evaluates when the primitive is present.

## Left unmeasured

Judge models other than the production one; batched requests; context for oracles not listed;
paths into list items; cross-document claims (phase 3).
