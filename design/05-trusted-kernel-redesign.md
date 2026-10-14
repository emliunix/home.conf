# 05 - Trusted kernel redesign

## User inputs

The owner judged, after an architecture review of doc-verify (2026-10-12), that the risk is the
hand-written evaluator rather than its dependencies:

> So the size is not major concern, but we don't use a mature impl and invent our own may make
> mistakes the core prolog model broken is the major concern

The owner widened the candidate set and released the current language:

> We actually accept breaking current language, given we have a strong and trusted kernel. And
> widen our scope to not just prolog engines, but also datalog and smt like z3, what will it be.
> And our language design can change given our design is focused on this jev judge gives us the
> facts. And the logic tree works and we can get enough diagnostics

After kernel-trials round 1 the owner asked for a rethink from the constitution rather than from
the designed approach:

> So now with more input, let's not be constrained by our designed approaches, but back to the
> constitution and rethink the problem, anything changes, or we redesign

> Yes, allow repeated such experiments and redesign process.

On oracles, after the question whether the constitution covers the problem, the owner set the
split between authoring, calibration and the engine:

> what is this unknown value, if unknwon if a value it must be just one inductive case/label we
> defined, the known unknown.

> So about orcale, sure it's critical, and then when we descend into our engine design, it should
> be split from 2 ways: 1. the orcale can be authored and the author is provided enough tool like
> threshold and others declarative by being an orcal so he can be precise. 2. the calibration
> mechanism provided like the defective / good fixtures like UT. 3. our engine take that the
> author has the orcal well defined and don't do anything further opinionated about the well
> beings of the orcal itself

## Problem statement

Design 04 built a two-bound evaluator in TypeScript because the Prolog runtime available at the
time could not run rules. That evaluator is itself an experiment: about six hundred lines, new,
not formally verified, the only place the soundness invariant is enforced, and trusted on a dozen
example tests. It is not a reference and must not be treated as one; it is a candidate like any
other, and its tests are lessons. Its language is closed over a fact vocabulary
the host owns, so rules that need other facts leak back into the host as hardcoded checks, which is
the defect design 04 set out to remove. Its demand schedule is an artifact of literal order rather
than a declared policy. Its trust boundary is a static checker, because the evaluator runs with
the host's full access.

## Scope - what we touch

- The constitution as a living document (`docs/doc-verify-constitution.md`), with three amendments
  and one addition stated in design/05 §Constitution amendments.
- The model (`docs/doc-verify-model.md`): what doc-verify computes, derived from the constitution
  alone, with every earlier artifact consulted as a lesson. It is the reference every kernel,
  including the current evaluator, is measured against.
- The oracle toolkit: oracle declarations, oracle fixtures and their runner, split from the engine
  as §Design states.
- The kernel: SWI-Prolog under the well-founded semantics, hosted in WebAssembly, **selected by
  kernel-trials round 2** (`worklog/kernel-trials/round-2-verdict.md`), conditional on rounds 3
  and 4.
- The module language: Prolog module files with directives for oracles and constraints, replacing
  the YAML envelope of design 04 §Modules and references and §Rule syntax.
- The host: reduced to selection, a mechanical document dump, the judge client, and rendering.
- The process: a repeatable experiment-then-redesign loop, bound in `AGENTS.md`.

Non-goals: the judge protocol, caching, the outbound policy, profiles, companions, selection and
snapshots, mutation tables. Probabilistic propagation stays rejected.

## Rationale

**Why a mature engine.** What was built is not Prolog and not standard Datalog: stratified rules
evaluated to two bounds with a third value at the leaves. No shelf engine implements that
directly, so the first question was which mature semantics it coincides with. The answer is the
well-founded semantics: on stratified author rules over undefined leaves it is the Kleene reading
design 04 implements, and SWI-Prolog's tabling implements it, exposes the residual program an
undefined answer depends on. Incremental tabling is *not* relied on: round 2 found stale delays
after `assertz` (`worklog/kernel-trials/friction-swipl-wasm.md` F15); the kernel re-evaluates per step, about 1 ms on the corpus. Round 1 measured all of this in the
WebAssembly build (`worklog/kernel-trials/round-1-verdict.md`).

**Why not the other candidates as the kernel.** Answer set programming gives both bounds as
cautious and brave consequences but no derivations. Datalog engines give derivations and speed
but need a doubling transformation for the third value, which is where a semantic bug would hide.
SMT needs grounding and precomputed closures and gives opaque proofs; it is kept as an analysis
stage over modules (consistency, smallest repair, answer sensitivity), not as the evaluator.

**What round 1 changed in the design.** Three things the previous proposal had wrong:
- The engine's delay list is not the demand set; the demand set is the leaves of the residual
  program, and the prefix order is a policy we implement. Hence the split of invariant 3.
- Unknown is encoded by a negative loop at the leaves, so "no transformation" was false; the
  author's rules stay untouched, which is what matters.
- The WebAssembly instance is the trust boundary; the static checker shrinks to a groundness
  check, because the engine accepts non-ground negation silently.

**What a real Prolog underneath makes cheap.** Facts can be the document's syntax tree, so the
fact extractor becomes library rules (invariant 7). Cross-document rules are free, since every
governed document's facts load in one instance in tens of milliseconds. The span follow-up becomes
an ordinary oracle whose labels are sentence ids.

## Assumptions and evidence

**Observed (kernel-trials round 1, swipl-wasm 8.2.2 embedding SWI-Prolog 10.1.15):**
- undefined leaves, the prefix demand walk, holds/fails/unknown and a three-label choose behave as
  expected (K1); incremental re-evaluation works with an untabled oracle wrapper (K2); proof trees
  and missing literals extract (K3); 24 documents, 1509 facts, 14 constraints evaluate in 2–5 ms,
  total 46–105 ms including startup (K4).
- `call_delays/2` returns the goal or `tnot(G)`, not the leaves; delays are listed most-recent-first
  (undocumented); a tabled incremental wrapper leaves a stale delay after assert (possible engine
  defect); `tnot/1` accepts non-ground goals. Tracked in `worklog/kernel-trials/friction-swipl-wasm.md`.

**Assumed before round 2, since tested (round 2 passed; round 3 measured the oracles):**
- The kernel passes the model's gates (`docs/doc-verify-model.md` §9) on seeded witnesses derived
  from the model, including the interval `count` encoding, `present`, `matches` on unbound
  operands and `forbid`. The TypeScript evaluator is run against the same gates as a second
  subject; where the two disagree the model decides.
- `library(sandbox)` and an inference budget give invariant 5 in the WebAssembly build.
- The delay order can be pinned by a test, or the scheduler sorts leaves by its own source order.

## Constitution amendments

- Invariant 3 split: demand is the kernel's residual leaves; scheduling is a declared,
  order-independent policy under a round cap. The design 04 prefix order is the default policy
  for parity.
- Invariant 4 clarified: the deliverable is deciding leaves, missing literal and repair; the full
  derivation is a debugging view.
- Invariant 5 restated: the boundary is the instance, termination is tabling plus a budget, the
  static check is groundness of negation.
- Invariant 7 added: the fact vocabulary is open; facts are the document dump, structure is rules.

## Design

### Host

Selection and snapshots as design 02 and 03. A markdown-to-facts dump: every syntax-tree node as
`node(Doc, Id, Type, Parent, StartLine, EndLine, Text)` plus metadata facts from the companion and
the rule. The judge client, per-atom cache and outbound policy as design 04. A findings renderer
that adds path, line and span to the kernel's records. The host never evaluates a rule (true of
the production path since design/06: `doc-verify/src/kernel/`, `evaluate.ts` deleted).

### Kernel

One SWI-Prolog instance per check, in WebAssembly, loaded with a core library over the dump
(section tree, references, text predicates, sentence candidates), the composed modules, and the
facts. The driving loop:

1. `demand(Policy, Atoms)`: the residual leaves of every constraint instance still undefined,
   filtered by the scheduler policy (`prefix` by default; `cheapest-evidence` and `most-pruning`
   are candidates for round 5).
2. The host asks the judge the atoms (one keyed batch per document) with the oracle's declared
   labels only, and asserts `answered(Atom, Label, Distribution)`; the kernel reads it through the
   oracle's valuation map (threshold, undecided labels). Tables are rebuilt per step.
3. Repeat until no demand or the round cap.
4. `findings(Records)`: per constraint, per binding: status (true, false, undefined under WFS),
   the residual leaves, the first failing goal literal for a violated require, the message and
   repair filled, and on request the derivation.

The hole is encoded at the leaves only: a tabled `u(Atom) :- tnot(u(Atom))` and an untabled
wrapper that reads the answers through the valuation map, so a known-unknown label and a
below-threshold answer are `u` by the author's declaration, not the engine's. Author rules are
untouched and may be non-stratified; the engine's semantics decides them, and a binding left
undefined by a negative loop is reported as *unfounded*.

Measured against a second engine (kernel-trials round 4b, 2026-10-13): clingo 5.8.1 with free
`#external` atoms (supervaluation over total answers) equals brute-force enumeration on 500/500
random programs and decides every binding the WFS kernel leaves undetermined there, but refines
0 of 26 corpus documents, gives no derivation or missing literal, and has a D1-incomplete demand.
The kernel stays as above; clingo is kept as the differential reference the gate ledger names.

The boundary, measured (kernel-trials round 5, 2026-10-13): the instance contains what the build
cannot do; a sandbox gate over every module-derived clause at load refuses any primitive outside
the kernel's declared surface (the three meta-primitives `core_naf/1`, `core_tnot/1` and
`core_count/3` declared `safe_meta` so their goal arguments are checked), any directive, and the
`catch/3` class of control, which was found to swallow the inference limit; an inference budget
B = 20 × the largest corpus evaluation (876 940) around each evaluation is sharp to the
inference and bounds loops and large builtins at 6% overhead. Ten gate mutations each turn their
cell red and green. The scheduler default stays `prefix`: on 200 random multi-leaf programs it
reaches the same final statuses as `full` and asks 13% fewer atoms in 17% more rounds; on the
corpus the two coincide.

### Module language

A module is a Prolog file. Rules are clauses. Oracles and constraints are directives:

```prolog
:- oracle(purpose(D, S, L), [choose([goal, problem, scope, other]), evidence(own(D, S)),
            threshold(0.5), ask("What is this section for? ...")]).
:- constraint('design-has-verification', forall(meta(D, kind, design)),
              require(verification_section(D, _)), severity(error),
              message("{D} has no section whose purpose is verification"),
              repair("Add '## Verification' ...")).
```

`extends` is a module import. Params are facts the importing module supplies. The loader (itself
Prolog) validates arity, labels, evidence shapes and that every oracle input is bound by facts
before the oracle literal; it refuses nothing else. *(amended by design/06)* It also refuses a
negation whose variable is shared with another literal yet unbound at that point, and an oracle
negation with an unbound input; a negated literal whose unbound variables are local to it is
lifted by the translator into a helper (`not p(X, _)` means no `Y` with `p(X, Y)`).

### Oracle toolkit (the split the owner set)

Three parts, three owners, no overlap:

1. **Authoring.** An oracle is a declared contract and nothing else: identity (name, arity, input
   positions), evidence selector (a declarative expression over the dump: a section's own text,
   its body, a union, a span list, context arguments such as the parent heading), answer shape
   (a fixed label set, or a structured answer: a set of ground facts with a schema, so that
   extraction questions such as "list the claims with their spans" are oracles too), a valuation
   map reading each label as true, false or undecided (a *known unknown* is a label the author
   declares and marks undecided; design 04's engine-appended `unknown` option is removed), threshold,
   byte cap, and request shape (batched or alone). Every knob the author needs to be precise is
   declarative on the oracle; nothing about an oracle is decided elsewhere.
2. **Calibration.** Each oracle may carry fixtures, like unit tests: evidence samples labelled
   good or defective with the expected answer. A runner (`doc-verify oracle test`, the analogue of
   `mutate` for modules) answers them live and reports, per oracle: separation (do good and
   defective land on opposite sides), decisiveness (how many answers clear the threshold), and the
   threshold that would maximise separation. A fixture set that fails is a finding about the
   oracle, recorded with it. This is where the separation and decisiveness questions of design 04
   live, and the only place. First run (kernel-trials round 3, 2026-10-12): the runner exists as
   `worklog/kernel-trials/probe/oracle-test.mjs`; `verification_falsifies` as declared does not
   discriminate (both seeded defects `holds` ≥ 0.97) and is to be re-authored as an extraction
   oracle; the judge was decisive and stable on the whole corpus. Second run (kernel-trials
   round 4, 2026-10-13): the runner takes per-row atoms, reused fixture files, fixture-local
   modules, an evidence-column-only invariant, repeats and a ledger per track; the first oracle on
   a table-cell grain (`evidence_reasons`, a goal's evidence cells as reasoning chains) separates
   55/55 cells over eleven fixtures with no false pass, where a column-only question misses one bad
   cell in four. The evidence selector vocabulary above gains the cell (`core.cell(D, R, C)`) and
   the column (`core.column(D, T, C)`), over the host's table facts (`core.table/3`,
   `core.header/3` (since round 12 `core.header_pos/4`, design/07), `core.row/3`, `core.cell/3`; an instance of constitution invariant 7's open
   vocabulary, computed in the host for now like sections and references). Third run (round
   4c, 2026-10-13): `verification_falsifies` re-authored on the cell grain as
   `witness_observable_in_row` over a row's Property and Failure witness cells (`core.cells`);
   every document verdict right on six fixtures including style controls, 28/30 blind real cells;
   the judge does not check that a witness belongs to its row's property (a swapped-witness
   fixture passed 14/14), which the extraction form or a relevance question would have to cover.
   Request shape measured (round 6, 2026-10-13, 1032 questions, batched against per-atom on the
   same atoms, interleaved): per-atom moves near-threshold answers toward the expected side by
   0.22 with the interval clear of the noise floor and catches a seeded cell batched missed; it
   is also stricter on real witness cells and costs 14× the requests. `per-atom` is the declared
   default, `batched` the opt-in for cost; the cache key carries the shape.
3. **Engine.** The kernel reads the declaration and trusts it. It is sound relative to the
   contract: a PASS is a theorem given that the oracle's labelled answers mean what the contract
   says. It measures nothing about the oracle, holds no opinion about its threshold, and never
   refuses an oracle for lack of fixtures. Structured answers enter as leaf facts exactly as
   labels do: the whole answer is `t` at or above the threshold and `u` below it, so the model's
   three-valued treatment is unchanged.

### Process

The experiment-then-redesign loop, bound in `AGENTS.md` §Experiment programmes: a question gets a
programme root under `worklog/<topic>-trials/`; each round has a preregistration with hypothesis,
axis, candidates and expectations, an independent review appended before the run, probe files, a
results file per candidate, a verdict, and a decision row. A verdict that selects a change
produces a numbered design superseding the affected sections of earlier designs and an amended
constitution line citing it. The loop has no terminal round: a later question re-enters it.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| Feasibility (round 1) | the probe runner prints `complete: false`, an undefined leaf comes back `t` or `f` (K1), a demanded atom is missing from the demand set or an undemanded one is in it (K2), a proof tree lacks its `fact/1` or `oracle/2` leaves (K3), or the 24-document corpus takes more than a second (K4) | `node worklog/kernel-trials/probe/run-probes.mjs` |
| Model conformance (round 2, **passed**) | the conformance runner prints a `MISMATCH` line for the kernel on a §9 witness step, a random program whose statuses differ from brute-force enumeration, or a corpus document whose statuses differ from the reference's expectation | `node worklog/kernel-trials/probe/run-conformance.mjs --corpus --random 200 --d3`; on the production kernel (design/06): `npx vitest run doc-verify/tests/kernel` and `npm run test:kernel-slow` (S2 removed) |
| Gate suite form | a universal gate (M1, M2, D1, D2, PASS-is-final) tested only by hand-written cases, or a counterexample reported without a minimal program | property tests with shrinking over a full-language generator, subject pluggable (gate ledger item 1) |
| Soundness by construction | a PASS is reachable with an undefined leaf in some constraint instance | seeded: an unanswered oracle under a require; expected undefined, never PASS |
| Demand is the engine's | an atom the verdict no longer depends on is demanded, or one it depends on is never demanded | seeded cases from round 1 K1, kept as regression |
| Trust boundary (round 5, **in force**) | a module reaches the judge, the network, the filesystem, or runs past the budget without BLOCKED; a boundary gate that cannot be made to fail | `node worklog/kernel-trials/probe/run-boundary.mjs --containment`, `--gate`, `--budget`, `--mutations`; on the production kernel (design/06): `npx vitest run doc-verify/tests/kernel/boundary.test.ts` |
| Open vocabulary | a grep of the host for `artifact_kind` branching, `DATED_PROSE` or `required_sections` returns a match outside the module language and the dump | grep gate: no `artifact_kind` branching, no `DATED_PROSE`, no `required_sections` in the host |
| Constitution governed | a constitution line changes without a citing design | review gate on `docs/doc-verify-constitution.md` |
| Oracle split | the engine reads anything about an oracle beyond its declaration, or refuses an oracle for lack of fixtures, or the fixture runner changes an engine result | grep gate on the kernel's inputs; a fixture-less oracle evaluates; `oracle test` has no effect on `check` |
| Oracle calibration (round 3, **run**; round 4c re-authored `verification_falsifies` on the cell grain) | an oracle with fixtures that does not separate good from defective, or a defective fixture that PASSes | `node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --cap 300` per oracle, reported, not a `check` gate |

## Goal

goals/04-trusted-kernel.md

## Review

worklog/kernel-trials/ (programme records); a design review is owed before status moves.

## Status

draft
