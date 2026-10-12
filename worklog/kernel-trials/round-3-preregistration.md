# Round 3 — the oracle toolkit's first run: separation, decisiveness, stability, cost

Written 2026-10-12 before any live call. **Review pending** before the run. Owner direction for
this round: the oracle is authored with its knobs, calibrated by fixtures like unit tests, and the
engine holds no opinion about it (design/05 §Oracle toolkit). This round builds the fixture runner
as a prototype of `doc-verify oracle test` and takes the first live measurements the project has
ever had of its semantic oracles (constitution R5).

## Hypothesis

Each oracle in use by home.conf's own configuration separates its good fixture from its defective
fixture at its declared threshold, decides (an answer other than `unknown` that clears the
threshold) on at least half of the atoms the corpus demands, and gives the same label when asked
again with the cache off. **Refuting cell:** an oracle whose good and defective fixtures land on
the same side, or whose corpus decisiveness is below one half, or whose repeat label differs on
more than one atom in ten.

## Axis

The oracle. Each oracle in use is one candidate; the judge, the host and the kernel are fixed. The review
notes that each candidate bundles its question wording, evidence selector, byte size and label
shape, so a difference between oracles cannot be attributed to one of them; this round claims only
"does each oracle, as declared, work", not which knob makes it work.
Live answers come through the existing TypeScript host (`doc-verify check` with the production
backend), which is the judge harness, not the subject; its oracle leaves (label, distribution,
threshold, sections, bytes) are the measurement.

## Candidates (oracles in use by `.doc-verify.yaml` at HEAD)

| Oracle | Declared in | Asked over | Threshold |
| --- | --- | --- | --- |
| `problem_resolved(D, L)` | `doc-verify/modules/design.yaml` | problem statement + rationale, union | 0 |
| `verification_falsifies(D, S)` | `doc-verify/modules/design.yaml` | the verification design section | 0 |
| `coverage_complete(D, L)` | `doc-verify:goal` | root requirements + AC coverage, union | 0.5 (the only non-zero threshold; corrected after review) |
| `evidence_not_law(D, S)` | `doc-verify:receipt` | each outermost selected section | library default |
| `scope_explicit(D, S)` | `doc-verify/modules/design-03.yaml` | design/03 only | 0 |

**Correction before the run (mock cost run, 2026-10-12):** the `module-*` oracles are reached:
`docs/modules/*` is governed, so the corpus asks `current_not_history` (29 atoms),
`pairs_every_property` (4) and `properties_are_claims` (4) per run. They are corpus candidates
for decisiveness and stability only; their fixtures (the good/bad pairs in
`doc-verify/lib/examples/`) are a later round. `purpose`, `falsifies` and
`prescribes_implementation` remain unreached. Atom counts in the working tree, which includes
the untracked design/05 and goals/04: `problem_resolved` 5, `verification_falsifies` 4,
`coverage_complete` 4, `evidence_not_law` 1, `scope_explicit` 1. Live cost from the mock run:
27 + 104 main questions, 262 worst case with every span follow-up, under the cap.

## Fixtures

Fixtures are written by the fixture author (an opus seat), not by the author of this plan; the
author's own doubts about four edits are recorded in `probe/oracle-fixtures/README.md` and read
with the results (the `scope_explicit` subtle edit is the weakest). Per candidate, one `good` and **two**
`defective` fixtures (`defective-gross.md`, one obvious edit; `defective-subtle.md`, one edit a
careless reader would miss) in `probe/oracle-fixtures/<oracle>/`:
- `good.md` is a governed document at HEAD that the author of this plan judges to satisfy the
  question (design/04 for the design oracles, goals/03 for coverage, the one receipt).
- `defective.md` is the same document with one seeded edit that makes the question's answer
  `fails` by construction, written down in `fixtures.yaml` with the edit and why it fails: a
  rationale that argues for an unrelated mechanism; a verification table whose "failure witness"
  column is replaced by restatements of the claim; an AC coverage table with one root requirement
  row deleted; a receipt section rewritten as a rule ("always do X") instead of evidence.
- `scope_explicit`: the "Scope - what we touch" section cut to one vague sentence.
- `fixtures.yaml` (prototype of the oracle toolkit's fixture format): oracle, inputs, the expected
  label per fixture, and the edit.
- Every defective fixture must still PASS the draft profile (structure intact); the runner checks
  this before reading the oracle leaf, and a fixture that fails structure is a fixture defect.

The runner `probe/oracle-test.mjs` evaluates each fixture through `doc-verify check --paths
<fixture> --profile promotion --no-cache --format json` in a scratch repository (as `mutate` does)
and reads the oracle leaf for the atom named in `fixtures.yaml`.

## Measurements

- **Separation**, per oracle: `good` labelled `holds` and each `defective` labelled `fails`, each
  with the argmax distribution value **at or above 0.6**. A `good` that comes back `unknown` or
  `fails` counts as *not separating*; it is not a reason to replace the fixture and rerun. Only
  if the independent seat, reading the good document against the ask text, rules it defective is
  the fixture replaced, and that ruling is recorded.
- **False pass**: every defective fixture's document verdict; a PASS on a defective fixture is the
  failure the proposition is about and is reported first.
- **Decisiveness**, per oracle, on the corpus (`check --all --profile promotion --no-cache
  --format json`), reported as three separate shares of the oracle's leaves: *judge-unknown* (the
  judge chose the `unknown` option: a question or evidence problem), *threshold-demoted* (argmax
  below the declared threshold: a calibration problem; only `coverage_complete` can show it at
  0.5), and *tie or malformed*. "Decides" means none of the three.
- **Structural-only catch**: every defective fixture run under the draft profile with no judge;
  whether the structural constraints alone already catch the seeded defect. A defect the
  structure catches says nothing about the semantic half.
- **Stability**: the corpus run repeated once with the cache off; the share of atoms whose label
  is unchanged. Reported only for oracles with at least 5 atoms; others are *not assessable*. The
  argmax-value change is reported but, per R1, not interpreted.
- **Cost**: questions, evidence bytes and wall time per run; per-atom versus batched request
  shape is noted where a module declares it.
- **Budget cap**: at most 300 judge questions across the round (fixtures, two corpus runs, span
  follow-ups, which cost one extra question per non-passing leaf); the mock run computes the exact
  cost before any live call, and the runner stops at the cap with `complete: false`.

## Expected outcomes (recorded before the run)

| Oracle | Separation | Decisiveness | Stability | Confidence |
| --- | --- | --- | --- | --- |
| `problem_resolved` | gross separates at p ≥ 0.6; subtle does **not** (predicted `holds` or `unknown`) | judge-unknown ≤ 0.5 | ≥ 0.9 over 5 atoms | medium |
| `verification_falsifies` | both separate at p ≥ 0.6 | judge-unknown ≤ 0.5 | not assessable (4 atoms) | medium-high |
| `coverage_complete` | **gross does not separate**: predicted `good` = judge-unknown (the one cell that refutes this row is: good `holds` ≥ 0.6 and gross `fails` ≥ 0.6) | judge-unknown > 0.5 | not assessable (3 atoms) | high; basis is design 04's v1 measurement at a different threshold and request shape, so it is a prediction, not a regression gate |
| `evidence_not_law` | gross separates; subtle does not | one document | not assessable | low |
| `scope_explicit` | gross separates | one document | not assessable | low |
| any oracle | **no defective fixture PASSes** | | | high; a PASS here refutes the proposition's condition for that oracle |
| `current_not_history` (corpus only) | — | judge-unknown ≤ 0.2 (a simple, local property) | ≥ 0.9 over 29 atoms, the one assessable row | medium |
| `pairs_every_property`, `properties_are_claims` (corpus only) | — | judge-unknown ≤ 0.5 | not assessable (4 atoms) | low |

If `coverage_complete` fails as expected, the finding is about the oracle's declaration, not the
engine: a union over two long sections asked as one classification is the coarse question design
05 §Oracle toolkit says should be an extraction. That becomes round 4's candidate.

## Predicate

`node probe/oracle-test.mjs --fixtures` and `node probe/oracle-test.mjs --corpus --repeat 2`, each
printing `complete: true|false`, a per-oracle table, and the question count against the cap. The
round's verdict compares the table with the expectations above, row by row.

## Left unmeasured

The judge's answer under `per-atom` versus `batched` for the same atoms (R2); calibration of a
threshold from more than three fixtures; variation across judge model and question wording (one
judge, one wording per oracle: "the oracle separates" cannot be told from "this wording on this
judge separates"); the extraction form of any oracle; cost per verdict against a human read; the
trust boundary (round 4).

## Review

The independent seat's review is kept verbatim in `results/round-3-review.md`. It found: the
`coverage_complete` threshold mis-stated (0, actually 0.5); decisiveness conflating the judge's
own `unknown` choice with a threshold demotion; stability meaningless at n < 5; separation with
no margin; no pre-stated reading for a good fixture that fails; the `coverage_complete` row a
disjunction only one cell could refute; one fixture per side too weak and the receipt edit the
weakest; no `scope_explicit` edit; the harness dragging in structural constraints; no false-pass
check; and three things unmeasured (structural-only catch, cost against a human read, judge and
wording variation). Every item is amended above before the run.
