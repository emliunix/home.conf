# Round 11 verdict — section references are checked (design/07 phase 0, 2026-10-14)

## Predicate

```sh
npx vitest run doc-verify/tests/references/fragments.test.ts      # 10 passed: every fixture label read as labelled
node doc-verify/dist/cli.js check --all --profile draft --format json --output <tmp>/r11-all.json   # exit 1: NO-GO on the 3 corpus findings
node worklog/kernel-trials/probe/fragment-fixtures/score.mjs <tmp>/r11-all.json                     # false findings 0, missed 0, complete: true
```

Run by the lead on the builder's code (an Opus seat in its own worktree, commit 6738d82, taken into
this branch uncommitted), reproducing the builder's output line for line. The plan was reviewed
before the build (`results/round-11-review.md`, four blocking findings, all amended before any code).

## What measured

**Fixture** (`probe/fragment-fixtures/fixture.md`, 32 labelled references): the 11 dangling found,
each once at its line; 0 findings on the 12 resolving and the 9 skipped (line anchors, bare `§N`, id
forms, a `§` with no document before it, a `§` inside a code span).

**Corpus** (the 28 documents `check --all` selects; 34 section references checked, 0 fragment
links): exactly the 3 pre-registered findings —

| Document:line | Reference | Fact |
| --- | --- | --- |
| design/06:77 | `design/04 §Engine` | design 04 has no such section (its engine is §Evaluation) |
| design/06:80 | `design/05 §Verification rows pointing at …` | the heading is "Verification design" |
| design/05:54 | `§Constitution amendments` after the constitution's path | binds to the constitution, which has no such heading; the author meant design/05's own |

— and goals/01's `§C9`/`§C10` silent, the pre-registered known misses (id form; design 02 has neither).

**Seeded defects**, each turning the fixture test red (the builder ran all four; the lead re-ran the
id-rule seed: `skipped 24 docs/doc-verify-model.md §9: 1 findings`, `skipped 24 design/05
§C1-receipt: 1 findings`): segmenter section ids instead of the global slug pass (`#kernel`,
`#where-u-comes-from`, `#notes-1` become false findings); the id rule removed; the code-span skip
removed (`design/06 §Nowhere`); a per-parent slugger (`#notes-1`).

**Tests:** `npm test` 378 passed (10 new), typecheck clean, lint armed, `test:kernel-slow --smoke`
pass. **Cost:** median of 7 interleaved runs of `check --all --profile draft`, before (6fb2a6f) 3.43 s
and after 3.54 s: +3.2%, inside the +10% bar. A first, non-interleaved measurement read 3.80 s
(+11.8% on the plan's 3.40 s) while another seat's slow suite ran on the same machine; the
interleaved pair is the comparison.

## Expectations against the run

| Expectation | Outcome |
| --- | --- |
| fixture: 11 dangling found, 0 on 12 resolves + 9 skipped | met |
| corpus: exactly 3 findings, the named ones; §C9/§C10 silent | met |
| tests green | met |
| cost within +10% (medians) | met (+3.2% interleaved) |
| each seed turns the predicate red | met (4 of 4) |

## Decision

The check ships as built: `core.ref(D, S, T, fragment)` per checked reference, `core.dangling(D, S,
T, fragment)` per miss, `core.section_ref(D, S, T, Line, Closest)` carrying the line and up to three
closest headings, and `doc-verify:references` constraint `fragments-resolve` (error). Targets are
read through `readTarget` (snapshot-backed: working tree, index or range head), memoised per run by
path. Design/07 phase 0 is done.

Builder interpretations accepted (decision rows): a citation's text ends at the first punctuation
mark, so design/06:80's target reads "… rows pointing at" and the scorer counts a finding naming
the label plus further words; `design/NN` refuses a following digit as well as `-`; a `§` bound to a
non-`.md` document is not checked; a heading line is not a sentence boundary.

## What changes after the verdict

1. design/06:77 → `design/04 §Evaluation`; design/06:80 → `design/05 §Verification design: the rows
   pointing at …`; design/05:54 → `design/05 §Constitution amendments`. `check --all` PASS after.
2. design/07 §Model "Section references" aligned with the round (no normalised-id fallback; memoised
   by path only; sentence boundaries; the id rule).
3. Gate ledger: a round 11 row. Decision rows below.

## Found on the way

The pre-commit `tracked-ignored` probe, run by the builder's commit inside a linked worktree, wrote
`core.bare = true` and a `[user]` into the shared `.git/config` (it inherited the hook's `GIT_DIR`):
every worktree broke and the builder's commit was authored `tracked-ignored`. Fixed in 6fb2a6f (the
probe strips inherited `GIT_*`), reproduced against a throwaway repository before and after.

## Left unmeasured

External URLs; HTML anchors and headings containing HTML; setext headings; `readTarget` within-run
invalidation; path case; recall on `§` citations abbreviating a heading past its first punctuation;
documents named only in prose.

## Records

`round-11-preregistration.md` (plan, review), `results/round-11-review.md`,
`probe/fragment-fixtures/{fixture.md,dup-target.md,labels.yaml,score.mjs}`,
`doc-verify/tests/references/fragments.test.ts`, `doc-verify/src/engine/facts.ts`,
`doc-verify/src/{checker,snapshot}.ts`, `doc-verify/lib/references.yaml`, `decisions.md`, `gate-ledger.md`.
