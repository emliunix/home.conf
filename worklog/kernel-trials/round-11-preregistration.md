# Round 11 — section references are checked (design/07 phase 0)

Plan written 2026-10-14 by `lead` before any implementation; labels and the fixture
(`probe/fragment-fixtures/`) written the same hour, before the build. The independent seat's review
is appended under `## Review` before the run.

## Hypothesis

A reference that names a section of another document, as a link fragment (`doc.md#slug`) or as a
document-qualified `§Heading`, can be checked against that document's headings with **no false
finding** on this repository's 28 checked documents and **every** dangling one found, while bare
`§N`, id forms and code spans are never flagged. Refuted by: any finding on a reference labelled
`resolves` or `skipped`, or any labelled `dangling` reference without a finding.

## Axis

This is a feature round with one candidate: the gate is the labelled set. The design choices it
could turn on (the slugger's scope, the `§` matching rule) are fixed below so the labels test
them, not a tuned implementation.

## The candidate (design/07 §Model "Section references"; the review's S3–S5)

1. **Fragments**, on Markdown links only (a backticked path is an example, not a link): a target
   ending `.md` with `#frag` resolves when a document-global `GithubSlugger` pass over the target's
   headings yields exactly `frag` (no `normalizeSectionId` fallback: GitHub would not land on a
   normalised id either). A bare `#frag` resolves against the document itself. `#L<n>` and
   `#L<n>-L<m>` are skipped; non-`.md` targets are skipped; a missing file stays the existing `link`
   dangling finding, not a fragment one.
2. **`§` references**, outside code spans and fenced blocks.
   - *Sentences* end at `.`, `!` or `?` followed by whitespace, at a blank line, at a table cell
     boundary `|`, and at the start of a list item; not at `:`, `;`, `,` or a bare newline, and not at
     the dot inside a file name.
   - *Documents* that bind: a Markdown link target, a path ending `.md` (bare or in backticks; a
     path inside a code span is a document candidate, a `§` inside one is not checked) resolved as
     the existing reference resolver resolves it (relative to the document, then the repository
     root), and `design/NN` (`design/\d\d` not followed by `-`) resolving to the single file
     `design/NN-*.md`. The nearest document before the `§` in the same sentence binds; none, none
     checked.
   - *Matching*: heading text is mdast `toString` (the segmenter's), headings inside fences are not
     headings. Text is folded (lowercase, punctuation to spaces, spaces collapsed) and tokenised. A
     `§` resolves when some heading's tokens are a prefix of the text's tokens up to the sentence
     end, or the text's tokens up to its first punctuation mark are a non-empty prefix of some
     heading's tokens. Accepted laxness: a short citation (`§Rule`) resolves against any heading
     beginning with that word.
   - *Never checked*: a `§` whose first token is an id or number (`^[A-Za-z]?\d+([.-]\w+)*$`:
     `§3`, `§9`, `§C9`, `§C1-receipt`).
3. **Facts and rule:** a miss is `core.dangling(D, S, Target, fragment)` with Target the reference as
   written; `doc-verify:references` gains a constraint `fragments-resolve` forbidding it, severity
   `error`, message naming the reference and repair naming up to three closest headings
   (string distance, host-side text only).
4. **Reading targets:** a `readTarget(repoPath)` host callback returning the file's text, memoised
   per run by path; headings only are used; restricted to files in the repository tree.

## Predicate

```sh
npx vitest run doc-verify/tests/references/fragments.test.ts   # the fixture, scored against labels.yaml's `fixture` keys
node doc-verify/dist/cli.js check --all --profile draft --format json --output /tmp/r11-all.json
node worklog/kernel-trials/probe/fragment-fixtures/score.mjs /tmp/r11-all.json   # the corpus against `corpus`
```

The fixture test checks `fixture.md` through `checkDocuments` with a rule selecting it as a design
(the fixture is not one of the 28 corpus documents) and scores every label by (line, target as
written, backticks stripped). `score.mjs` does the same for the corpus JSON: one line per labelled
reference (`found`/`silent` and its label), every `fragment` finding not labelled printed as
`unlabelled`, then `false findings N`, `missed N`, `complete: true|false` (false when a label's line
holds no such reference), exit non-zero on a false finding, a miss or an unlabelled finding. Both
run once before the build (all labelled `dangling` silent: the check does not exist yet) and once
after.

## Expected outcomes (recorded before the run)

| Track | Expectation |
| --- | --- |
| fixture | the 11 `dangling` found, 0 findings on the 12 `resolves` and 9 `skipped` |
| corpus | exactly 3 findings: design/06:77 `design/04 §Engine`, design/06:80 `design/05 §Verification rows`, design/05:54 `§Constitution amendments` bound to the constitution (as written; the author meant design/05's own section); 0 elsewhere; `§C9`/`§C10` in goals/01 silent (known misses by the id rule) |
| tests | `npm test` and `npm run test:kernel-slow -- --smoke` green |
| cost | median of 5 runs of `check --all --profile draft` after within +10% of the median of 5 before (3.40 s, measured 2026-10-14 before the build) |

## Seeded defects (each must turn the predicate red)

- resolving fragments against the segmenter's section ids only (no document-global slug pass):
  the fixture's `design/05-trusted-kernel-redesign.md#kernel` becomes a false finding (its section
  id is `design/kernel`);
- the `§` id rule removed: fixture line 24 (`docs/doc-verify-model.md` §9, design/05 §C1-receipt)
  produces findings;
- the code-span skip removed: fixture line 22's `design/06 §Nowhere` produces a finding;
- a per-parent slugger (the segmenter's) for fragments: `dup-target.md#notes-1` becomes a false
  finding (its per-parent slug is `notes`).

## Left unmeasured

External URLs; anchors defined by explicit HTML ids or headings containing HTML; setext headings;
headings generated by tools; `§` references whose document is named only by prose ("the model §3",
"design 04 §…" without a slash); `readTarget`'s invalidation within a run; case differences in paths;
recall on `§` citations that abbreviate a heading past its first punctuation.

## After the verdict

design/04 §Facts superseded as design/07 states; the two corpus findings (design/06) fixed in the
document, not suppressed; design/07 phase 0 marked done in its Decision table note.

## Review

`results/round-11-review.md` (verbatim; a Sonnet seat; "run after amendments"). Taken before the
build: blocking 1 (no `normalizeSectionId` fallback; `#semantics` stays dangling; a duplicate-heading
target added), 2 (sentences end at table cells and list items; design/05:54 labelled, 3 corpus
findings expected), 3 (fixture line 24 for the id-rule seed), 4 (labels keyed by line and target;
the fixture scored by its own test; the corpus by `score.mjs`); the should-fix rules (sentence
boundary, document binding, `design/NN`, code spans, heading text, the duplicate and backtick-heading
cases, the accepted prefix laxness) are in §The candidate; the cost bar uses medians of 5; the
unmeasured list is extended.
