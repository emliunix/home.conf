# Design 07 — the spine: section addresses, oracle context and cross-document reach

## User inputs

Owner, 2026-10-14, after round 9 (a judge shown the row's property beside a witness echoes it)
and the finding that an oracle has one evidence channel: "widen the scope, do our other oracle or
language support itself, supports passing enough context besides the test subject"; "It's like a
spine from my instinct, a path or the key surround like the 'property'"; "say spine(x, s), s being
the target section, x being the list of headers and list index towards it"; "Before test, we can
come up some good syntax design, mine was just one opinion"; a feasibility check against the
kernel was asked for. Decided by the owner the same day: path steps carry heading **text**, not
section ids; duplicate sibling headings get an occurrence index and are never refused;
cross-document reach is a later, opt-in, one-hop phase; the subject is not re-addressed by path;
`doc#section` references are checked as part of this design.

## Problem statement

Three gaps share one cause: nothing in doc-verify can name *where* a node sits.

1. An oracle has one evidence channel (`doc-verify/src/engine/module.ts` lines 15–20: `ask`,
   `evidence`, `choose`, `threshold`, `max_bytes`). Context can only be given by widening the
   evidence, which merges it with the subject: round 9's E1 put the row's Property cell beside the
   witness and the judge answered with it on every wrong-row witness (0 of 10 caught). Today's
   oracles judge without orientation they plausibly need: `evidence_reasons` judges a goal's
   evidence cell without the claim it supports; the module-page questions judge a section without
   the page's title.
2. A reference's `#fragment` is never checked. `resolvesTarget` (`doc-verify/src/engine/facts.ts`
   line 546) strips it and tests only that the file exists, so a link to
   `design/06-kernel-migration.md#no-such-section` passes, and `§Heading` references are not
   parsed as section references at all.
3. A check sees only its own documents' facts: `core.ref` and `core.resolves` say a link exists,
   not what the target says.

## Scope - what we touch

In scope:

- **Neutral table facts** from the host: `core.header_pos(D, T, Col, N)` (a column's position) and
  `core.cell_text(D, R, Col, Text)` (a cell's text). The host decides nothing about keys; a rule
  names the key column.
- **Two path relations** in the kernel (`doc-verify/src/kernel/core.pl`): `core.path(D, S, Kinds, P)`
  for a section and `core.cell_path(D, R, Col, Kinds, P)` for a table cell. Each is a dedicated
  literal kind, like `present` (`doc-verify/src/engine/checker.ts` line 351): a checker case, a
  translator case (`doc-verify/src/kernel/translate.ts`), core.pl clauses including its
  `core_lit_text_` and proof clauses, and an entry in the sandbox's safe primitives
  (`doc-verify/src/kernel/kernel.ts`). Arguments stay flat because module arguments may be lists
  but no other compound (`checker.ts` line 432).
- **An oracle `context:` field** naming inputs shown as a "Where:" block, with its own renderer
  (one indented line per step), scanned by the outbound policy like evidence, and hashed into both
  cache keys.
- **The echo rule**, static and run-time halves.
- **Phase 0:** `#fragment` and document-qualified `§Heading` references checked, through a
  `readTarget` host callback and a `core.dangling(D, S, Target, fragment)` fact.
- Phase 2 (list-item facts) and phase 3 (one hop into a cited document), each only if phase 1's
  verdict selects it.

Out of scope: re-addressing the subject by its path (the relations work in reverse for lookups),
the judge's request shape, thresholds.

## Rationale

Considered shapes, each with a worked oracle:

- **A. a spine relation projected in the oracle** (`context: [core.spine(D, cell(R, C), [heading, column])]`):
  fits the current forms; the node is written twice.
- **B. the subject addressed by its path, the spine shown from that address**
  (`evidence: core.at(D, [heading('Verification design'), row(R), column('Failure witness')])`):
  no duplication, robust to renumbering; reworks all seven evidence forms.
- **C. node terms and navigation rules, context built by ordinary module rules:** infeasible:
  rule and oracle heads must be plain variables (`checker.ts` lines 104 and 181) and only lists
  are allowed as compound arguments (line 432), so a module rule cannot assemble a path.
- **D. a declarative YAML block** (`context: {path: [title, heading, column]}`): easiest to
  check, unusable by rules.

Chosen: the path is a **built-in relation** (as `core.present/3` already returns a ground list)
and context is an **oracle input** bound by it. The kernel already passes ground lists as oracle
inputs; demand, the `prefix` policy and the sandbox gate need no change. Identity by content
(constitution invariant 6) needs one explicit step: the persistent cache is keyed by model,
question, labels, evidence hash and policy (`doc-verify/src/engine/oracles.ts` around line 160),
not by atom key, so the rendered "Where:" text is hashed into that key too; an edited ancestor
heading then re-asks. B's benefit is kept by using the relations in reverse (a rule finds the row
under a heading by its key and hands it to the existing evidence forms).

## Model

**Facts.** `core.header_pos(D, T, Col, N)` and `core.cell_text(D, R, Col, Text)` are emitted for
every table, as the existing table facts are. Both are structure the parser already has; neither
encodes a choice.

**The relations.** Steps come from the document root down, keeping only the kinds listed:

| Kind | Step | From |
| --- | --- | --- |
| `title` | `title(Text)` | the depth-1 heading |
| `heading` | `heading(Depth, Text)`, or `heading(Depth, Text, I)` for the I-th same-text sibling | the section chain |
| `table` | `table([Col1, …])` in `header_pos` order | the table's header |
| `row_key(Col)` | `row(Text)`, the row's cell under the named column | `cell_text` |
| `column` | `column(Col)` | the cell's column |

```
core.cell_path(d, r7, 'Failure witness', [title, heading, row_key('Property'), column], [
  title('Modular verification language'),
  heading(2, 'Verification design'),
  row('Binding by construction'),
  column('Failure witness')
]).
```

Steps carry heading **text**. Section ids here are `github-slugger` slugs of the heading, so an id
is no more stable than its text, and the text reads better to the judge. `table` is never implied:
it lists every header, so a header edit would re-ask every row, and it is kept only when asked
for.

**The oracle field.** `context:` lists oracle inputs the judge sees as "Where:", above and apart
from the subject:

```yaml
rules:
  witness_row(D, R, P): core.cell_path(D, R, 'Failure witness', [heading, column], P)
oracles:
  witness_observable_in_row(D, R, P):
    ask: Is this an observable failure a check could print?
    evidence: core.cell(D, R, 'Failure witness')
    context: [P]
```

The context bytes count toward the oracle's `max_bytes` and the outbound budget; the outbound
policy scans them as it scans evidence.

**The echo rule.** Round 9's E1 put the Property cell *in the evidence*; with labels that are
property names, a path step holding that name is the same echo by another route (unmeasured, and
not worth measuring). Two halves:

- *Static* (checker): a `choose` oracle whose `context:` input is bound by a path relation whose
  kinds include `row_key` is refused unless the oracle sets `context_may_echo: true`.
- *Run time* (host, at render): if any label, case- and punctuation-folded, equals a whole-token
  run of any step's text, the atom is not asked; it is unknown with the finding
  `echo: label <L> appears in context`.

**Section references (phase 0).**

- `#fragment` on a link to a `.md` target resolves when a document-global `GithubSlugger` pass over
  the target's headings yields that slug. GitHub numbers duplicates per document (`-1`, `-2`),
  unlike the segmenter's per-parent ids (`doc-verify/src/segments.ts` lines 47–59). There is no fallback
  to normalised section ids, since GitHub would not land on one either (round 11).
  Line anchors (`#L12`, `#L10-L20`) and non-`.md` targets are skipped.
- `§` references are checked only when a resolvable document (a link, a path, or `design/NN`)
  precedes them in the same sentence (sentences end at `.`, `!`, `?`, a blank line, a table cell or
  a list item). They match a heading by the two token-prefix tests of round 11's plan, case- and
  punctuation-folded. A bare `§N`, `§3` or id form (`§C9`) never fails.
- The host reads targets through a `readTarget` callback: headings only, memoised per run by path,
  restricted to the repository tree. A cited document outside the checked
  set is read the same way, never checked itself.
- A miss is the fact `core.dangling(D, S, Target, fragment)`, read by a `doc-verify:references`
  constraint (as `paths-resolve` reads `core.dangling(D, S, T, path)`), so the finding stays a rule
  (invariant 7). Its repair names the closest headings by string distance.

**Cross-document reach (phase 3).** Opt-in per path: a `via` kind follows one link the document
makes from the node's section, one hop, and adds the cited section's own path plus an excerpt
bounded by the oracle's `max_bytes`; it uses phase 0's `readTarget`.

## Supersedes

| Earlier text | Replaced by | At phase |
| --- | --- | --- |
| design/04 §Facts: a reference resolves when its file exists | a link with a fragment, or a document-qualified `§` reference, resolves when the section exists | 0 |
| design/05 §Oracle toolkit: evidence is the oracle's only input text | evidence is the subject; `context:` inputs are shown as its address and hashed into the cache key | 1 |

## Decision

Four phases, each preregistered under `worklog/kernel-trials/` with an independent review before
the run, each leaving `npm test` and `npm run test:kernel-slow` green. Bars are fixed here.

| Phase | What lands | Gate (pre-registered bar) |
| --- | --- | --- |
| 0 | `#fragment` and document-qualified `§` references checked | every `.md#` link and document-qualified `§` use in the repository labelled by the lead before the run: 0 false findings, every labelled dangling one found; a seeded fixture of 10 dangling and 10 good references read exactly |
| 1 | header-position and cell-text facts, the path relations, `context:`, the echo rule | round: spine vs none, two repeats, cache off, on the round 4 and round 10 evidence cells, round 4c witness rows and round 8 module pages. Ships if 0 cells move from right to wrong on any oracle (both repeats), and `evidence_reasons` gains ≥ 2 right cells or ≥ +0.10 mean P(expected) on its near-threshold stratum; otherwise the relations ship for rules and `context:` does not |
| 2 | list-item facts and an `item(I)` step | only if phase 1 ships `context:` and its census finds a shipped oracle whose evidence is list-grain |
| 3 | `via`: one hop into a cited document | only if phase 1 ships `context:` with an `evidence_reasons` gain |

Phase 1 records, per oracle: right→wrong and wrong→right moves, mean P(expected) shifts with
confidence intervals, the context bytes against `max_bytes` and the outbound budget, atom-key
length growth, and the census of shipped oracles by evidence grain. Item 11 (a witness on the
wrong row) is expected not to move, and is accepted as a gap (gate-ledger item 11).

## Verification design

Commands marked "(phase N)" do not exist until that phase adds them.

| Property | Failure witness | Command |
| --- | --- | --- |
| Fragments checked | on a fixture linking `design/06-kernel-migration.md#no-such-section`, `check` prints `PASS` instead of a `references` finding naming `#no-such-section` with the closest headings | doc-verify check over the phase 0 fixture (phase 0) |
| Document-qualified `§` checked | on a fixture citing `design/06-kernel-migration.md §Nonexistent`, `check` prints `PASS` instead of a finding naming `§Nonexistent` | the same fixture (phase 0) |
| Bare `§N` never fails | `check --all` prints a `references` finding of kind `fragment` whose line holds a bare `§3`, `§9` or `§C1-receipt` with no document before it | doc-verify check --all, findings filtered to `fragment` (phase 0) |
| Path is right | the path test prints a step list that differs from the hand-written expectation (heading order, a duplicate's index, the named row key) | npx vitest run doc-verify/tests/kernel/path.test.ts (phase 1) |
| Keys round-trip | the key test prints a pair `kernel key ≠ host key` for a heading with Unicode, a tab, a backslash, a quote, a backtick, a no-break space or 500 characters, or an answered atom reported `unasked` | npx vitest run doc-verify/tests/kernel/keys-roundtrip.test.ts (phase 1) |
| Cache follows the context | after an ancestor heading is edited, the next `check` prints `0 semantic call(s)` for the affected atoms instead of re-asking them | the cache test (phase 1) |
| Duplicate siblings do not cross | after two same-text sibling sections swap places, the cache test shows one section's answer reported for the other | the cache test (phase 1) |
| Echo refused | loading round 9's E1 module rewritten with the Property as a `row_key` step returns a program instead of a `ModuleError` naming the echo rule; or, with `context_may_echo: true`, the run asks an atom whose label is in its context instead of printing `echo: label … appears in context` | the checker and oracle tests (phase 1) |
| Kernel gate holds | with `core_cell_path/5` absent from the safe primitives, a module using `core.cell_path` evaluates instead of the boundary test printing `rejected`; with it present, the same module prints `rejected` | npx vitest run doc-verify/tests/kernel/boundary.test.ts with a path seed (phase 1) |
| Random programs | the slow suite prints a `counterexample … REFUTING` line whose module uses a path relation | `npm run test:kernel-slow`, with path literals in the generator (phase 1) |

## Left undecided

- Whether "Where:" becomes a default for every oracle once phase 1 measures it.
- Fragments on external URLs (no network at check time).

## Goal

goals/04-trusted-kernel.md

## Review

`worklog/kernel-trials/results/design-07-review.md` (verbatim; a Sonnet seat; "amend then
proceed"). Taken:

- B1: the context is hashed into the cache key, with a verification row.
- B2: dedicated literal kinds with flat arguments; the touch points are in §Scope.
- B3: neutral facts only; the rule names the key column.
- S1: the two-part echo rule.
- S2: the key round-trip row compares kernel and host keys and catches unrouted answers.
- S3: a document-global slugger; line anchors and non-`.md` targets skipped; no normalised-id fallback (round 11).
- S4: `§` only after a resolvable document, longest heading prefix, never on bare `§N`; labelled
  before the run.
- S5: `readTarget`, and a `dangling` fact of kind `fragment` read by a rule.
- S6: numeric bars, a per-oracle record and census; `table` never implied.
- S7: the gate row, every row stated as printed output.
- N1 to N3: the duplicate-swap row, the outbound scan, and the renderer.

## Status

reviewed
