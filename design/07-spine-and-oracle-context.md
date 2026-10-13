# Design 07 — the spine: section addresses, oracle context and cross-document reach

## User inputs

Owner, 2026-10-14, after round 9 (a judge shown the row's property beside a witness echoes it)
and the finding that an oracle has one evidence channel: "widen the scope, do our other oracle or
language support itself, supports passing enough context besides the test subject"; "It's like a
spine from my instinct, a path or the key surround like the 'property'"; "say spine(x, s), s being
the target section, x being the list of headers and list index towards it"; "Before test, we can
come up some good syntax design, mine was just one opinion"; a feasibility check against the
kernel was asked for. Decided by the owner the same day: path steps carry heading **text**, not
section ids; `doc#section` references are checked as part of this design.

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
   line 546) strips it and tests only that the file exists, so `design/06-kernel-migration.md#no-such-section`
   passes, and prose references in the `§Heading` form are not parsed as section references at all.
3. A check sees only its own documents' facts: `core.ref` and `core.resolves` say a link exists,
   not what the target says.

## Scope - what we touch

In scope: a core relation `core.path(D, N, Kinds, P)` in the kernel (`doc-verify/src/kernel/core.pl`)
with its checker literal kind, translator case and sandbox primitive; two host facts it needs
(column position on `core.header`, a row's key text); an oracle `context:` field naming which
inputs the judge sees as "Where:" rather than as the subject; a checker rule refusing echo;
section-fragment checking for `#slug` and `§Heading` references; list-item facts (phase 2);
loading cited documents' section trees into a check (phase 3). Out of scope: replacing the seven
evidence forms with path addressing (left undecided), the judge's request shape, the threshold.

## Rationale

Considered shapes, each with a worked oracle:

- **A. a spine relation projected in the oracle** (`context: [core.spine(D, cell(R, C), [heading, column])]`):
  fits the current forms; the node is written twice.
- **B. the subject addressed by its path, the spine shown from that address** (`evidence: core.at(D, [heading('Verification design'), row(R), column('Failure witness')])`):
  no duplication, robust to renumbering; reworks all seven evidence forms.
- **C. node terms and navigation rules, context built by ordinary module rules:** fully
  programmable, but infeasible: rule and oracle heads must be plain variables
  (`doc-verify/src/engine/checker.ts` lines 104 and 181) and only lists are allowed as compound
  arguments (line 432), so a module rule cannot assemble a path.
- **D. a declarative YAML block** (`context: {path: [title, heading, column]}`): easiest to
  check, unusable by rules.

Chosen: the path is a **built-in relation** like `core.present/3` (checker line 351, already a
ground list), and context is an **oracle input** bound by it. The kernel already passes ground
lists as oracle inputs and the host already renders inputs into the question
(`renderQuestion`, `doc-verify/src/engine/oracles.ts` line 565), so identity by content
(constitution invariant 6) holds with no new rule: the path is part of the atom key, and an edited
heading changes the key and invalidates the cached answer. Demand, the `prefix` policy and the
sandbox gate are unchanged; it is one more ground argument. B's benefit is kept by the relation
working in reverse (a rule finds a node from steps and hands it to the existing evidence forms).

## Model

**The relation.** `core.path(D, N, Kinds, P)`: `N` is a node, `sec(S)`, `row(R)`, `cell(R, C)`
(phase 2: `item(S, I)`); `Kinds` lists the step kinds to keep; `P` is the ground path from the
document root, in order, keeping only those kinds:

```
core.path(d, cell(r7, 'Failure witness'), [title, heading, table, row, column], [
  title('Modular verification language'),
  heading(2, 'Verification design'),
  table(['Property', 'Failure witness', 'Command']),
  row('Binding by construction'),
  column('Failure witness')
]).
```

Steps carry heading **text** (owner's decision). Section ids here are `github-slugger` slugs of
the heading, so an id is no more stable than its text, and the text reads better to the judge.
Two sibling headings with the same text are told apart by an occurrence index in document order
(`heading(3, 'Notes', 2)`); a document with them is never refused. A row's key is its first
column's text unless the document's companion names a key column.

**The oracle field.** `context:` lists oracle inputs shown to the judge as a "Where:" block above
the subject, never as the subject:

```yaml
rules:
  witness_row(D, R, P): core.row(D, _, R), core.path(D, cell(R, 'Failure witness'), [heading, column], P)
oracles:
  witness_observable_in_row(D, R, P):
    ask: Is this an observable failure a check could print?
    evidence: core.cell(D, R, 'Failure witness')
    context: [P]
```

**The echo rule.** The checker refuses a `choose` oracle whose context input is bound by a
`core.path` literal keeping a step kind (`row`, `heading`, `column`) whose text can equal one of
the oracle's labels; round 9's E1 becomes a module that does not load.

**Section references (phase 0).** A `#slug` fragment resolves when the target document has a
section with that slug; a `§Heading` reference resolves when a section's heading text matches.
A miss is a `core.section_dangling(D, S, Target, Fragment)` fact and a `paths-resolve`-style
finding naming the closest headings as its repair. Only the target's headings are read, with the
segmenter's own slug function, so `#slug` and `core.path` agree on what a section is called.

**Cross-document reach (phase 3).** Opt-in per path: a `via(ref)` step kind follows one link the
document actually makes, one hop, and shows the cited section's own path plus an excerpt bounded
by the oracle's `max_bytes`. It needs the host to load cited documents' section trees into the
check, which phase 0 builds.

## Supersedes

| Earlier text | Replaced by | At phase |
| --- | --- | --- |
| design/04 §Facts: a reference resolves when its file exists | a reference with a fragment resolves when the section exists | 0 |
| design/05 §Oracle toolkit: evidence is the oracle's only input text | evidence is the subject; `context:` inputs are shown as its address | 1 |

## Decision

Four phases, each preregistered under `worklog/kernel-trials/` with an independent review before
the run, each leaving `npm test` and `npm run test:kernel-slow` green.

| Phase | What lands | Decided by |
| --- | --- | --- |
| 0 | `#slug` and `§Heading` references checked against the target's headings | the corpus: every dangling fragment found is a real one (labelled before the run) |
| 1 | `core.path` over title, headings and tables; column position and row-key facts; `context:`; the echo rule | a round, spine against no spine, on the round 4, 4c, 8 and 10 fixture sets |
| 2 | list-item facts and the `item` step | phase 1 showing the spine helps where lists are the grain |
| 3 | `via(ref)`: one hop into a cited document | phase 1 showing `evidence_reasons` gains from context |

Phase 1's predictions: the spine moves `evidence_reasons` most (the judge sees which claim a cell
argues for), is neutral to slightly positive on module pages and neutral on witness rows; any
already-correct label it flips counts against it. Item 11 (a witness on the wrong row) is not
expected to move: with the property in the path it is round 9's R1, which failed.

## Verification design

Commands marked "(phase N)" do not exist until that phase adds them.

| Property | Failure witness | Command |
| --- | --- | --- |
| Fragments checked | a document linking `design/06-kernel-migration.md#no-such-section` passes `check` | doc-verify check over a seeded fixture (phase 0) |
| Prose section references checked | a `§Nonexistent` reference to an existing design passes | the same fixture (phase 0) |
| Path is right | `core.path` for a fixture cell prints a step list that differs from the hand-written expectation (heading order, duplicate index, row key) | npx vitest run doc-verify/tests/kernel/path.test.ts (phase 1) |
| Path survives quoting | a heading with quotes, colons or backticks makes two atoms share an answer key, or one atom's answer routed to another | a randomized key round-trip test (phase 1) |
| Echo refused | round 9's E1 module (a `choose` over property names with the row key in its context) loads | the checker test for the echo rule (phase 1) |
| Context is not the subject | a fixture whose context alone would answer the question changes the label against the subject-only run | the phase 1 round's control fixtures |
| Kernel gate holds | a new core predicate missing from the sandbox's safe primitives loads, or loads unchecked | `npx vitest run doc-verify/tests/kernel/boundary.test.ts` |
| Random programs | the property track finds a counterexample involving `core.path` | `npm run test:kernel-slow`, with path literals added to the generator (phase 1) |

## Left undecided

- Addressing the subject by its path (shape B) in place of the evidence forms: not now; revisit
  if authors keep writing path lookups by hand.
- Whether the "Where:" block is on by default for every oracle once phase 1 measures it.
- Fragment checks on external URLs (out of scope: no network at check time).

## Goal

goals/04-trusted-kernel.md

## Review

Not yet reviewed: an independent seat (a model other than the author's) reads it before phase 0
is preregistered.

## Status

draft
