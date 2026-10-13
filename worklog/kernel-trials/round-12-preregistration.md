# Round 12 — does the judge do better when it sees where the subject sits? (design/07 phase 1)

Plan written 2026-10-14 by `lead` before the build; reviewed (`results/round-12-review.md`, "run after
amendments") and amended before the build (§Review). Built after round 11 lands.

## Hypothesis

Showing the judge the subject's address, and for an evidence cell the requirement it is evidence
for, in a separate "Where:" block with the evidence and the question unchanged, lets
`evidence_reasons` refuse evidence that sits on the wrong requirement row, while moving no
right-decided cell to wrong-decided beyond the judge's own repeat noise on any oracle. Refuted by:
the wrong-row bars below missed, or a harm count above the base rate.

Round 10 left no headroom on correctly placed evidence (13/13 real, 50/50 seeded right at 0.5), so
those cells are a **no-harm check**, not where a gain can show; the gain is measured on wrong-row
evidence, which today's oracle passes.

## Axis

What the "Where:" block holds, the subject fixed: nothing (shipped), the address, the address of
another row (a length-matched control), or the address plus the cited requirement's title.

## Candidates

- **N — none**: the shipped libraries, unchanged.
- **A — address**: `context: [P]`, `P` from the path relations of design/07:
  `evidence_reasons` `[title, heading, row_key(K), column]`, `K` the table's key column, a module
  param `key_headers: ['Requirement', 'Row']` (goals/04 and goals/01 name it differently);
  `witness_observable_in_row` `[title, heading, column]` (its evidence already holds the Property
  cell); module-page oracles `[title, heading]`.
- **D — another row's address** (`evidence_reasons`, E-fix only): A with the path of the next row
  in the table (cyclic); same length and form, wrong content. Controls for prompt length.
- **C — address + claim** (`evidence_reasons` only): A plus `Q`, the path `[heading]` of the section
  whose heading's first token equals the row's key (`core.section_keyed(D, Key, S)`; goals 01 and 04
  head every requirement `### R1 - …`, `### A7 - …`). The claim is the requirement's **title only**,
  not its body, so this is a weak form of the claim. When no section matches, C falls back to A for
  that cell (reported as `fallback`).

Built for all arms (design/07 §Scope, phase 1): `core.header_pos/4` and `core.cell_text/4` facts;
`core.path/4`, `core.cell_path/5` and `core.section_keyed/3` as dedicated literal kinds (checker,
translator, `core.pl` with text and proof clauses, sandbox primitives); `context:` with its renderer,
outbound scan, `max_bytes` share and both cache keys; the two-part echo rule; the key round-trip and
cache tests. The runner gains an arm dimension (a module variant per arm, ABBA over arms per
document, the sidecar field `arm` renamed `order` and a new `variant`), and `compare-arms.mjs` is
built from `compare-shapes.mjs`'s statistics and pairing. Under the pinned `batched` shape a
"Where:" block renders once per atom inside its keyed evidence entry; M runs per-atom here (below).

## Tracks and fixtures

| Track | Oracle | Set (labels) | Arms | Role |
| --- | --- | --- | --- | --- |
| E-fix | `evidence_reasons` | round 4 `oracle-fixtures/evidence_reasons/`: 11 documents, 50 cells + the 5 `defective-wrongrow` cells (`--invariant-base c632a91`) | N, A, D, C | no-harm on 50; wrong-row probe on 5 |
| E-real | `evidence_reasons` | round 10 `real-cells/labels-r10.yaml`: 13 real cells, goals 01 and 04 | N, A, C | no-harm |
| E-der | `evidence_reasons` | new, labelled below: the 13 real cells moved one row down (goals/04 R1←R2 … R5←R1; goals/01 R1←R2 … A8←R1) | N, A, C | wrong-row probe |
| W-fix, W-real | `witness_observable_in_row` | round 4c set; round 10 `witness-labels-r10.yaml` | N, A | no-harm |
| M | module-page oracles | round 8 pages and `module-pages.yaml` | N, A | per-atom smoke (production is batched; round 8: 15 of 28 units wrong under both shapes, so it can show wrong→right at most) |

**E-der labels** (lead, before the build; `fails` = evidence of another requirement): goals/04 R1
(carries R2's gates evidence) `fails` medium; R2 (carries R3's candidate scoring, which cites the
constitution's invariants) `ambiguous`; R3, R4, R5 `fails` high. goals/01 R1, R2, R4, R5, R6, A7, A8
`fails` high; R3 (carries R4's resolver suites, partly evaluation machinery) `ambiguous`. Counted:
11 `fails`; 2 ambiguous reported apart. Most real cells name their own requirement ("R2 holds", "R1
is met"), so an arm that shows the row's key gives the judge an id to compare: A can catch by
id mismatch, C by id and title.

Per-atom, cache off, two repeats, ABBA over arms per document. "Right" and "wrong" mean decided
(p ≥ 0.5) on the label's side or the other; `unknown` is a separate loss. A cell moves only when
both repeats agree.

## Bars (per oracle, fixed before the run)

- **Wrong-row (the gain):** E-der: an arm catches a `fails` cell when it reads `fails` in both
  repeats; C must catch ≥ 7 of 11, A ≥ 5 of 11; N is the baseline. E-fix wrongrow: ≥ 3 of 5 under C.
- **No harm:** right→wrong moves on the no-harm cells of an oracle (E-fix 50, E-real 13, W, M) must
  not exceed the base rate, which is the count of cells that change side between N's two repeats
  (both read against the label) plus 1. `unknown` losses are reported, and more than 2 per arm on an
  oracle counts as harm.
- **Near-threshold** (reported, not a bar: n ≈ 1–5 per set): N repeat 2 against the arm's repeat 2
  on cells whose N repeat 1 mean P is in 0.4–0.8 (compare-shapes' definition), with N repeat 2 −
  repeat 1 as the null and a bootstrap 90% interval.
- **D control:** if D catches as many E-fix wrongrow cells as A, A's catches are length, not
  address.

## Expected outcomes (recorded before the run)

| Track | N | A | D | C |
| --- | --- | --- | --- | --- |
| E-der (11 `fails`) | ≤ 2 caught | 5–8 caught (id mismatch) | — | ≥ 8 caught |
| E-fix wrongrow (5) | 0 (round 4) | 1–3 | ≤ 1 | ≥ 3 |
| E-fix 50, E-real 13 | as round 10 | no harm | no harm | no harm |
| W, M | as before | no harm; M may show 1–3 wrong→right | — | — |
| cost | — | ≤ 300 context bytes per atom, no `max_bytes` refusal | same | ≤ 400 |

## Decision rows (per oracle)

| Outcome on that oracle | Decision |
| --- | --- |
| C meets its wrong-row bar, no harm, and catches more than A beyond the two repeats' flips | ship C on `evidence_reasons`; phase 3 opens (a claim in another document is the next step) |
| C and A both meet the bars and C ≈ A (difference within the flips) | ship A, the smaller context |
| A meets its bar with no harm, C does not | ship A |
| D ≈ A on wrongrow | A's gain is length; neither ships on that ground |
| an arm harms an oracle | that arm does not ship on that oracle, whatever else it gains |
| no arm ships anywhere | the relations ship for rules; `context:` stays in the language unused by any shipped library; phases 2 and 3 declined by decision row |

Phase 2 (list items) opens only if the verdict's census finds a shipped oracle whose subject or
needed context is a list item.

## Predicate

```sh
npm test && npx vitest run doc-verify/tests/kernel/path.test.ts doc-verify/tests/kernel/keys-roundtrip.test.ts doc-verify/tests/oracles/context.test.ts doc-verify/tests/kernel/boundary.test.ts
node worklog/kernel-trials/probe/compare-arms.mjs --self-test
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons --variants N,A,D,C --invariant-base c632a91 --request-shape per-atom --repeat 2 --no-spans --ledger round12-E-fix --cap 172
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels labels-r10.yaml --variants N,A,C --request-shape per-atom --repeat 2 --no-spans --ledger round12-E-real --cap 78
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels deranged-r12.yaml --variants N,A,C --request-shape per-atom --repeat 2 --no-spans --ledger round12-E-der --cap 78
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_in_row --variants N,A --request-shape per-atom --repeat 2 --no-spans --ledger round12-W-fix --cap 218
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels witness-labels-r10.yaml --variants N,A --request-shape per-atom --repeat 2 --no-spans --ledger round12-W-real --cap 135
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle current_not_history --variants N,A --request-shape per-atom --repeat 2 --no-spans --ledger round12-M --cap 221
node worklog/kernel-trials/probe/compare-arms.mjs round12-E-fix round12-E-real round12-E-der round12-W-fix round12-W-real round12-M
```

Caps are per arm with 30% headroom over round 10's and round 8's counts (≈ 1,590 questions in all).
`compare-arms.mjs` prints per oracle and arm: caught / right→wrong / wrong→right / `unknown` /
flips, the base rate, the near-threshold report, context bytes (median, max), key-length growth,
`fallback` counts for C, labels found per arm (every labelled cell found under every arm, or
`complete: false`), and exits non-zero when `complete` is false.

## Seeded defects (each must turn the predicate red)

- "Where:" rendered inside the evidence instead of apart: the context test sees the block inside the
  evidence entry.
- The context left out of the cache key: after an ancestor heading edit the cache test sees a re-used
  answer.
- `core_cell_path/5` removed from the sandbox primitives: a module using `core.cell_path` prints
  `rejected` at load, so the test "the path module evaluates" goes red.
- `core.section_keyed` matching a prefix instead of the first token: `R1` finds `### R10 - …` in the
  path test's fixture (which holds both).
- The host key and the kernel key quoted differently for a Unicode heading: the round-trip test prints
  the mismatching pair.
- The echo rule removed: round 9's E1 module rewritten with a `row_key` step loads.
- The outbound scan skipping context: a heading containing a home path reaches the request.

## Left unmeasured

Judge models other than the production one; batched rendering of "Where:" (M is per-atom here);
the requirement's body as the claim (C shows its title only); E-real labels are judge-exposed on
goals/01's 8 cells (goals/04's 5 are the never-exposed check); oracles not listed; list items;
claims in other documents (phase 3).

## Review

`results/round-12-review.md` (verbatim). Taken before the build:
- B1: correctly placed evidence is a no-harm check; the gain is measured on wrong-row evidence (E-fix
  wrongrow and the new E-der) with its own bars.
- B2: near-threshold is reported against a repeat-2 null, not used as a bar.
- B3: the key column is a param, C falls back to A, and every labelled cell must be found per arm.
- B4: `--invariant-base` and the comparer's self-test.
- S1: the runner change is stated. S2: the E-fix size is corrected. S3: arm D added.
- S4: wrong means decided wrong; unknowns are separate; the base rate comes from N's repeats.
- S5: per-oracle decision rows, including C ≈ A. S6: M is a per-atom smoke run.
- S7: the seeds are corrected and extended, and the predicate runs boundary and `npm test`.
- Notes: the claim is the title only; caps are stated; the unmeasured list is extended.

## Amendment before the run (2026-10-14, after the build, before any live call)

1. **M track.** The 12 subtle module pages of round 8 are now refused by the structural pre-check
   (`structure.dated-prose`, gate-ledger item 10 closed by 61e84db after this plan was written), so
   they never reach the judge under any arm. M's judged units are the remaining ones (good,
   good-near, the real module pages: 12 per arm in the mock run). M stays a no-harm smoke on those;
   the subtle pages are reported as structural catches, and `complete` for M counts the judged units.
2. **Builder interpretations accepted** (no tuning to labels; recorded as decision rows with the
   verdict): steps root-down whatever the order of Kinds; a depth-1 heading appears only as `title`;
   every same-text sibling carries its index; a `section_keyed` token is a run of non-space,
   non-punctuation characters, matched exactly and case-sensitively; the run-time echo rule applies to
   every oracle with a context and `context_may_echo` does not exempt it; several context inputs render
   as groups; D's "next row" is fixed from goals/04's keys; C's fallback asks with `Q = []`;
   real-cells runs one document per batch under `--variants`.
3. **Mock cost** (builder, no live call): E-fix 132, E-real 60, E-der 30, W-fix 168, W-real 104,
   M 32 questions per arm, all under the caps; every label found under every arm; context bytes A
   106–146, C 208–272; C fallback 0.
