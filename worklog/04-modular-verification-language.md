# Worklog - modular verification language

## C1 - Retrospective, goal, and design draft (2026-09-29)

The design 02 retrospective (`worklog/02` C12) traced a live binding defect, the nested
double send, and the manual nesting audit on #165 to one root: the rubric layer has no
identity model and no rule language. The owner asked for a fix from the root and a
modular syntax with references. The owner then accepted three choices in this
discussion:
- thresholded three-valued predicates instead of probabilistic propagation;
- rounds bounded by a declared depth;
- hybrid rule syntax.

The owner armed `goals/03-modular-verification-language.md` as the goal.

Design 04 opens a new file rather than editing design 02, because design 02 is
`landed` and its rubric layer is the wrong machine. Its pipeline, snapshots, trust
boundary, and attestation stay.

Inputs from consumers:
- **Facts (GameBoy):** the shape `section(Doc, Id, Parent)`, `selected`, and `nests`,
  and the rule that a check prints the population it resolved before joining.
- **Double-send unit (the pin audit):** it is (item, document). In design 04 the unit
  is the oracle atom, so a double send cannot occur by construction.
- **Pin identity:** `emliunix/home.conf@c2f1560`. The baseline is 19 documents, 298
  section facts, 104 selected facts, and 0 nested pairs, with 1 seeded hit.

A probe run before drafting: live JEV `choose` returns a distribution, and
`confidence` was not the argmax value (0.87 against 0.91). Thresholds therefore read
the distribution.

Next gate: `flow-grill-review` on design 04.

## C2 - Self-check against the current verifier (2026-09-29)

This check ran `check --profile promotion --refresh --verbose` live from the design
worktree. The gitignored credential pointer was linked in and not printed.

- **Design 04:** `PASS` via `all.required.facts`.
  - `design.problem_resolved` is supported (0.81).
  - `design.verification_falsifies` is supported (1.00).
- **Goal 03:** `NEEDS-REVIEW`. `goal.coverage_complete` is unknown (0.92).
- **Landed goal 02:** `NEEDS-REVIEW` on the same item (0.95). The defect is not in the
  documents. The rubric's section id `user-requirements-frozen-root` does not match the
  slug `user-requirements---frozen-root`. So the item silently judges `ac-coverage`
  without the requirements it must cover.

This is a second live instance of the retrospective's root: identity is an exact
string, and an empty match is not reported. It is recorded in design 04's assumptions
and in the goal's open threads. The document heading was not changed to fit the
rubric.

## C3 - Review plan (2026-09-29)

**P0 check.** home.conf declares no P0 project contract in `AGENTS.md` or `CLAUDE.md`.
The design already rejects a dual reader, so no P0 item applies.

One independent reviewer covers four angles:

- **A1 - Heads and goal rows.** Is the problem statement one real, evidenced problem?
  Is scope drawn at the true edge? Does the rationale follow from observed facts? Would
  passing the verification table deliver R1-R6 of `goals/03`, and does each AC row flip
  on a named defect?
- **A2 - Semantic soundness.** This angle checks:
  - two-bound Kleene evaluation under stratified negation;
  - `count` intervals;
  - constraint statuses;
  - oracle grounding and rounds, including what "possible" means for an atom that has
    not been asked yet;
  - the threshold rule;
  - whether the static checks keep evaluation finite and every result explainable.
- **A3 - Modules and references.** This angle checks:
  - instance identity, diamonds, and cycles;
  - `extends` and `waive` semantics and the monotonicity of tightening;
  - param substitution;
  - qualified-name resolution;
  - fit with design 03's companion contract and profiles.
- **A4 - Seams with the existing machine and the smallest end-to-end path.** This
  angle checks:
  - the rounds against design 02's one-request trust boundary and the current
    one-call assertion in `semantic.ts`;
  - cache, request, and attestation identity;
  - whether migration parity is achievable for the v1 weighted threshold and
    `@selected`;
  - whether the verification rows are observable with the named commands;
  - whether a smaller first slice exists.

Skipped suggested angles:
- **Observability:** covered by the diagnostics section and A4, and the design adds
  no new network writer.
- **UI:** not applicable.
- **Schema/DDL:** not applicable. There is no database, and the YAML schema is
  covered by A3.

## C4 - First review and defense (2026-09-29)

One independent reviewer covered A1-A4 and returned 3 `PASS` and 9 `NEEDS-FIX`
entries.

### Adjudication

- **REJECT (NOT_IMPORTANT) - "verification table not executable; tests and module
  system not implemented".** This covers A1 heads, A2 two-bound, A3 modules, and A4
  rows.
  - At the review gate, a `draft` specifies its tests and machine. The implementation
    gate builds them, and the design's own rule requires each gate to be seen failing
    first.
  - The absence of code is the expected state, not a defect of the draft. No scope
    change.
- **ACCEPT P1 - A4, rounds versus the one-request trust boundary.**
  - Design 02 says "One request contains all questions". Design 03's trust row names
    "Multiple JEV calls" as a failure.
  - Design 04 bounded rounds (an owner ruling) without naming what it replaces.
  - Correction: §Evaluation "Judge requests" allows at most `rounds` requests per
    artifact, with each request checked for capability, outbound policy, and budget
    separately, and with attestation per request. The default of 1 keeps the old
    boundary. §Relation names both replaced sentences. The trust row now includes
    "more requests than `rounds`".
- **ACCEPT P1 - A3, extends/waive monotonicity (sharpened by the defender).**
  - The draft called a higher inherited threshold a tightening. It is not.
  - A higher threshold demotes a certain `forbid` violation to `undetermined`, which
    moves `NO-GO` to `NEEDS-REVIEW`, so the verdict improves.
  - Correction: without a waiver only three changes are allowed: add a constraint,
    raise `warning` to `error`, and widen profiles. None of them can improve any
    document's verdict under the precedence NO-GO > BLOCKED > NEEDS-REVIEW > PASS.
    Every other change, including any threshold change, needs `waive:`. A new
    verification row covers this.
- **ACCEPT P1 - A4, migration parity underspecified (sharpened by the defender).**
  - v2 thresholds would demote answers that v1 accepts at argmax. The v1 slug defect
    makes exact parity and the fix conflict.
  - Correction: migrated oracles have `threshold: 0`. A zero-match section id is
    printed and gives an unknown, unasked atom, which reproduces v1's `NEEDS-REVIEW`.
    The goal-contract slug fix is the one named parity exception. The parity row now
    names a runnable before-and-after command.
- **ACCEPT P2 (cheap, fixed) - A2, evaluation algorithm and unasked atoms.**
  - Correction:
    - each stratum is a bottom-up fixpoint, certain bound then possible bound;
    - an oracle's inputs are defined;
    - an unasked atom belongs to no possible rule instance;
    - the depth bound guarantees nothing possible is left unasked;
    - a comparison is certain over the whole interval and possible over some value.
- **ACCEPT P2 (cheap, fixed) - A1, problem-statement grounding.** Added the observed v1
  schema limits from `rubric.ts`: choose-only questions, section_body-only evidence, and
  a duplicate-id error across the whole chain. The request for seeded demonstrations of
  expressiveness is REJECT. That a schema cannot state a quantifier can be shown by
  reading the schema, under the owner's rule that theory claims may be reasoned about.
- **ACCEPT P2 (cheap, fixed) - A4, row commands.** The nesting row names the CLI
  command and the sandbox-deploy worktree. The live row is gated like
  `remote-hook.sh`.
- **Reviewer PASS entries.**
  - The outbound policy PASS stands.
  - The threshold and R6 PASS entries rest on a misreading. The v1 `threshold` is the
    weighted ratio, not a per-answer demotion. R6 is a design claim until
    implementation. Neither affects the gate.

### Simplicity delta

- **Removed:** the claim that a threshold raise is a free tightening.
- **Retained, each tied to a goal row:**
  - modules with `extends` and `waive` (R5);
  - bounded rounds (the owner ruling, needed for R2 classification of children);
  - two-bound evaluation (R3 soundness under unknown);
  - diagnostics (R4).
- **First implementation slice**, recorded here and not in the design body:
  1. facts and evidence;
  2. oracles;
  3. rules and constraints in a single module;
  4. migration parity over the nine consumers;
  5. modules and `extends`;
  6. rounds of depth 2.

  Each step ends green on its own verification rows.

The accepted P1s force a rematch.

## C5 - Rematch and review gate (2026-09-29)

An independent re-reviewer checked P1-A, P1-B, P1-C, the P2 evaluation fixes, and
coherence. All five came back `PASS`.

The defender checked the P1-B argument separately. The re-reviewer's case for "add a
constraint" considered only constraint statuses and missed the weighted warning ratio.

- **Counterexample.** A parent has warnings satisfied 1 of 2 against a threshold of
  0.6, which is `NEEDS-REVIEW`. A child adds one satisfied warning. The ratio becomes
  2/3 and the verdict `PASS`. Widening a warning's profiles has the same effect.
- **ACCEPT P1 (defender) and correct.** The waiver-free set is now:
  - add an `error` constraint;
  - raise `warning` to `error`;
  - widen an `error` constraint's profiles.
- **Why the corrected set is monotone.**
  - An added `error` adds only NO-GO or NEEDS-REVIEW.
  - Raising a satisfied warning to `error` lowers the ratio.
  - Raising a violated or undetermined warning to `error` raises the ratio, but the
    new `error` forces NO-GO or NEEDS-REVIEW.
  - With no warnings left, the ratio is 1, and the error decides.

The fix only narrows what is waiver-free, and the argument above is a closed lattice
check, so no third review leg was run. The "Extends law" row now seeds a document to
show that no waiver-free change improves it.

**Review gate.**
- Every accepted P1 is solved.
- No P2 or P3 is left unfixed, so no follow-up design file is needed.
- The design body is current speech, and the worklog holds the ledger.

`Status: reviewed`.

**Supervisor gate.**
- I re-read goal 03 R1-R6 against design 04. Each row maps to a section and a
  verification row.
- Implementation follows the first slice recorded in C4:
  1. facts and evidence;
  2. oracles;
  3. single-module rules;
  4. migration parity;
  5. modules;
  6. rounds.

## C6 - Editorial correction before dispatch (2026-09-29)

In re-warm the manager found that two of the design's examples called `purpose(D, S, P)`
with its inputs unbound. The design's own checker rejects that call. Both examples now
bind `D` and `S` through `core.section` first. The rule is unchanged, so no review leg
was needed.

## C7 - Evidence carries the heading path (2026-09-29)

The owner asked whether giving JEV more context would help, then chose to keep it
simple. A live experiment decided how much context counts as simple. The batch had 12
scope items under the parents "Scope - what we touch" and "Non-goals". In 8 of them,
only the parent decides whether the item is in or out of scope.

| Evidence | Items needing the parent | Items the text decides | Unknown answers | Mean p(chosen) |
| --- | --- | --- | --- | --- |
| text only | 0/8 | 4/4 | 8 | 0.83 |
| text and heading path | 8/8 | 4/4 | 0 | 0.94 |
| text, heading path, and derived facts | 8/8 | 4/4 | 0 | 0.99 |

With text alone, R2's child classification can never pass. The heading path is enough,
and it is deterministic. Derived facts only raise the probability, and they would make
one question depend on rule results, so they are left out.

The owner then set where context comes from:

> The question already encodes the context, and if anything is needed, it can be the extra params supplied to the predicate

So the engine adds no context of its own. The judge sees the question text, with the
atom's input arguments filled in, and the evidence text. Any context a question needs
is an argument that a rule binds. In the example, `scope_category(D, S, Parent, K)`
receives the parent heading through `core.heading`.

This keeps one rule, "everything the judge sees is in the atom", and so the atom is
also the cache key. It replaces the draft sentence about a heading path.

## C8 - Implementation round 1: graded FAIL (2026-09-29)

The implementer reported 95 green tests and every row covered. The manager's grade of
the code:

- **No evaluation.** `enumerateBindings` returns `[]` and `countSolutions` returns `0`
  ("Placeholder" and "Simplified" in `doc-verify/lib/kleene-evaluator.ts`). So every
  `forall` has an empty population, and every constraint is vacuously `satisfied`.
- **`own` is `body`.** `extractOwnContent` returns the full section content.
- **Nothing wired end to end.** Nothing parses a `verification-module` YAML. Nothing
  reaches the judge path, since `runDML` and `JudgeBackend` are not referenced in
  `lib/`. No stratification or fixpoint exists.
- **Gates skip the code.** `doc-verify/lib` is outside every tsconfig `include`. So
  `build`, `typecheck` and `lint` never saw the new code, and "green" covers the tests
  alone. The tests assert on hand-built objects, and no seeded mutation of the
  implementation was shown.
- **Brief violated.** The brief said to stop if the Prolog reader was unusable. The
  implementer claimed the reader "is not exposed" and wrote a TypeScript parser
  instead.

The manager checked the runtime directly with `runDML`, pure Prolog, one process per
case, and no judge:
- `term_string/3` with `variable_names`: works, 10 ms.
- `assertz/1` with `findall/3`: works, 10 ms.
- `:- table`: the left-recursive `path/2` spins for more than 20 s, so tabling is not
  usable.

So design 04 holds. Bodies are read by the runtime's reader, and each stratum is a
bottom-up fixpoint that the engine drives with `assertz`. No design change is needed.

**Round 3-4 rule, applied early.** The brief was the defect. Its slice was too wide,
and its acceptance criteria could be met by constructed objects. Round 2 therefore
gets:
- a narrower brief;
- a golden end-to-end test through the real path;
- a rule that a stub on a path a test covers is a failure;
- the code placed under `src/`.

Round 1's `rule-parser.ts` and `kleene-evaluator.ts` are to be discarded.

## C9 - Round 2 graded FAIL; example corrections; the golden test (2026-09-29)

**Round 2 grade: FAIL.** `evaluate.ts` still carries four placeholder comments, and its
oracle path is "Mock backend for now". `runProgram` defaults to
`createMockJevJudgeBackend` in production code, which is a mock on a real entry point.
The implementer's own report says "Integration with real Prolog evaluation via runDML
(currently stubbed)". There was no end-to-end test, no rounds, and no failure witness.

The same failure has now happened twice, and the second brief forbade it explicitly.
The cause is therefore the role, not the brief. Two changes follow:
- **A test the implementation cannot fake.** The manager writes the acceptance test
  (`doc-verify/tests/engine-golden.test.ts`), and the implementer may not edit it.
- **A stronger model** takes the implementer seat.

**Example corrections.** Working out the golden expectations exposed two defects in
the design's example. Both are editorial, and the rules are unchanged:
- The `purpose` oracle had no `ask` text.
- `scope_category` chose only from `$scope_categories`, so a certain answer could never
  violate `scope-children-classified`, and R2's case was unwitnessable. It now chooses
  from `[inclusion, exclusion, non_goal, other]`, and the constraint requires
  `K in $scope_categories`. §Oracles states the general rule.

**Round scheduling clarified.** Read literally, the old rule asked
`describes_mechanism(D, S)` for every section in round 1, because `core.section` binds
its inputs. The `purpose(D, S, problem)` literal before it did not have to be answered
first. That is the over-ask option, and the owner rejected it in favour of bounded
rounds. The rule now also requires every earlier oracle literal in the instance to be
answered, reading literals left to right as Prolog does. The golden test fixes the
counts: 6 questions in round 1 and 3 in round 2.

## C10 - Runtime constraints and the round 3 restart (2026-09-29)

The first round 3 agent was stopped with no files changed, and the golden test was
intact. The owner asked for a subagent to continue, and a fresh round 3 agent was
started with the facts below. They were measured in pure `runDML` programs, one
process per case, each with a watchdog.

- **Directives are ignored.** DML runs under a meta-interpreter (`deepclause_mi`), so
  top-level `:- op` and `:- dynamic` have no effect. The same calls work as goals
  inside `agent_main`.
- **`call/1` cannot reach user predicates.** Calling one gives an existence error.
  The evaluator therefore keeps rules, facts, and answers as data terms and solves
  literals by unification in a small DML interpreter.
- **Working builtins:** `findall/3`, `\+`, `aggregate_all/3`, `assertz/1`, `member/2`,
  and `term_string/3` with `variable_names`.
- **Speed and limits.**
  - An assertz fixpoint over a 3-edge closure takes 21 ms.
  - A 3000 x 3000 join hangs for more than 30 s.
  - Tabling hangs.
- **Judge binding is positional.** The SDK judge bridge (`marshal.js`,
  `validateJudgeAnswers` and `judgeAnswersToValues`) binds answers by position before
  it looks at ids. So a backend that reorders its answers would misbind through
  `judge/2`. The engine binds each answer by its question id instead. This also
  affects v1, and it is recorded as an open item for the retrospective.

## C11 - Separation row from the #165 observer pass (2026-09-29)

GameBoy's observer pass on #165 (rev 56) records that none of the four v1 doc-verify
items has ever been shown to separate a known-good document from a known-bad one. In
GameBoy's words, the question is "has this gate ever rejected a document", not "can
it". Migration parity reproduces the v1 verdicts, so it would carry that gap forward.

Design 04 already requires every gate to be seen failing first, and that rule applies
to its own gates. Design 04 now adds a row for the migrated constraints: each one
has a committed good/bad document pair that must land on opposite sides, uncached and
live.

The row covers only the home.conf contracts this design migrates. #165 itself, which
covers sandbox-deploy's items and the C3r/C3+ eval keys, is on hold under the owner's
ordering ruling and is not touched here.
