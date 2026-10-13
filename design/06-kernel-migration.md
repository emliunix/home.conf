# Design 06 — migrating the engine onto the kernel (workstream W3)

## User inputs

Owner, 2026-10-12 (design/05 §User inputs): "We actually accept breaking current language, given
we have a strong and trusted kernel." Owner, 2026-10-13 (task.md item 5): a numbered design with
its verification table, no implementation that pass. Owner, 2026-10-13, after reading this
design's first version (four differential rounds with the TypeScript evaluator kept as a
reference until parity): "Not anywhere, we just keep errors observed as tests and our tests all
pass, we simply replace with the new, update the design. So we tidy the experiments into prod
level codebase?" — and, on the plan to do so, "go as your plan".

## Problem statement

Two evaluators exist and only one is trusted. The kernel (`worklog/kernel-trials/probe/kernel2/
core.pl`) passes every model §9 gate (round 2: 24 of 24 witnesses, 1700 random programs), the
26-document corpus and the clingo differential (round 4b), the boundary round (round 5) and the
property track (round 7, with one defect: gate-ledger item 7). The TypeScript evaluator
(doc-verify/src/engine/evaluate.ts, deleted by this design) fails 14 of the same 24 witnesses (round 2: 11 where the
model moved beyond design 04, 3 over-demands), and it is what `doc-verify check` runs. The kernel
lives in the experiment tree with its runtime vendored there, so nothing the rounds measured has
a production path. Observable: `git grep -l core.pl doc-verify/` prints nothing, and
`node worklog/kernel-trials/probe/run-conformance.mjs` prints 14 S2 `MISMATCH` lines.

## Scope - what we touch

In scope: the kernel (`core.pl`), its loader with the sandbox gate and the inference budget, and
the module-to-program translator, moved from `worklog/kernel-trials/probe/kernel2/` into
`doc-verify/src/kernel/` as typed sources; `swipl-wasm` 8.2.2 a dependency of the package; the
kernel's missing diagnostics (proof trees, the certain and possible populations) and its count
defect (gate-ledger item 7); the seam (`runProgram` evaluates through the kernel); the deletion
of `evaluate.ts`; and the observed errors of rounds 1–7 as doc-verify tests. Out of scope: the
module language (the parser and `checker.ts` stay; a module the kernel's stricter static checks
refuse is a listed break with its repair), the judge and request shape, the oracle toolkit and
its fixtures (they stay in the programme tree), and the open judge-side items (gate-ledger 10,
11).

## Rationale

The first version of this design kept the TypeScript evaluator behind `--engine ts` as a
differential reference through four rounds (11–14) and flipped the default only after live
corpus parity. That buys a comparison with an evaluator the programme already records as wrong
on 14 witnesses (decisions row 2026-10-12: the evaluator is a subject, never a baseline), at the
cost of two code paths and a flag. The owner's alternative is chosen: every error the rounds
observed is already a reproducible case with its expected result derived from the model, so the
cases become tests; the kernel replaces the evaluator in one change; the suite, not a second
engine, is the gate. The clingo subject (S3) stays as what it already is, a second
implementation of the model's decided part, now in the slow test suite instead of a probe flag.

## Model

- **Host**: parses Markdown to facts, loads and checks modules (`module.ts`, `checker.ts`,
  `compose.ts`), asks the judge (`oracles.ts`), caches, renders reports. Unchanged except that it
  no longer evaluates rules.
- **Seam**: `runProgram(input)` in `doc-verify/src/engine/index.ts` keeps its signature and its
  `EngineReport`. Per check: translate the composed program and the facts to program text, load
  it into one fresh WebAssembly instance through the sandbox gate, then per round set the answer
  state, evaluate under the budget, read the report lines, ask the demanded atoms under the
  declared policy (`prefix` default), and repeat until nothing is demanded or the round cap.
- **Kernel** (`doc-verify/src/kernel/`core.pl): the measured `core.pl` plus three additions —
  proof trees from a meta-interpreter over the residual program (round 1 K3's
  `worklog/kernel-trials/probe/prolog/k3-proof.pl`, `fact/1` and `oracle/2` leaves), reported per binding; the certain
  and possible population counts; and the count fix (a `count` whose result is already bound
  compares it with the interval and delays when the interval does not decide it).
- **Loader** (`doc-verify/src/kernel/`kernel.ts): round 5's three layers — the instance, the
  sandbox gate over every module-derived clause (`catch/3` and its cleanup relatives refused),
  the inference budget — and one fresh instance per check (round 7 finding 3: a reused instance
  can raise a history-dependent `instantiation_error`).
- **Translator** (`doc-verify/src/kernel/`translate.ts): `translate.mjs` typed, unchanged in
  behaviour.

## Supersedes

| Earlier text | Replaced by |
| --- | --- |
| this design's first version: steps 1–4 as rounds 11–14, `--engine ts`, the known-divergence set, the default flip | one replacement gated by the test suite (§Decision); no rounds 11–14, no flag |
| design/04 §Engine: `evaluate.ts` as the evaluator of a composed module | the kernel behind the same `runProgram` |
| design/05 §Design, kernel: "The host never evaluates a rule" (true of the probe path) | true of the production path |
| design/05 §Design, module language: "it refuses nothing else" | the kernel's static checks also refuse ungrounded negation and unbound `matches`; each module so refused is listed in §Language breaks with its repair |
| design/05 §Verification rows pointing at `worklog/kernel-trials/probe/` (trust boundary, model conformance) | the same rows pointed at `doc-verify/src/kernel/` and the test files below; S2 removed |
| constitution invariant 5 "In force … under swipl-wasm 8.2.2" on the probe path | the production path (amended 2026-10-14, citing this design) |

## Decision

One change, in this order, each step leaving `npm test` green:

| Step | What lands | Gate |
| --- | --- | --- |
| 1 | The observed errors as tests (§Verification design rows 1–5), run against the probe kernel through a small adapter; the count-bound cases marked expected-to-fail | `npm test` green with the expected failures listed |
| 2 | Kernel, loader and translator under `doc-verify/src/kernel/`; `swipl-wasm` a dependency; the tests pointed at the new path | the same suite green |
| 3 | The count fix, proof trees, populations | the count-bound cases pass; the expected-failure list is empty |
| 4 | `runProgram` through the kernel; `evaluate.ts` deleted; existing tests that asserted the evaluator's behaviour where the model differs are rewritten to the model, each citing its round-2 witness | `npm test` green; `git grep -l evaluate doc-verify/src` empty; `npm run check` and `doc-verify check --all` with the mock judge run |
| 5 | The property track and the clingo differential as `npm run test:kernel-slow`; design/05 and the constitution amended; this design's Status `landed` | the slow suite green; the seeds table reddens it |

A step that turns the suite red is fixed before the next step lands; nothing is merged to `main`
by this design.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| Model conformance | a witness step of `probe/witnesses/*.yaml` (24 steps, round 2) or round 4b's 23 files where statuses, demand, missing literal or verdict differ from the hand-derived `expect` | `npx vitest run doc-verify/tests/kernel/witnesses.test.ts` |
| Corpus | a corpus document whose kernel verdict differs from the model-derived expectation of round 2's `corpus-draft.yaml` | `npx vitest run doc-verify/tests/kernel/corpus.test.ts` |
| Trust boundary | round 5's seeds: E1 (a host-effect clause) or E17 (`catch/3`) not refused at load, or E18 (`numlist/3` over 20M) not stopped by the budget; any of the 48 steps off its recorded outcome | `npx vitest run doc-verify/tests/kernel/boundary.test.ts` |
| Round 7 regressions | the minimal count-bound triple (two counts sharing `N0`, `ans: {}`) reads `violated` instead of `undetermined`, the hand-made `forbid` case reads `satisfied`, or a constant count result does not delay | `npx vitest run doc-verify/tests/kernel/regressions.test.ts` |
| Diagnostics filled | a violated binding whose report has an empty `proof`, a violated `require` without `missing`, or populations that differ from the binding list | `npx vitest run doc-verify/tests/report` |
| One engine | `git grep -l "evaluate.ts\|from \"./evaluate" doc-verify/src` prints a path | `git grep` as written |
| Property track | a property of the model's §9 fails on 500 programs × seeds 1–3 against the independent WFS and stable-model oracles; or a seed of round 7's table fails to flip its property | `npm run test:kernel-slow` |
| Cost | `time npm run check` slower than the evaluator's by more than the kernel floor (round 1 K4: 65–82 ms cold start per check) times the document count | `time npm run check` before and after step 4 |

## Language breaks

Measured at step 4 (`check --all` with the mock judge before and after: 27 documents, no verdict
or finding differs; no module named by a `.doc-verify.yaml` rule is refused). Against design 04's
checker the language changes in two places, each a refusal at module load with its repair:

| Form | Now | Repair |
| --- | --- | --- |
| a negated literal with a variable shared with another literal of the same body but unbound at that point | refused (`static-nonground-not`) | bind the variable before the negation, or move the negated goal into a helper rule |
| an oracle negation with an unbound input (`not purpose(D, Z, other)`, `Z` free) | refused | bind the input first; the judge is never asked about an unbound atom |

`not p(X, _)` and any negated literal whose unbound variables occur nowhere else stays legal: the
translator lifts it into a tabled helper (no `Y` with `p(X, Y)`). Two expectations of the old
suite moved to the model rather than the language: prefix demand asks 2 atoms in round 1 where
the evaluator asked 6, and 4 questions where it asked 8 (round 2's over-demand witnesses).

## Left undecided

- The judge-side open items: `current_not_history`'s question (gate-ledger 10) and the relevance
  instrument (gate-ledger 11).
- Demand precision on loop-resting bindings (gate-ledger 8) and the S1 D1 gap (round 4b): the
  kernel keeps them as measured.
- Scheduler policies other than `prefix`; native SWI-Prolog; memory beyond the budget.
- Memory of one instance per check at corpus scale (measured by the cost row).

## Goal

goals/04-trusted-kernel.md (workstream W3; goal 04's R1, R2 and R5)

## Review

`worklog/kernel-trials/results/design-06-review.md` (verbatim; a Sonnet seat; "commit after
amendments"). Taken: 1 (counts per witness set; the 11/3 split), 2 (§Supersedes; the
constitution lines named and left to round 14's verdict), 3 (companion `depends_on` adds design
04 and the model; Status moved to the end), 4 (full probe path; only rounds with verdicts cited;
the round-6 pin named; the property track named as in progress), 5 (the known-divergence set;
S3 gates kept), 6 (the step table with gate, seeded defect, verdict file and rollback; step 3
recorded), 7 (witnesses rewritten as printed output; commands marked by step; E1/E17/E18 named),
8 (step 3 records results only), 9 (cost bar from K4 and round 5, set in round 11), 10 (§Left
undecided), 11 (one `## Goal`; goal 04's R-labels), 12 (this section cites the review). That review read the first version; the owner's
2026-10-13 direction replaced its §Decision (rounds 11–14 withdrawn, §Supersedes row 1), and
the rewrite keeps findings 2, 7 and 11 (named constitution lines, printed-output witnesses, one
`## Goal`).

## Status

landed

Note: landed 2026-10-14 on `dv/trusted-kernel-trials` (not merged to `main`). `npm test` 362+
green; `npm run test:kernel-slow` complete, 0 refuting (property 1500 programs, seeds table,
clingo 500), 23.5 min. Draft check time 7.8 s before, 8.2 s after on two documents. Review: an
independent Sonnet seat over three passes (a budget overrun read as PASS, proofs lost under
negation, two negation-translation regressions; each fixed with a test).
