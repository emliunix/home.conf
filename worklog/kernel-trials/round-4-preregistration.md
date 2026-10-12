# Round 4 — evidence cells as reasoning chains: the cell grain against the section grain

Written 2026-10-13 before any live call; amended the same day after the independent review
(`results/round-4-review.md`, verbatim) and before the run. Owner direction for this round
(relayed 2026-10-13): a goal's AC evidence cell need not cite a file path; prose is fine when it
is a reasoning chain (observable facts, the claim drawn from them, a conclusion), and a bare
assertion ("done, works") must fail. The check lives in `doc-verify:goal` and runs through the
existing judge machinery. Paths stay optional: a cited file, run or commit is still checked by
`paths-resolve`. Round 3 withdrew `verification_falsifies` because one yes/no over a whole section
let a gross defect pass; this round asks the same kind of yes/no over a **smaller classification
atom** (one table cell). It is not the extraction form design 05 names (list the facts, the claim
and the conclusion and let a rule decide); that form is the next candidate if the cell grain
false-passes.

## Hypothesis

An oracle asked **once per evidence cell** (B) separates the fixture levels of goals/04's AC
coverage table (bare assertions, bare pointers, restatements, padded prose, terse cells, reasoning
chains, and a table with one bad cell among four good ones) at the scoring margin, and the same
question asked **once over the column** (A2) or **once over the section** (A) does not catch the
one bad cell in a mixed table. **Refuting cells:** (i) a B atom over a bare, pointer, restatement
or padded cell labelled `holds` at p ≥ 0.6; (ii) a B atom over a `good` or `good-nopath` cell
labelled `fails`; (iii) A2's document verdict equal to B's on every fixture including both mixed
ones (then grain is not the axis that matters, and the one-question form is cheaper).

## Axis

The evidence grain, with column scope controlled: B is one atom per cell over
`core.cell(D, R, 'Evidence')`; A2 is one atom per table over `core.column(D, T, 'Evidence')`,
the same cells one per line and nothing else; A is one atom per section over `core.own(D, S)`,
the whole table including the Design column. B against A2 isolates grain; A2 against A isolates
the Design column and header. The judge, host, kernel, governed document and the three criteria are
fixed; the wording differs only in its subject ("this cell" / "every cell"). The cell grain needs
table facts the engine did not have (`core.table/3`, `core.header/3`, `core.row/3`,
`core.cell/3`, and the evidence forms `core.cell(D, R, C)` and `core.column(D, T, C)`), added to
the TypeScript host this round with their own tests; they are what the planned extraction form of
`verification_falsifies` also needs.

## Candidates and their questions, verbatim

**B, cell grain**, `evidence_reasons(D, R, C)` in `doc-verify/lib/goal.yaml`, threshold 0.5,
labels `holds` / `fails`, evidence `core.cell(D, R, C)`:

> This is one evidence cell of a goal's AC coverage table. It holds only if it is a reasoning
> chain: (1) it states observable facts (what was run, read, measured or produced, and where),
> (2) it draws the requirement's claim from those facts, and (3) it states a conclusion. A bare
> assertion ("done", "works", "verified"), a bare pointer (a name, a round number or a path with
> nothing said about what it shows), or a restatement of the requirement fails. A path is not
> required and its presence alone does not make the cell hold.

**A2, column grain**, `evidence_column_reason(D, T, C)`, fixture-local
(`probe/oracle-fixtures/evidence_column_reason/module.yaml`), evidence `core.column(D, T, C)`:

> These are the evidence cells of a goal's AC coverage table, one per line. They hold only if
> every cell is a reasoning chain: (1) … (3) … [the same three criteria and exclusions].

**A, section grain**, `evidence_cells_reason(D, S)`, fixture-local
(`probe/oracle-fixtures/evidence_cells_reason/module.yaml`), evidence `core.own(D, S)`:

> This is a goal's AC coverage table. It holds only if every evidence cell is a reasoning chain:
> (1) … (3) … [the same].

**B', wording control**, `evidence_reasons_paraphrase(D, R, C)`, fixture-local, the cell grain
with a paraphrase ("Does it argue its case? … say what was actually observed and where … then say
what that observation establishes about the requirement, and end with the conclusion …"), run only
on `terse` and `mixed-one-pointer`.

The three parts, with examples from outside the fixtures. *Observable fact*: "the conformance
runner printed 24/24 witnesses passing" or "design 03 §Scope lists the three touched files"; a
path or document name on its own is a **pointer**, not a fact (ruling for this round: "document X"
is a pointer, "document X says Y" is a fact). *Claim drawn*: "so the kernel agrees with the model
on every gate". *Conclusion*: "R1 is met, except the boundary, which round 5 measures". The
judge cannot open cited documents, so part (1) is judged on whether the cell *states* what was
observed, not on whether it is true (left unmeasured: chain truth).

**What the judge does not see.** B's evidence is the cell alone: the requirement's text (in the
anchored root) is not in it, so part (2) is judged as "draws *a* claim", not "draws *R3's* claim".
The `defective-wrongrow` fixture measures that gap and is expected to pass; the union of root
requirement and cell is the next candidate if the gap matters. Recorded before the run.

## Fixtures (`probe/oracle-fixtures/evidence_reasons/`, reused by the other sets via `files_from`)

Written before the run by the fixture author (an opus seat, not the plan author), from goals/04
at HEAD with **only the five Evidence cells changed**; the runner's `invariant:
evidence-column-only` check compares every other line and the Design column with HEAD before any
call. The fixture author's per-cell reading is in `fixtures.yaml`; the lead's predictions are
below. **No fixture is replaced after the run**, and **goals/04 itself is edited only after the
verdict**, if at all.

| Fixture | Cells | Role |
| --- | --- | --- |
| `good` | true chains, 2–4 sentences, paths kept (every path tracked) | ceiling |
| `good-nopath` | the same chains with every path and file name replaced by prose | the owner's point: prose is fine |
| `good-dangling` | `good` with R2 citing `round-2-gates.md`, which does not exist | paths-resolve and the oracle are independent |
| `terse` | goals/04 at HEAD, byte-identical | the cells the owner called the passing fixture; now under test |
| `defective-bare` | five different bare assertions (`done, works`; `verified`; `covered`; `yes, complete`; `ok`) | the owner's falsifier; a floor |
| `defective-pointers` | the five cells from `8b1e4a9`, verbatim | the owner's seeded failing fixture |
| `defective-restatement` | "Rn is met: …" restating each requirement, no fact | round 3's winning defect, transposed |
| `defective-padded` | 70–77 words of confident prose per cell, no file, run, number or document | length control |
| `defective-wrongrow` | the `good` chains rotated by one row | the known gap (requirement text unseen) |
| `mixed-one-bare` | `good` with R3 = `done, works` | the grain test |
| `mixed-one-pointer` | `good` with R4 = `kernel-trials K3` | the grain test, subtle |

Every fixture must PASS the draft profile with a refusing judge (structure intact; expected: all
eleven PASS, `paths-resolve` warning count 0 except `good-dangling` = 1).

## Measurements

- **Per cell** (B, B'): label and argmax p per atom; a cell *separates* when it lands on its
  expected side at **p ≥ 0.6** (the scoring margin; 0.5 is the declared threshold, so an answer in
  [0.5, 0.6) decides the document but is not counted as separation). `unknown`, a threshold
  demotion, or a label on the expected side below 0.6 is *not separating* and is reported as its
  shape; for a defective fixture it is not a false pass. A fixture separates when every cell does;
  partial counts are k/5.
- **Per table / section** (A2, A): the one atom's label and p per fixture.
- **Document verdict** per fixture per candidate: the comparison across candidates is made here
  (PASS / NO-GO / NEEDS-REVIEW), with the per-cell tables as diagnostics. A PASS on a defective or
  mixed fixture is a **false pass** and is reported first.
- **Stability**: the B track is run twice per fixture with the cache off (`--repeat 2`); the
  share of B atoms whose label is unchanged, over 55 atoms.
- **Real cells**: goals/01's six `Evidence` cells through the shipped constraint and goals/02–03's
  thirteen `Evidence required` cells through a fixture-local control with the same question;
  agreement with the lead's blind labels in `probe/oracle-fixtures/real-cells/labels.yaml`,
  committed before the run.
- **Cost**: questions per track from the mock projection (exact main questions; worst case adds one
  span follow-up per non-passing atom), charged to a separate ledger per track.
- **Engine gates** (no judge): `npm test`, with `tables.test.ts` covering escaped pipes and pipes in
  code spans, the front matter, a fenced table, a heading with no table, a delimiter-count
  mismatch, exact header matching, an empty cell, a table without the column (binds nothing), the
  cell and column evidence forms, and a scripted judge that violates only the rows it fails.
  Passed before this amendment was written (259 tests).

## Expected outcomes (recorded before the run)

Per-cell predictions for B (the lead's; the fixture author's reading is in `fixtures.yaml` and
agrees except where noted):

| Fixture | B, per cell | A2 (column) | A (section) | Confidence |
| --- | --- | --- | --- | --- |
| `good` | 5/5 `holds` ≥ 0.6 | `holds` | `holds` | medium-high |
| `good-nopath` | 5/5 `holds` | `holds` | `holds` | medium; a `fails` here says the judge rewards paths |
| `good-dangling` | 5/5 `holds`; `paths-resolve` warns once | `holds` | `holds` | high |
| `terse` | row1 `fails`, row2 **`holds`** (a document-says-Y fact; the lead expects the judge to accept it), row3 `fails`, row4 `fails`, row5 `fails`; the author predicts 5/5 `fails` | `holds` (false pass) | `holds` (false pass) | low on row2 and row3; the document verdict NO-GO under B either way |
| `defective-bare` | 5/5 `fails` | `fails` | `fails` | high; a `holds` is a broken wording |
| `defective-pointers` | row1, row4, row5 `fails`; row2 `fails`; row3 borderline, predicted `fails` but a `holds` does not refute | `fails` | **`holds`** (the Design column's paths read as evidence) | medium-low; the most probable refutation is a `holds` on row3 or row2 |
| `defective-restatement` | 5/5 `fails` | `fails` | `fails` | **low**: round 3 saw restatements pass at 0.97; a `holds` here is the pre-stated false-pass reading, "the judge accepts a confident conclusion as a chain", and the extraction form is next |
| `defective-padded` | 5/5 `fails` | `fails` | `fails` | medium; a `holds` means B separates on length |
| `defective-wrongrow` | 5/5 `holds` (the gap) | `holds` | `holds` | medium-high |
| `mixed-one-bare` | row3 `fails`, others `holds`; document NO-GO | **`holds`** (one bad line among four long good ones) | `holds` | medium: this is the grain test |
| `mixed-one-pointer` | row4 `fails`, others `holds`; document NO-GO | `holds` | `holds` | medium-low on B's row4 |
| B' on `terse`, `mixed-one-pointer` | the same labels as B on 8 of 10 cells | | | low |
| stability | ≥ 0.9 over 55 atoms | | | medium |
| real cells, goals/01 | ≥ 4/6 agree with the lead | | | medium |
| real cells, goals/02–03 | the judge says `holds` on ≥ 7/13 (specific check descriptions read as evidence) | | | low |

**Reading the grain test.** If A2 says `fails` on both mixed fixtures, the one-question column
form catches a single bad cell and the hypothesis's cell (iii) refutes the grain claim; B is then
kept only if its per-row finding (the row's line, one repair) is worth five questions, which the
verdict must argue. If A2 says `holds` on either, grain matters.

## Cost and caps (mock projection, exact)

| Track | Runs | Main questions | Worst case | Cap (≈1.5× worst) | Ledger |
| --- | --- | --- | --- | --- | --- |
| B fixtures, `--repeat 2` | 22 | 132 | 264 | 400 | `round4-B` |
| A2 | 11 | 11 | 22 | 40 | `round4-A2` |
| A | 11 | 11 | 22 | 40 | `round4-A` |
| B' | 2 | 10 | 20 | 30 | `round4-Bp` |
| real cells | 1 | 22 | 44 | 70 | `round4-real` |

Main questions include one `coverage_complete` atom per promotion run of goals/04 (the shipped
goal module), which is not a candidate. Every run is cache off.

## Predicate

```sh
npm test                                                                                     # engine gate
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons --repeat 2 --ledger round4-B --cap 400 --show-evidence
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_column_reason --ledger round4-A2 --cap 40
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_cells_reason --ledger round4-A --cap 40
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons_paraphrase --ledger round4-Bp --cap 30
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --ledger round4-real --cap 70
```

Each prints `complete: true|false` for its own track, a per-leaf table, the per-fixture k/n, the
false passes, and the question count against its cap. The mock form (`DOC_VERIFY_MOCK_JUDGE=1`)
of each ran before this amendment: every fixture leaf found, every invariant `ok`, every draft
PASS, costs as tabled.

## Left unmeasured

Judge variation (one judge); wording variation beyond one paraphrase on two fixtures; the
threshold from more fixtures than these; the extraction form; the union of requirement text and
cell (finding 7 of the review); chain truth (a well-formed chain with invented facts passes);
cost against a human read is stated in the verdict as questions per goal file against reading its
cells, not measured.

## Review

The independent seat's review is `results/round-4-review.md`, verbatim: fourteen findings, "run
after amendments". Taken before the run, item by item:

1. mixed fixtures added (`mixed-one-bare`, `mixed-one-pointer`); the grain claim is tested on them,
   with the uniform fixtures as floor and ceiling; the cross-candidate comparison is at the
   document-verdict level.
2. candidate A2 added over the new `core.column` evidence form; A2 against B isolates grain, A
   against A2 the column scope.
3. `good.md` written before the run by a separate seat; `terse` is a fixed level with per-cell
   predictions; no fixture replaced after the run; goals/04 edited only after the verdict.
4. every fixture is HEAD with only the Evidence cells changed, checked by the runner; the pointer
   ruling recorded; R3 marked as not refuting.
5. bare strings varied; restatement, padded and wrong-row controls added; cache off everywhere;
   the length caveat stated.
6. `good-nopath` and `good-dangling` added with the `paths-resolve` count per fixture.
7. the requirement text is not added to the evidence this round; the question is left as is and
   the gap is measured by `defective-wrongrow` and named as the next candidate.
8. asks quoted verbatim; the three parts defined with outside examples; "extraction" replaced by
   "smaller classification atom".
9. refuting cells folded into the hypothesis; the non-decision shapes classified; 0.5 declared and
   0.6 scoring stated; confidence on pointers and restatements lowered with the false-pass reading;
   expectations added for the structural catch, `paths-resolve` counts, cost and stability.
10. the parser cases added to `tables.test.ts`; the runner prints parsed rows and cell text.
11. not taken as written: the oracle stays in `doc-verify:goal` because the owner asked for it
    there, but nothing is committed before the verdict; if the verdict is against B it ships as a
    warning, and the decision row says so.
12. the lead's blind labels for goals/01–03 committed before the run; the real-cell track added.
13. caps per track from the mock projection; `complete` per track; the B track repeated.
14. stability and the paraphrase added; judge variation and chain truth left unmeasured and said so.
