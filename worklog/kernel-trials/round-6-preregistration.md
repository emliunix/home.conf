# Round 6 — request shape: batched against per-atom, accuracy first

Written 2026-10-13 before any live call; amended the same day after the independent review
(`results/round-6-review.md`, verbatim) and before the run. The judge is asked in batches by
default: one request carries every demanded atom of a document, each atom a keyed entry in the
shared state and each question opening "Judge ONLY state.evidence.<key>". A module may declare
`request_shape: per-atom`. Round 3 listed "per-atom versus batched for the same atoms" as
unmeasured. The owner's direction of 2026-10-13: accuracy is the priority; measure whether the
batch costs any, and let the measurement set the default.

## What is actually compared

The review is right that request count is not the axis: under `batched` the judge sees the
sibling atoms' evidence and questions in one prompt, under `per-atom` one atom alone. The axis is
**context plus prompt sharing**. Both shapes run the span follow-ups the same way (one keyed
batch per document, after the main labels; they do not feed the main label), so the follow-ups
are switched off for this round (`--no-spans`). The engine orders a batch by atom key
(`localeCompare`, so row1, row10, row11, …, row2), and the actual position is recorded.

## Hypothesis

Against the fixtures' fixed expected labels, per-atom is **not more accurate** than batched:
on the discordant cells (one shape right, the other wrong) an exact McNemar test shows no
advantage for per-atom, and the mean signed shift of P(expected side), per-atom minus batched,
on the near-threshold stratum has a 90% bootstrap interval inside ±0.05 and does not exceed the
noise floor (the same shift between two repeats of one shape). **Refuting cells:** per-atom
right where batched is wrong on k ≥ 3 labelled cells with at most m = 1 reverse discordants,
reproduced on both repeats (per-atom wins); the mirror of that (batched wins, also a finding);
the interval of the signed shift on the stratum excluding ±0.05 beyond the floor; a position
effect identified under the permuted arm.

## Candidates (arms)

| Arm | What the judge sees | Requests per document round |
| --- | --- | --- |
| batched | every demanded atom of the document in one request (checked: exactly one request, else the run is marked `split`) | 1 |
| per-atom | one atom per request | one per atom (6 on goals/04, 14 on design/04) |
| batched, reversed | as batched, with the table's data rows reversed in the fixture so each cell sits at a different position (invariant `row-permutation`) | 1 |

Runs are interleaved per fixture in one invocation, ABBA (batched, per-atom, per-atom, batched),
two repeats each, cache off, so drift lands on both arms. The model id and backend version are
logged per run; the first and last batched repeats are the drift check.

## Atoms

- Round 4's `evidence_reasons` set: 11 fixtures × 5 cells (55; reversed arm on good,
  defective-pointers, controls, mixed-one-pointer).
- Round 4c's `witness_observable_in_row` set: 6 fixtures × 14 rows (84; reversed arm on all
  six).
- The real cells of goals/01–04 and design/02–05 through the shipped modules (both arms; the
  **mixed-batch** stratum: a batched request carrying more than one oracle, which is the shipped
  case). The blind labels of rounds 4 and 4c predate the rewrites of goals/01, goals/04,
  design/03 and design/05, so agreement with them is printed as information, not used in the
  decision.
- The batched labels of rounds 4 and 4c are priors, not controls: the batched arm is re-run.
  Near-threshold stratum: cells whose batched mean P(expected side) in this run lies in
  [0.4, 0.8] (about 10–12 cells by the priors).

## Measurements (`probe/compare-shapes.mjs`, self-tested on a synthetic sidecar with a planted flip, a planted discordant cell and a planted position trend)

- Correctness 2×2 per shape against the expected labels; McNemar on the discordant cells; the
  discordant cells listed with both repeats.
- Signed shift d per cell on P(expected side), means over repeats; bootstrap 90% interval and
  Wilcoxon over all cells and over the near-threshold stratum; the noise floor from repeat pairs
  within each shape; duplicate cell texts counted once.
- Confident flips (p ≥ 0.6 on both sides, different labels) listed first, with whether each
  reproduces on both repeats.
- `unknown` transitions and shape shares (`decides`, `judge-unknown`, `threshold-demoted`,
  tie) per arm; total variation per cell as the second distance.
- Position: regression of the signed shift on actual position with the row as a fixed effect,
  identified by the reversed arm.
- Cost per arm: requests, questions, state bytes, wall time.
- `complete` false if any (fixture, atom) pair is missing from an arm or a batched run split.

## Expected outcomes (recorded before the run)

| Measure | Expectation | Refuting cell | Confidence |
| --- | --- | --- | --- |
| McNemar | discordant cells ≤ 4, split evenly; no advantage | k ≥ 3 one-sided with m ≤ 1, on both repeats | medium |
| signed shift, stratum | mean within ±0.03, interval inside ±0.05, not beyond the floor | interval outside ±0.05 beyond the floor | medium-low |
| noise floor | within-shape repeat shift ≈ 0.02 on the stratum (batched's known self-flip is gross row13) | — | low |
| confident flips | 1–3 under noise, none reproducing on both repeats | a reproducing flip | medium |
| seeded cells batched missed | per-atom labels gross row13 `fails` ≥ 0.6 on at least one repeat; controls row1 stays `holds` | the reverse pattern counts for batched | low |
| `unknown` transitions | none | a shape with `judge-unknown` share > 0.05 | medium |
| position | no effect identified under the reversed arm | a slope significant under both orders | medium-low |
| mixed batch | no larger shift than single-oracle batches | the mixed stratum's shift beyond the floor | low |
| cost | per-atom requests 6–14× batched; wall time close to the request ratio; bytes roughly equal | no decision depends on it | medium |

## Decision rule (recorded before the run)

- No refuting cell: **batched stays the default**; the verdict records the measured shift band
  and the batch sizes it was measured at (≤ 14).
- Per-atom wins by the McNemar rule, or the stratum shift favours per-atom beyond the floor
  and ±0.05, or a position effect is identified: **per-atom becomes the default** in the shipped
  modules and the library default, the cache key gains the request shape (a batched answer must
  not serve a per-atom request), and the cost is accepted.
- Batched wins by the mirror rule: batched stays, and the finding that context helps is recorded
  against round 4's A2 result.
- Mixed: no shipping change; the next step is a larger-batch measurement.

## Predicate (as run; the implementation seat's ABBA runner supersedes the per-shape commands)

```sh
node worklog/kernel-trials/probe/compare-shapes.mjs --self-test
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons          --request-shape both --repeat 2 --reversed --reversed-only good,defective-pointers,defective-restatement,mixed-one-pointer --invariant-base c632a91 --positions --ledger round6-B --cap 450
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_in_row --request-shape both --repeat 2 --reversed --positions --ledger round6-C2 --cap 756
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels labels.yaml         --request-shape both --repeat 2 --ledger round6-real-goal   --cap 144
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels witness-labels.yaml --request-shape both --repeat 2 --ledger round6-real-design --cap 180
node worklog/kernel-trials/probe/compare-shapes.mjs round6-B round6-C2 round6-real
```

Mock projection (spans off, so worst case = main questions): B 300 (132 + 132 + 36 reversed),
C2 504 (168 + 168 + 168), real goals 96, real designs 120; 1020 in all. Caps at 1.5×. The
evidence set's fixtures are goals/04 as it stood at `c632a91` (round 4's base; the document was
rewritten afterwards), so its column-only invariant is checked against that revision; every
goals/04 batch is mixed-oracle (`coverage_complete` rides along), which the mixed stratum
exposes, while design/04 batches are single-oracle.

## Left unmeasured

Batch sizes above 14 (the verdict says "measured at ≤ 14"); judge variation; the follow-ups'
own shape; the known-unknown label under either shape.

## Review

`results/round-6-review.md`, thirteen findings, "run after amendments". Taken before the run:
1 (decision on correctness against the fixed labels, McNemar, k and m pre-registered, the mirror
branch), 2 (signed shift on P(expected side), bootstrap interval, Wilcoxon, the stratum, the noise
floor, an equivalence bound), 3 (axis renamed; follow-ups off; split check; actual position
recorded; the cache-key note in the decision rule), 4 (the reversed arm; position by regression
with row fixed effect), 5 (ABBA interleaving; model and version logged; drift check), 6 (sidecars
with full distributions; the comparer with a seeded self-test), 7 (real cells under both arms;
blind-label agreement demoted to information), 8 (the mixed-batch stratum through the shipped
modules), 9 (not run; the bound stated), 10 (`unknown` transitions and total variation), 11
(refuting cells filled; flips must reproduce), 12 (projection × repeats; bytes and wall time),
13 (priors named as priors; duplicates counted once).
