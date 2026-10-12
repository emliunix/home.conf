# Oracle fixtures — round 3

A prototype of the design 05 §Oracle toolkit calibration part: per oracle, a `good` fixture and
two seeded `defective` fixtures, answered through the real host by `../oracle-test.mjs`. Plan:
`../../round-3-preregistration.md`.

## Format

One directory per oracle in use by `.doc-verify.yaml`:

```
<oracle>/fixtures.yaml        the set: oracle, ask, declared threshold, rule, governed path, atom, fixtures
<oracle>/good.md              the governed document at HEAD
<oracle>/defective-gross.md   good.md with one obvious seeded edit
<oracle>/defective-subtle.md  good.md with one edit a careless reader would miss
<oracle>/companion.yaml       the governed document's companion at HEAD, when it has one
```

`fixtures.yaml` fields: `oracle`, `declared_in`, `ask` (verbatim), `threshold` (declared),
`constraint`, `rule` (artifact_kind, modules, status_from as `.doc-verify.yaml` declares them for
the path), `document` (the governed path the scratch repository uses), `companion`, `atom`
(`inputs`, `evidence`, `sections`: the leaf's sections the runner matches), and `fixtures`: per
fixture `name`, `file`, `expect` (`holds` | `fails`), and for a defective one `edit` (`cut`: what
was changed; `from`/`to`: the exact text) and `why` (why the edit fails the ask). A fixture may
override `sections` when its edit renames the section (the receipt's gross rewrite renames the H1).

The runner checks each defective file is exactly `good.md` with `from` replaced by `to` (`edit` column:
`ok`); `from` must occur once.

| Oracle | Governed path | Atom sections | Gross edit | Subtle edit |
| --- | --- | --- | --- | --- |
| `problem_resolved` (thr 0) | `design/04-…` | problem-statement, rationale | Rationale body replaced by an argument for a font cache | the "Identity is the root of the reported defects…" paragraph deleted |
| `verification_falsifies` (thr 0) | `design/04-…` | verification-design | all 14 failure-witness cells restate their property | the witness cell of "Binding by construction" only |
| `coverage_complete` (thr 0.5) | `goals/03-…` | user-requirements---frozen-root, ac-coverage | R4 row deleted from AC coverage (R4 kept in the root) | R4 row kept, its evidence pointed at design 04 §Migration |
| `evidence_not_law` (thr 0) | `receipts/process/2026-10-08-…` | the H1 (its body is the whole receipt) | whole receipt rewritten as standing rules, no date, commit, log, measurement or object | one standing-law sentence added, all evidence kept |
| `scope_explicit` (thr 0) | `design/03-…` | scope---what-we-touch | list and non-goals cut to one vague sentence | the non-goals paragraph dropped |

## Running

```sh
DOC_VERIFY_MOCK_JUDGE=1 node worklog/kernel-trials/probe/oracle-test.mjs --fixtures
DOC_VERIFY_MOCK_JUDGE=1 node worklog/kernel-trials/probe/oracle-test.mjs --corpus --repeat 2
# live (the lead, after review): drop DOC_VERIFY_MOCK_JUDGE; --cap 300 is the default
```

- Fixture mode clones the repository (`git clone --shared`, so every link, path and revision the
  document names resolves), writes a `.doc-verify.yaml` holding the repository's judge and policy
  blocks and one rule (the fixture's own, narrowed to the governed path, so no dependent artifact
  joins the closure), writes and commits the fixture over the governed path, then checks it twice:
  `draft` with a judge that throws on any call (the `draft-only` column: does structure alone catch
  the edit), and `promotion` with the cache off (the oracle leaf and the document `VERDICT`).
- Corpus mode is `checkDocuments({kind: "all"}, promotion, cache off)` N times. Live runs at the
  repository root. The mock run uses a snapshot of the working tree (HEAD plus modified and untracked,
  non-ignored files), so it never reads the root's `.env.doc-verify`.
- Per leaf the runner prints label, the judge's answer, argmax p, the declared threshold, and the
  shape: `decides`, `judge-unknown` (the judge chose `unknown`), `threshold-demoted` (a label below
  the threshold), `tie-or-malformed` (the leaf carries a finding, or was never asked). Separation
  needs good `holds` and the defective `fails`, each at p ≥ 0.6. Stability is printed as *not
  assessable* below 5 atoms (the raw share is shown in brackets).
- `complete: true` iff every fixture leaf was found, every edit applied exactly, no run was
  BLOCKED or threw, and no run was stopped by the cap; labels do not affect it.
- `.question-count` is the ledger. Mock runs record, per run key, the main questions and the worst
  case (main plus one span follow-up per asked leaf). Live runs are charged against `--cap`; a live
  run whose recorded worst case would cross the cap is not started, and the run ends `complete: false`.

## What the mock run showed (2026-10-12)

The mock answers every question with its first option (`holds`, p = 1.00), so every label below is
wiring, not measurement; every defective fixture is a false PASS under the mock by construction.

- Every fixture leaf was found; every edit applied exactly; every fixture, good and defective,
  is PASS under `draft` (structure intact, the structural constraints catch none of the edits).
  `complete: true` for both modes.
- Atoms asked per fixture run (a `check` asks every oracle the document demands, not only the
  fixture's): design/04 asks `problem_resolved` and `verification_falsifies` (2); goals/03 asks
  `coverage_complete` (1); the receipt asks `evidence_not_law` over its H1 (1); design/03 asks
  `problem_resolved`, `scope_explicit`, `verification_falsifies` (3). Fixtures: 15 runs, 27 main
  questions in 15 requests.
- Corpus (26 artifacts, 52 leaves per run): `problem_resolved` 5, `verification_falsifies` 4,
  `coverage_complete` 4, `evidence_not_law` 1, `scope_explicit` 1, and module-page oracles the plan
  called unreachable: `current_not_history` 29, `pairs_every_property` 4, `properties_are_claims` 4
  (`docs/modules/*` is governed by the module-* rules). The corpus includes the untracked
  `design/05` and `goals/04` because the live run reads the working tree.

### Live cost

| Run | Main questions (exact) | Worst case with span follow-ups |
| --- | --- | --- |
| `--fixtures` (15 runs) | 27 | 54 |
| `--corpus --repeat 2` | 104 (52 per run) | 208 |
| total | 131 | 262 (cap 300) |

Main questions are exact for the same working tree: no module here asks an oracle whose demand
depends on another oracle's answer. Span follow-ups are asked only for `fails`/`unknown` leaves, one
question each; the worst case assumes every leaf is non-passing. 74 of the corpus's 104 main
questions in two runs are the module-page oracles (37 per run), outside the round's candidates.
