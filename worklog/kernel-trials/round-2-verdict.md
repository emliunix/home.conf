# Round 2 verdict — conformance of kernels to the model (2026-10-12)

## Predicate

```sh
node worklog/kernel-trials/probe/run-conformance.mjs                         # exit 0; S1 unexpected mismatches: 0
node worklog/kernel-trials/probe/run-conformance.mjs --corpus --random 200 --d3   # exit 0
node worklog/kernel-trials/probe/reference/run-reference.mjs worklog/kernel-trials/probe/witnesses/*.yaml   # exit 0
node worklog/kernel-trials/probe/reference/random-brute.mjs 500 1            # 0 counterexamples (seeds 1, 2, 3, 7, 11)
```

Run by the two authors and by the lead; all agree.

## What measured

The reference is `docs/doc-verify-model.md`, amended four times during the round on findings from
the independent seat, the reference author and the kernel author (change log in the model).
Witnesses: 24 hand-derived programs covering every gate of model §9 except Boundary, plus the
24-document corpus under the draft profile, plus random programs with brute-force expectations
over every total extension of the answers.

| Subject | Gate witnesses | Corpus | Random (C4) |
| --- | --- | --- | --- |
| S1, WFS kernel (swipl-wasm, round-1 encoding, residual walk, `prefix`/`full`) | 24 / 24 pass, 0 unexpected, 0 unexpected-pass | pass | 200 + 1500 programs, 0 counterexamples |
| S2, TypeScript evaluator of design 04 | 10 / 24 pass; 14 fail | pass | not run (its checker refuses the generator's programs) |
| Reference (naive, stratified fragment) | 24 / 24 (loop witness unsupported by design) | produces the corpus expectations | self-checked against brute force |

S2's 14 failures split 11 / 3: eleven where the model moved beyond design 04 (missing-literal
descent, the `Bθ = u` status rows, the population row, loop refusal, a text-only quoting case)
and three where design 04's own rules over-demand (`d2-minimal`, `pass-is-final`,
`missing-literal`: it asks an atom after the binding is already decided).

Interval count: with the engine's native aggregate S1 fails `interval-count` and
`matches-bound-interval` (unsound: a count over `u` tuples read as decided); with the two-query
encoding both pass. The plan predicted the first and missed the second witness.

Seeded defects: letting a require be violated under a `u` forall flips one witness and 7 of 100
random programs; walking only the forall for demand flips 12 witnesses and 67 of 100. The gates
can fail.

## Which candidate it selects

**The WFS kernel is selected as the kernel of design 05**, conditional on round 4 (trust boundary
and budget) and on the oracle toolkit (round 3) saying nothing that changes the model. The
TypeScript evaluator is not a reference and not a candidate: it is an unverified experiment that
the gates now measure, and it fails three of them under its own rules.

## Expectations the run contradicted

- S2 was expected to pass M1, M2, PASS-is-final, the status table, D1 and the missing literal. It
  fails all six as the model now reads. The prediction was written before the status table and
  the descent rule were amended; it was wrong for the amended model and is corrected here.
- `matches-bound-interval` was not listed as an expected failure in naive-count mode; it is one.
- Incremental tabling is not used. With it, six witnesses fail (stale `call_delays/2` after
  `assertz`, `friction-swipl-wasm.md` F15). The kernel abolishes tables at every step, about 1 ms on the
  corpus. Design 05's "incremental re-evaluation" becomes "re-evaluation per step".

## Findings about the model (all amended in place, marked)

1. The status table was more conservative than invariant 2 allows: `Gθ = t` satisfies a require
   whatever `Bθ`. Fewer demanded atoms, same soundness.
2. The support definition was circular; it is now syntactic over residual derivations and
   over-approximates relevance, measured by D3 (`p :- o, not o` demands `o`; relevance 1, since
   either label makes it violated).
3. The missing-literal rule was undefined on derived goals and `u` prefixes; it is now a descent
   with a source order.
4. M2 is false under negative loops; restricted, with loop bindings reported *unfounded*.
5. `matches` on an unbound operand can never be resolved; it is a static error.
6. The hole and the known unknown were one word (owner's point): the engine's `u` is an atom not
   yet asked; the judge's "unknown" is an authored label read as `u` by the oracle's valuation
   map; the engine appends no option. The `asked` carve-out, the `prefix` fall-through and the
   "unresolvable" binding follow from the contract instead of being special cases.
7. D1 must be read on the post-answer state: a binding whose support mixes a hole and an authored
   `u` leaf may stay undetermined after its hole is answered, by the author's choice (14 of 200
   and 38 of 500 random programs, found independently by both authors).

## Findings about the probe method

- Brute force over every completion is the right oracle for the universal gates and is what made
  findings 2, 6 and 7 visible. It is property testing without the framework: no shrinking (the D1
  gap arrived as "14 of 200" rather than one three-line program), a narrow generator (one
  variable, two labels, no `choose`, `count`, `matches`, `present`, recursion or loops), no
  coverage report until the seat asked for one. The gate ledger's first item is to convert it to
  property tests with shrinking and a generator grammar over the whole language, subject
  pluggable, so one suite measures every kernel.
- Kleene conservatism: 240 of 500 random bindings were left undetermined that enumeration over
  every completion decides (`p :- o. p :- not o.`). Sound, costs decisiveness; a precise job for
  an SMT stage. To be measured on real modules, not random ones.

## Left unmeasured

Boundary, budget, groundness under load (round 4); scheduler cost per policy on the corpus with a
live judge (round 3 collects the numbers); the extraction form of oracles; judge and wording
variation.

## Files

`round-2-preregistration.md` (plan, review summary, amendments), `results/round-2-review.md`
(both reviews verbatim), `probe/witnesses/`, `probe/reference/` (with `DERIVATION-LOG.md`),
`probe/kernel2/`, `probe/run-conformance.mjs`, `results/round-2-conformance.md`, `decisions.md`.
