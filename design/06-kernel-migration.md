# Design 06 — migrating the engine onto the kernel (workstream W3)

## User inputs

Owner, 2026-10-12 (design/05 §User inputs): "We actually accept breaking current language, given
we have a strong and trusted kernel." Goal 04 workstream W3: "migration: the engine libraries and
home.conf modules onto the kernel; the TypeScript evaluator kept as the differential reference
until parity, then deleted." Owner, 2026-10-13 (task.md item 5): a numbered design with its
verification table, no implementation this pass.

## Problem statement

Two evaluators exist and only one is trusted. The kernel passes every model §9 gate (round 2:
24 of 24 witnesses, 1700 random programs, 0 counterexamples), the 26-document corpus and the
clingo differential (round 4b), and the boundary round (round 5, in force); the property track
(round 7) is in progress and not cited here. The TypeScript evaluator fails 14 of the same 24
round-2 witnesses (S2, `round-2-verdict.md`): eleven where the model moved beyond design 04
(missing-literal and demand semantics) and three where design 04 over-demands. That evaluator is
what `doc-verify check` runs today. Every oracle round since has shipped into modules the
TypeScript evaluator evaluates, so the measured kernel has no production path, and the host's
fact vocabulary (table facts, evidence forms) grows on the engine that will be deleted.
Observable: `node worklog/kernel-trials/probe/run-conformance.mjs` prints 14 S2 `MISMATCH`
lines and 0 S1 lines on the round-2 witness set (24 steps; round 4b's set is 23 files, round 5's
48 steps, and each count below names its set).

## Scope - what we touch

In scope: the host-to-kernel seam (`checker.ts` → a kernel adapter in place of `runProgram`),
the translation of design-04 modules to the kernel's program text
(`worklog/kernel-trials/probe/kernel2/translate.mjs` promoted from probe to engine), the kernel's
own files (`core.pl`, the sandbox gate, the budget) and the swipl-wasm runtime as a dependency of
`doc-verify/`, the engine report shape the kernel must fill (`EngineReport`: constraints,
bindings, proofs, oracle leaves, requests), the differential gates that keep the TypeScript
evaluator and clingo as references until parity, and the deletion. Out of scope: the module
language (unchanged; it "may break" only where the kernel's static checks are stricter, and each
such break is a listed finding), the judge and its request shape (round 6), the oracle toolkit,
and the clingo subject's own code (S3 stays the differential reference, decisions row 2026-10-12,
and its gate-ledger rows `--s3` and `--s3 --random 500` stay in every migration predicate).

## Rationale

Alternatives: (a) keep the TypeScript evaluator and fix its 14 failures against the model: that
rebuilds an unverified evaluator by hand, which goal 04's R1 ("a trusted kernel, not an invented
one") rejects; (b) run both forever: two evaluators means two places a PASS can be wrong and
double the gate cost; (c) migrate to the kernel behind the existing host seam, differential until
parity, then delete: the kernel is already measured on every gate, the host seam is one function,
and parity is a mechanical check the conformance runner already performs on witnesses and the
corpus. (c) is chosen. The order inside (c) is seam first (the adapter fills `EngineReport` from
the kernel's report lines), then parity on the corpus at draft and promotion with a scripted
judge, then the live corpus, then deletion; the TypeScript evaluator stays reachable by a flag
until the last step so a regression has a comparison.

**Parity against a reference known to be wrong.** The TypeScript evaluator is a subject, never a
baseline (decisions row 2026-10-12). Parity therefore means: no divergence between the engines
outside the **known-divergence set**, which is the 14 round-2 failures, each classified (11
model-beyond-04, 3 over-demand) in `worklog/kernel-trials/round-2-verdict.md`, plus any corpus
divergence step 2 traces to one of those 14 and records by witness id. A divergence outside the
set is a finding against the kernel adapter until the model decides otherwise; the clingo gates
are the second implementation that agrees with the model's decided part.

## Model

- **Host**: parses Markdown to the dump (sections, references, tables), composes modules, asks
  the judge per atom (round 6; the four `module-*` libraries stay pinned `batched` and one module
  page demotes under per-atom, round 6 §Left unmeasured and round 8, so step 2's corpus parity
  runs each library under its pinned shape), caches by (model, question, labels, evidence,
  policy, shape), renders reports. Unchanged by this design except the seam.
- **Seam**: `runProgram(input)` in `doc-verify/src/engine/index.ts` becomes `runKernel(input)`:
  translate the composed module and the dump to program text; load into a fresh instance with the
  sandbox gate (round 5); per round, set the answer state, evaluate under the budget, read
  statuses, demand, missing literals, unfounded and proof trees; the host asks the demanded atoms
  under the declared policy (`prefix` default) and repeats until `Dem = ∅` or the round cap. The
  `EngineReport` fields the kernel fills come from `core_report/1`'s lines; proof trees from the
  kernel's meta-interpreter (round 1 K3).
- **Kernel**: `core.pl` as measured; the sandbox gate and the budget as round 5 shipped them;
  tables abolished per step (incremental tabling not relied on; round 2 verdict, visflow design 20
  F15). One fresh WebAssembly instance per check (round 1 K4: 28 ms warm, 65–82 ms cold startup).
- **Reference**: the TypeScript evaluator behind `--engine ts` (a flag added in step 1; it does
  not exist in `cli.ts` today), run by the differential gate only; deleted when the gate has been
  green on the corpus for the migration's acceptance.
- **Static checks**: the kernel's (groundness of negation, bound `matches`) replace the
  checker's where they overlap; a module the kernel rejects that the checker accepted is a listed
  language break with its repair.

## Supersedes

Each line below replaces the named earlier text when this design's step lands; until then the
earlier text stands.

| Earlier text | Replaced by | At step |
| --- | --- | --- |
| design/04 §Engine: `runProgram` as the evaluator of a composed module | §Model "Seam": `runKernel`, the TypeScript evaluator behind `--engine ts` | 1 |
| design/05 §Design, kernel: "The host never evaluates a rule" (true of the probe path) | the same sentence, true of the production path; the adapter is the only host code between dump and verdict | 1 |
| design/05 §Design, module language: "it refuses nothing else" | the kernel's static checks refuse groundness-of-negation and unbound-`matches` violations too; each refusal of a module the checker accepted is a listed language break with its repair (§Model "Static checks") | 2 |
| design/05 §Verification rows "Trust boundary", "Open vocabulary", "Oracle split", whose commands grep or run against `worklog/kernel-trials/probe/` | the same rows pointed at doc-verify/engine/kernel/ (step 4) | 4 |
| design/05 §Verification row "Model conformance": S2 run as a second subject | S2 deleted; S3 (clingo) the remaining second subject | 4 |

**Constitution:** unchanged by this design. The lines it will touch are invariant 5's "In force
… under swipl-wasm 8.2.2" and its "Not covered" list (which move from the probe to the production
path), invariant 3's "prefix is the default policy", and invariant 7's host-computed table facts
(`core.table/3` "computed in the host for now"); per AGENTS.md an amendment comes from a verdict,
so step 4's verdict (round 14) amends them citing this design, and no earlier step does.

## Decision

Migrate behind the seam in four steps, each a preregistered round under `worklog/kernel-trials/`
with a verdict, a gate predicate that can be re-run, and a seeded defect that turns the gate red
(the constitution's R6, the seeded-defect rule). The default engine flips to the kernel at step 3's verdict
and flips back by the same flag on any later red gate.

| Step | Round | Gate predicate | Seeded defect (must turn it red) | Verdict file | If red |
| --- | --- | --- | --- | --- | --- |
| 1 adapter fills `EngineReport`; `--engine kernel\|ts` added | 11 | `npm test -- report diagnostics` under both engines (the engine-flag matrix added to the suite in this step) | the adapter drops the `missing` field of one finding | `round-11-verdict.md` | the flag stays `ts`; the adapter is fixed, round re-run |
| 2 parity on witnesses and the scripted corpus | 12 | `node worklog/kernel-trials/probe/run-conformance.mjs --corpus --s3 --random 500` (S1 and S3 green) and `doc-verify check --all --engine ts` diffed against `--engine kernel` under `DOC_VERIFY_MOCK_JUDGE=1`, at draft and promotion; the diff must be empty outside the known-divergence set | a translator mutation that flips `forbid` to `require` on one constraint | `round-12-verdict.md` | every divergence outside the set is classified; a kernel-adapter defect is fixed and the round re-run; a model gap goes to a decision row |
| 3 parity live on the corpus | 13 | the same two checks with the production judge, cache off, run as a recorded command with its output in results/round-13-live-parity.txt (results only: no endpoint, no evidence text) | an answer-state mutation (one `holds` read as `fails`) under `--engine kernel` | `round-13-verdict.md` | the default stays `ts`; otherwise it flips to `kernel` |
| 4 deletion; translator and kernel moved under doc-verify/engine/kernel/ (step 4); swipl-wasm a dependency of `doc-verify/` | 14 | `git grep evaluate.ts doc-verify/` empty; `doc-verify check --engine ts` refused; design/05's boundary, vocabulary and split rows green on the new paths | a copy of `evaluate.ts` left under `doc-verify/src/` | `round-14-verdict.md`; the constitution lines above amended | the deletion is reverted by the same commit's parent |

## Verification design

Commands marked "(step N)" do not exist until that step adds them; the rows are predictions
against the shipped `witness_observable_in_row` oracle until the lead's labels say otherwise.

| Property | Failure witness | Command |
| --- | --- | --- |
| Seam fills the report | under `--engine kernel` the report diagnostics test prints a finding whose `missing`, `deciding`, or `proof` field is empty or whose JSON shape differs from the `--engine ts` run of the same witness | `npm test -- report diagnostics` under both engines (step 1) |
| Witness parity | the conformance runner prints an S1 `MISMATCH` line, or the engine-golden diff prints a witness step where statuses, demand or verdict differ between engines and the step is not in the known-divergence set | `node worklog/kernel-trials/probe/run-conformance.mjs --corpus --s3 --random 500` and `npm test -- engine-golden` (step 2) |
| Corpus parity, scripted | the diff of the two `check --all` JSON reports prints a document whose verdict or findings differ with the same scripted answers | `doc-verify check --all --engine ts` against `--engine kernel` under `DOC_VERIFY_MOCK_JUDGE=1`, diffed (step 2) |
| Corpus parity, live | the same diff non-empty with the production judge, cache off, at promotion | the recorded command of step 3, output worklog/kernel-trials/results/round-13-live-parity.txt |
| Boundary carried over | round 5's seeds run against the production kernel files: E1 (a host-effect clause) or E17 (`catch/3`) not `rejected`, or E18 (`numlist/3` over 20M) not `BLOCKED` under the budget | `node worklog/kernel-trials/probe/run-boundary.mjs --gate --budget --kernel-dir doc-verify/engine/kernel` (the `--kernel-dir` flag, step 4) |
| Language breaks listed | the static-check census prints a module path the kernel refuses that is absent from design/06-language-breaks.md (written in step 2) | `node worklog/kernel-trials/probe/static-census.mjs` over every module named by a `.doc-verify.yaml` rule (step 2) |
| Deletion complete | `git grep` prints a path, or `doc-verify check --engine ts` exits 0 | `git grep evaluate.ts doc-verify/` empty; the flag refused (step 4) |
| Cost | `time` on the draft-profile corpus check under `--engine kernel` prints a wall time above the TypeScript engine's plus the measured kernel floor (round 1 K4: 46–105 ms per 24-document corpus including startup; round 5: 6% budget overhead); the exact bar is pre-registered in round 11 from that step's first measurement | `time doc-verify check --all --profile draft` under both engines (step 1) |

## Left undecided

- Whether the `cheapest-evidence` and `most-pruning` scheduler policies ever ship (round 5,
  unmeasured; `prefix` stays the default).
- The four `module-*` libraries pinned `batched` (round 6; round 8 decides per library).
- Translator quoting as its own gate (round 5 §Left unmeasured).
- Native SWI-Prolog and memory beyond the budget (round 5; invariant 5 "Not covered").
- The judge-side outbound policy: not part of this migration, still gated by `npm test --
  semantic confidentiality`.
- The relevance gap in `witness_observable_in_row` (round 4c: a swapped witness column passes
  14/14): this design's own table would pass it; round 9 measures the relevance question.
- The S1 D1 gap (round 4b: 38 programs where demand is incomplete) and S3's D1 incompleteness:
  the migration inherits the S1 gap as is.
- Memory of one WebAssembly instance per check at scale (one instance per check, never pooled,
  is the Model's choice; its cost at corpus scale is step 1's measurement).

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
undecided), 11 (one `## Goal`; goal 04's R-labels), 12 (this section cites the review). The
migration rounds 11–14 will be preregistered under `worklog/kernel-trials/` and this design
amended by their verdicts.

## Status

draft
