# Round 3 verdict — the oracle toolkit's first live run (2026-10-12)

## Predicate

```sh
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --cap 300          # complete: true, 33 questions
node worklog/kernel-trials/probe/oracle-test.mjs --corpus --repeat 2 --cap 300  # complete: true, 104 questions
```

Run once live by the lead after the mock cost run; the ledger holds every request.

## What measured

Separation on seeded edits, per oracle (model: the toolkit's own gate, not the engine's):

| Oracle | Gross edit | Subtle edit |
| --- | --- | --- |
| `evidence_not_law` | separates (0.94) | separates (0.73) |
| `coverage_complete` | separates (0.83) | threshold-demoted (`unknown` 0.44 < 0.5), routed to review, not a false pass |
| `problem_resolved` | separates (0.99) | **false pass** (holds 0.65) |
| `scope_explicit` | separates (0.82) | **false pass** (holds 0.98; the weakest edit by the author's own note) |
| `verification_falsifies` | **false pass** (holds 0.97) | **false pass** (holds 0.99) |

Decisiveness and stability on the corpus (26 governed documents, 52 atoms, two runs, cache off):
every leaf `holds`; judge-unknown 0 for every oracle; stability 1.00 on the two assessable rows
(29 and 5 atoms) and on every smaller one; mean |Δp| ≤ 0.026.

## Expectations the run contradicted

- **`coverage_complete` was predicted not to separate** (basis: design 04's v1 `unknown` at
  0.92–0.95). It separates the gross edit at 0.83 and its good fixture is `holds` 0.72, not
  `unknown`. The v1 measurement does not carry over to this request shape and threshold. The
  prediction was wrong; corrected here.
- **`verification_falsifies` was predicted to separate both edits**, medium-high confidence. It
  separates neither: a verification table whose "failure witness" column is replaced by
  restatements of the property is `holds` at 0.97. The reviewer's warning ("the risk is a judge
  calling a restatement an observable witness") was exact. This is the round's headline.
- **Decisiveness was predicted to be a problem** (judge-unknown up to 0.5 on several oracles).
  It is 0 everywhere on the corpus. The judge, under this host and these thresholds, does not punt;
  it says `holds`.

## What the round says about the semantic half

The two concerns raised before the round, that the judge punts (decisiveness) and that its
answers wobble (stability), are both refuted on this corpus: the judge is decisive and stable.
The real defect is **discrimination**: on the oracle that guards the most load-bearing property,
the judge agrees with everything, including a gross defect. Three of five oracles separate a
gross edit; two of five let a subtle one pass; one lets everything pass. The proposition's
condition, "relative to the oracle contracts the author declared", fails for
`verification_falsifies` as declared, and the toolkit is what shows it: the engine was right to
hold no opinion, and the fixtures were the only thing that could.

Why `verification_falsifies` fails, read from its contract: one classification over a whole
section (up to 4 KB), asking whether the section "names observable failure witnesses for its
load-bearing claims". That is a relation between claims and witnesses asked as a yes/no over the
block, and the block still contains a Command column and a sentence about seeded defects. The
form design 05 §Oracle toolkit names for this case is extraction: list the claims, list each
claim's witness, and let a rule decide whether each witness is observable (a command, a test, a
measurement) rather than a restatement.

## Which candidate it selects

The toolkit (fixtures per oracle, a runner that reports separation, false pass, the three
non-decision shapes and stability) is confirmed as the right place for oracle quality. Among the
oracles: `evidence_not_law` and `coverage_complete` stand as declared; `problem_resolved` and
`scope_explicit` stand for gross defects and need a subtle fixture to be re-examined by the
seat (the `scope_explicit` subtle edit may not be a defect at all); `verification_falsifies` is
**withdrawn as declared** and becomes round 4's subject in extraction form.

## Left unmeasured

Per-atom versus batched for the same atoms; judge and wording variation; threshold calibration
from more than three fixtures; cost against a human read; the module-* oracles' own fixtures
(`doc-verify/lib/examples/` pairs); the trust boundary (now round 5).

## Files

`round-3-preregistration.md`, `results/round-3-review.md`, `results/round-3-fixtures-live.md`,
`results/round-3-corpus-live.txt`, `probe/oracle-test.mjs`, `probe/oracle-fixtures/`.
