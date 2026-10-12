# Round 4b verdict — clingo with open externals as subject S3 (2026-10-13)

## Predicate

```sh
node worklog/kernel-trials/probe/run-conformance.mjs --s3                  # exit 0; complete: true
node worklog/kernel-trials/probe/run-conformance.mjs --s3 --corpus         # exit 0; complete: true
node worklog/kernel-trials/probe/run-conformance.mjs --s3 --random 500     # exit 1 (one D1 counterexample, the finding); complete: true
node worklog/kernel-trials/probe/run-conformance.mjs --s3-seeds --random 500   # exit 0; 3/3 seeds flip; complete: true
```

Outputs: `results/round-4b-{witnesses,corpus,random,seeds}.txt`. No judge was called. The
corpus facts and the corpus witness were regenerated before the run (`export-facts.mjs`,
`reference/build-corpus.mjs`), because the table facts round 4 added and the module round 4c
shipped were not in the frozen set; the SWI kernel's `core.pl` gained the four table predicates
for the same reason. 26 documents, all PASS at draft, as before.

## What measured

- **Witnesses (23 files):** S3 `pass` on 20, `refined` on 1 (`overdemand-o-not-o` step 1:
  `p :- o, not o` is false in every completion, so `c1` is `violated` and the verdict NO-GO,
  tagged *tautology*, demand `[]` against S1's `[o]`), `expected-failure` on 2
  (`present-candidates`, out of scope; `matches-bound-interval`, a `matches` over a count, refused
  with a reason as the plan requires). `m2-negative-loop` matches statuses and verdict (two answer
  sets, undetermined, NEEDS-REVIEW). 0 unexpected mismatches, 0 unexpected passes. S1's column is
  unchanged: 23 `pass`.
- **Random (500 programs, seed 1):** statuses and verdicts equal to enumeration on 500/500. The
  237 bindings S1 leaves undetermined that enumeration decides are all decided by S3, identically.
  D2: 0 counterexamples. **D1: 1 counterexample** (program #231): the population is empty iff
  `o1(b) ∧ (o2(a) ∨ o1(a))` with `o1(a)` answered `unknown`; fixing `o2(a)` alone changes no
  status, so the single-flip demand omits it, although it decides the population once `o1(b)` is
  answered. The review predicted this class. Beside it, S1's own run prints 38 programs where a
  binding resolvable at `ans` is unresolvable after its `Dem` (the model's D1 gap, already
  printed by the round 2 runner).
- **Corpus (26 documents, draft, no answers):** every status equal to the expectation; **0
  refined**; census 0 of 26 unsupported. 114 ms for S3 against S1's run in the same process.
- **Seeds:** `ignore-body` flips 105 random programs (and one witness to `refined`);
  `unsat-vacuous` flips the inline odd-loop fixture only (no witness or random program is UNSAT);
  `no-exclusivity` flips three witnesses and no random program (the generator has no `choose`).
  The witness comparison rule lets the first two seeds through as *refined*; only the random
  track, an exact predicate, catches `ignore-body`.
- **Cost:** 2 to 12 solves per step on the witnesses (E ≤ 3); 6602 solves over the random
  track, 4.7 s; per step 0.8–40 ms against S1's 0.5–7.9 ms, worst case 5×. No multi-shot API in
  clingo-wasm: every demand probe re-grounds and re-solves.

## Expectations the run contradicted

- **Refinements on real documents: 0**, inside the pre-registered 0–2 but at the end that says
  the kernel decision does not reopen on utility grounds. The 240/500 random figure is the
  generator's, not the corpus's.
- **Refinements on `status-b-undefined*` and `prefix-unknown-fallthrough` did not appear**: S3
  matches those expectations exactly. Only the tautology witness refines.
- **Demand equal, not strictly smaller**, everywhere except the tautology step.
- **The D1 counterexample was predicted as likely and appeared**, on a parity-shaped population
  rather than a count: the prediction was right in kind.
- **`m2-negative-loop` matches** (the review's correction of the original plan, confirmed).
- **Speed within 20×**: 5× worst case, better than the low-confidence row.

## What the round says

Soundness and completeness both hold: S3 is a correct second implementation of the model's
decided part (the exact random predicate, 500/500, with seeds that can see a status-rule defect),
and it decides everything supervaluation decides. On real documents that extra power decides
nothing (0 of 26). So the semantic axis, WFS undefined against supervaluation, makes no
difference on this corpus, and the kernel decision **does not reopen** for utility. What S3
cannot give is what invariant 4 needs: a derivation and a missing literal for a finding; its
evidence for a refined binding is "every completion", a case split, and clingo-wasm offers no
reification or text output (`--outf=2` is forced). Its demand is D2-safe by construction and
D1-incomplete (one counterexample in 500), where S1's syntactic cone is D1-safe by the model's
support and over-demands on tautologies (one witness).

## Which candidate it selects

**S1 stays the kernel.** S3 is kept as a **differential reference**: `--s3` and `--s3 --random`
join the gate ledger as the second implementation that must agree with the model's decided part,
which is what round 2 wanted from the TypeScript evaluator and never got (S2 fails 14 witnesses).
The hybrid (S3 for statuses, S1 for findings) is not designed here: with 0 corpus refinements
there is nothing for it to decide that S1 does not.

The hand-made unknown encoding remains S1's and remains the source of the friction in visflow
design 20; this round shows the alternative is sound but, on real documents, not more decisive.
The friction that matters is therefore to be closed in S1 (F12/F15 incremental tabling, F9 delay
order), not by a kernel change.

## Changes this verdict makes

1. `probe/kernel3/` (S3 subject, random and corpus tracks), `run-conformance.mjs` (`--s3`,
   `--s3-seeds`, `compareS3`, `causeOf`, S3 columns and `complete:`), `vendor/package.json`
   (`clingo-wasm` 0.6.0) committed; `core.pl` declares the table facts; the corpus facts and
   witness regenerated.
2. Gate ledger: two S3 rows (witnesses and random against enumeration, seeds seen flipping);
   open item for the D1-incomplete demand and the generator's gaps (`choose`, UNSAT, `unknown`).
3. Decision rows: kernel unchanged; S3 a differential reference; the three refuting cells that
   did not fire and the one that did.
4. visflow design 21: nine friction items with clingo-wasm (no multi-shot API, forced JSON
   output, no symbol API, async-only worker entry, and so on).
5. Design 05 §Kernel: a sentence citing this round; constitution unchanged (no invariant touched).

## Left unmeasured

Derivations from clingo (reification is blocked by the forced output format in clingo-wasm; a
native clingo could try `--text` or a meta-encoding); the exclusivity arm; a generator with
`choose`, `count`, `unknown` labels and loops (the random track is narrow and the seeds show two
defects it cannot see); M1 across steps and PASS-is-final for S3 (the multi-step witnesses pass,
which covers the witness cases only); the scheduler (round 5); judge interaction.

## Files

`round-4b-preregistration.md` (amended, eleven review items taken), `results/round-4b-review.md`,
`results/round-4b-{witnesses,corpus,random,seeds}.txt`, `probe/kernel3/`, `probe/run-conformance.mjs`,
`probe/kernel2/core.pl`, `probe/export-facts.mjs`, `probe/prolog/corpus-facts.pl`,
`probe/witnesses/corpus-draft.yaml`, `probe/vendor/package.json`.
