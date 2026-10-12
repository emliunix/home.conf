# Round 8 — the module-page oracles' request shape

Written 2026-10-13 before any live call; amended the same day after the independent review
(`results/round-8-review.md`, verbatim) and before the run. Round 6 made `per-atom` the judge's
default on the measured modules and pinned the four module-page libraries
(`doc-verify:module-contract`, `module-model`, `module-properties`, `module-verification`) to
`batched`, because the hook's full-corpus run under per-atom demoted one atom
(`module-model-is-current` on `docs/modules/oracles/model.md` §concepts, `unknown` at 0.49
against 0.5) that batched passes, and those oracles had been calibrated batched only (round 3's
corpus: every leaf `holds`, stability 1.00). This round measures them so each library's pin is a
decision. task.md item 2.

## The oracles, and what this round can and cannot decide

| Library | Oracle | Grain | Real atoms (16 pages at HEAD, recounted by the builder) |
| --- | --- | --- | --- |
| module-contract, module-model, module-properties, module-verification | `current_not_history(D, S)` | every section (`core.body`: heading plus subtree) | ≈ 29 |
| module-verification | `pairs_every_property(D, S)` | one section per page | 4 |
| module-properties | `properties_are_claims(D, S)` | one section per page | 4 |

The two one-section oracles are **smoke-tested, not measured** (n ≈ 4 real plus a handful of
fixtures); they cannot trigger the decision rule either way. The pin is decided **per library**:
`module-contract` and `module-model` (which carry only `current_not_history`) on the full
evidence; `module-properties` and `module-verification` hold their pin unless the
`current_not_history` evidence on their pages is one-sided, with the n disclosed.

## Hypothesis

On seeded `current_not_history` fixtures that the checker's dated-prose regex does **not** catch
(subtle history: "previously returned", "used to be", "originally", "as of v2"), per-atom is at
least as accurate as batched against the fixtures' expected labels; on the real pages' blind
labels, agreement under per-atom is within one cell of batched's; and the signed shift of
P(expected side) on the near-threshold stratum has a 90% interval inside ±0.05 beyond the noise
floor. **Refuting cells:** per-atom wrong where batched is right on k ≥ 3 labelled atoms with at
most m = 1 reverse (per-atom loses discrimination; the pin stays on that library); the mirror
(batched loses; recorded against round 3, the pin removed); a stratum shift beyond ±0.05 and the
floor in either direction; a disagreement rate on real pages above 20% under both shapes
(the oracle's reading is not the lead's: a question finding, no pin change).

## Axis

Request shape, as round 6: `batched` against `per-atom`, ABBA per document, two repeats, cache
off, span follow-ups off, the same judge. The runner's copied-library mechanism (`applyShape`,
`.shapes/`) rewrites the pin line in the copy; `doc-verify:references`, reached only by
`extends`, declares no shape and does not make per-atom sticky. No shipped file changes before
the verdict. The clone is taken at the commit named in the ledger, so a mid-programme edit of a
page does not move the fixture.

## Fixtures (the builder's deliverable, per kind: `probe/oracle-fixtures/module_<kind>_pages/`)

Per kind (contract, model, properties, verification), under the rule `artifact_kind:
module-<kind>`, `modules: [doc-verify:module-<kind>]`, document path
`docs/modules/_fixtures/<kind>.md` (matching the pattern the rule needs; the builder adds the
pattern to the scratch clone's config, not to the repository's):

- `good.md`: the library's example page at HEAD (regex-clean; every section expected `holds`).
- `good-near.md`: `good.md` with one sentence that narrates a current rule in a Concepts-like
  voice without history words (expected `holds` on every section; the margin case).
- `subtle-1.md`, `subtle-2.md`, `subtle-3.md`: `good.md` with one regex-clean history edit each
  ("Placement previously returned the ledger row; callers moved to the id after the
  double-count." / "As of v2 the order is a map; it used to be a list." / "Originally idempotent
  only within a session."), each in a different section.
- `gross.md`: the shipped `-bad.md` (its edit trips the dated-prose regex; expected draft NO-GO
  "caught"; a control that the structural pre-check still works, not a judge measurement).
- For module-properties and module-verification, one extra seeded page each for the
  one-section oracle's unseeded clause (a property id named in the page's own prose with no
  check or limit; an unfalsifiable property row), smoke-tested.

**Expected label rule (pre-registered):** an atom's expected label is `fails` iff its section's
body (heading plus subtree) contains the edit; so a bad page's title atom fails along with the
edited section, and the `holds` side of the 2×2 comes from the good pages. `fixtures.yaml` lists
every section id with its expected label and the reason; every edit is an `edit {from, to}`
block checked against `good.md`; every fixture's draft status is pre-registered (PASS except
`gross`).

## Runner extension (the builder's deliverable, specified here)

`atom.per_section: true` with `expect_sections: {<section-id>: label}`; a section-keyed leaf
match (the atom's last argument is the section); per-kind sets with distinct ledgers; the
real-page track accepts a labels file with a per-document `rule` (four kinds, four libraries)
and matches `current_not_history` atoms by their section argument; `compare-shapes.mjs`
self-test extended with a planted section-keyed flip. A mock run proves the leaf count per page
before any live call.

## Real pages: blind labels

The lead labels every `current_not_history` atom of the 16 pages at the ledger's commit, blind,
with confidence, in `probe/oracle-fixtures/real-cells/module-pages.yaml` before any live call;
the lead discloses that it knows the `concepts` result (per-atom 0.49) and labels that atom
anyway, and `scout` labels that one atom independently. Agreement per shape is reported against
these labels, with round 6's lead-label noise (26/30) as the ceiling on what agreement can show;
the post-hoc read of disagreements is a second column, never the labels. The near-threshold
stratum is defined from the **first batched repeat's** p in [0.4, 0.8] (no independent prior
source exists; round 3 recorded labels, not p), stated as such.

## Measurements

Round 6's comparer on section-keyed atoms: confident flips first (p ≥ 0.6 both sides,
different labels, reproduced on both repeat pairs); correctness 2×2 with exact McNemar; signed
shift with bootstrap 90% interval, all cells and the stratum; noise floors from repeat pairs;
`unknown` transitions (the `concepts` atom named and counted separately); cost (requests,
bytes, wall) per shape; draft status per fixture.

## Expected outcomes (recorded before the run)

| Measure | Expectation | Refuting cell | Confidence |
| --- | --- | --- | --- |
| subtle fixtures, batched | ≥ 10 of 12 edited sections `fails` ≥ 0.6 | < 8 | medium-low (subtle history was never measured) |
| subtle fixtures, per-atom | the same count ± 1 | 3 worse | medium |
| good and good-near | every section `holds` under both | a `fails` on good-near under one shape only | medium |
| gross controls | draft NO-GO on all four | one not caught | high |
| real pages, agreement | within one atom between shapes; ≥ 80% each | < 70% | medium |
| `concepts` | per-atom `unknown`/`fails` at 0.45–0.55 both repeats, batched `holds` | reversed | medium-high |
| stratum shift | within ±0.05 of the floor | beyond | medium |
| cost | per-atom 1–4× the requests per page (sections per page) | > 4× | high |

## Decision rule (recorded before the run), per library

- No refuting cell for a library: its pin and comment are removed (the library default,
  per-atom, applies).
- Per-atom loses on a library's subtle fixtures or real atoms (k ≥ 3, m ≤ 1): the pin stays
  with the measured reason in the comment.
- Batched loses: the pin is removed and the finding recorded against round 3.
- Mixed across libraries: each library by its own evidence; no change on a library whose
  evidence is mixed.
- The `concepts` atom forks on the lead's blind label: `holds` and per-atom demotes it → a
  per-atom error counted against `module-model`'s removal; `fails` → the page is rewritten as its
  own unit with a decision row and re-measured under both shapes (round 8b), the pin decision
  on `module-model` deferred to that.

## Predicate (caps from the mock projection at 1.5× worst × repeats, filled before the run)

```sh
DOC_VERIFY_MOCK_JUDGE=1 node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle current_not_history --request-shape both --repeat 2 --no-spans --ledger round8-pages
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle current_not_history --request-shape both --repeat 2 --no-spans --ledger round8-pages --cap <N>
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle pairs_every_property --request-shape both --repeat 2 --no-spans --ledger round8-pairs --cap <N>
node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle properties_are_claims --request-shape both --repeat 2 --no-spans --ledger round8-claims --cap <N>
node worklog/kernel-trials/probe/oracle-test.mjs --real-cells --labels module-pages.yaml --request-shape both --repeat 2 --no-spans --ledger round8-real --cap <N>
node worklog/kernel-trials/probe/compare-shapes.mjs --self-test && node worklog/kernel-trials/probe/compare-shapes.mjs round8-pages round8-pairs round8-claims round8-real
```

## Left unmeasured

Judge variation; the one-section oracles beyond a smoke test; batch sizes above a page's own
section count; the known-unknown label.

## Review

`results/round-8-review.md`, ten findings, "run after amendments". Taken before the run: 1
(regex-clean subtle fixtures, a near-margin good page, the gross page as a control with its
draft status), 2 (the runner extension specified: `per_section`, `expect_sections`,
section-keyed matching, per-kind sets, per-document rule, fixture paths), 3 (the expected-label
rule on `core.body`), 4 (the one-section oracles smoke-tested; pins decided per library), 5
(disagreement defined; the stratum; equivalence bound; `concepts` named), 6 (blind labels before
the run, disclosure, `scout` as the second labeller of `concepts`), 7 (the `concepts` fork), 8
(round 6's rule structure, mixed branch, per-library table), 9 (caps from the projection; cost
expectation corrected), 10 (the builder guesses answered above).
