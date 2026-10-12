# Round 5 verdict — the trust boundary (2026-10-13)

## Predicate

```sh
node worklog/kernel-trials/probe/run-boundary.mjs --containment   # complete: true, exit 0
node worklog/kernel-trials/probe/run-boundary.mjs --gate          # complete: true, exit 0
node worklog/kernel-trials/probe/run-boundary.mjs --budget        # complete: true, exit 0 (after the catch refusal; see below)
node worklog/kernel-trials/probe/run-boundary.mjs --mutations     # complete: true, 10/10 rows red then green
node worklog/kernel-trials/probe/run-boundary.mjs --scheduler     # complete: true (measurement track)
```

Outputs: `results/round-5-{containment,gate,budget,mutations,scheduler}.txt`. No judge was
called. Every seed ran in a fresh instance in a child process with a 20 s timeout. Build:
`swipl-wasm` 8.2.2, SWI-Prolog 10.1.15 (version flag 100115, pinned and checked), Node 26.

## What measured

**Containment (T0, the instance alone).** No seed under any candidate produced a host effect;
the positive control (a file planted from the host) was detected. The build facts held: no host
filesystem mount, no process or network library, `shell/1` unimplemented, a fake environment.
The JS bridge the build exposes (`:=/2` in module `wasm`) resolves its object chain against
`window`, which does not exist under Node, so E8 raised a `js_eval_error` and reached nothing.

**Gate (T1).** Every seed predicted caught by the gate was `rejected`: raw filesystem, process,
network, environment and bridge clauses; the two meta-primitive escapes (E9 `core_count` over
`open/3`, E10 `core_naf`/`core_tnot` over `open/3`), caught because the three meta-primitives are
declared `safe_meta`, so the sandbox recurses into their goal argument; the constraint-goal escape
E14, caught at `core_forall/2`; the directive E13, refused at load before consult. Census:
every module-derived predicate checked (defined = checked, unchecked 0). No false refusal on 48
witness steps (every answered state) and 26 corpus documents.

**Budget (T2b alone, T2 with the gate).** B derived as 20 × the largest corpus evaluation
(43 847 inferences, design/02) = 876 940. The boundary control is sharp: BLOCKED at B = N − 1,
ran at B = N (the wrapper counts one inference fewer than `statistics/2` for this goal). Overhead
of the wrapper on the corpus: 6%. Scaling under the goal module: 10, 30, 100, 300 sections cost
4 360 to 4 650 inferences, flat, all far under B. The loop E15 is BLOCKED under the budget.

**The headline: `catch/3` swallows the budget.** E17, a raw clause `catch(loop, _, true)`, ran
to completion under the budget alone: SWI's `inference_limit_exceeded` is an ordinary exception
and a program-level catch takes it. The plan had this as its low-confidence open question. The
fix is in the gate, not the budget: translated programs never emit `catch/3`,
`catch_with_backtrace/3`, `setup_call_cleanup/3` or `call_cleanup/2`, so a module-derived clause
body carrying one is refused. After that amendment E17 is `rejected` under T1 and T2 and still
`ran` under the budget alone, which is the honest row: the budget bounds inferences, the gate
bounds control.

**Mutations (R6).** Ten rows, each red under its seeded defect and green on restoration: the
host-effect detector on a wrong path; the gate skipped (E1 runs); `core_count` declared a
primitive (E9 runs); a base primitive dropped (a real program refused); the census exclusion
widened (unchecked > 0, E14 runs); directive refusal skipped (E13 runs at consult); catch
refusal skipped (E17 runs under T2); B = ∞ (E18 runs); B = 1 (a corpus document BLOCKED); the
scheduler check with `prefix` taking a leaf outside `Dem`.

**Scheduler (measurement, no verdict).** Corpus round-1 demand: `full` 105, `prefix` 105,
identical on 26 of 26 documents (a property of these documents: no derivation has two unanswered
oracle leaves). Random programs (200, seed 1, simulated judge, cap 6 rounds): final statuses
identical under both policies on 200 of 200 (M1); `prefix` asks 751 atoms in 2.33 rounds on
average against `full`'s 864 in 1.99: 13.1% fewer atoms, 17% more rounds. Below the
pre-registered 20% threshold, so design 05's declared default `prefix` stays.

## Expectations the run contradicted (corrected in place in the runner, with the reason)

- **E6 and E16** (count products over the largest document) were predicted to exceed B; they cost
  far less (hundreds of ms, under a million inferences). The seeds were mis-sized against a budget
  derived from the corpus; E15 and E18 show the budget works. Corrected to `ran`.
- **E10** was predicted to run under T0; the kernel's own groundness guard rejects the non-ground
  `open/3` goal before any host attempt. Stronger containment than predicted.
- **E18** (`numlist/3` over 20M) was predicted to pass the budget as single inferences; it is
  BLOCKED, as is the stack seed **E19**: in this build those builtins count per element.
- **E17** as above: the budget alone is defeated; the gate closes it.

## What the round says about invariant 5

The boundary is three layers with measured, separate jobs: the instance contains what the build
cannot do (filesystem, process, network, environment, the JS bridge under Node); the gate refuses
what a module-derived clause must not do (any primitive outside the kernel's declared surface,
any directive, any control construct that could swallow the budget); the budget bounds what a
module may legitimately express but at a cost (loops, large builtins) and is sharp to the
inference. Each gate has been seen failing on its seeded defect and recovering. **Invariant 5 is
in force** under R6 for the language features the seeds cover; not covered: memory beyond one
stack seed (the budget tripped first), native SWI-Prolog, the judge-side outbound policy (design
02's, gated by `npm test -- semantic confidentiality`), the model §8 static checks (round 2).

## Changes this verdict makes

1. `probe/kernel2/kernel.mjs`: the gate as amended (census by Prolog enumeration, `safe_meta`
   for the three meta-primitives, directive refusal at load, catch refusal in clause bodies, the
   `resource` class, the budget reporting BLOCKED) with every mutation as an option.
2. `probe/run-boundary.mjs`: the five tracks, child process per seed, the mutation table.
3. Design 05 §Kernel: the boundary sentence made measured, citing this round; the verification
   table's "Trust boundary" row cites the committed commands.
4. Constitution invariant 5: "in force" with the citation and the uncovered classes named.
5. Gate ledger: five boundary rows (one per track) with the defects seen failing; open item 2
   (the boundary gate) closed.
6. Scheduler: the default stays `prefix`; the measurement is in the gate ledger as a regression
   gate (M1 on random programs, the corpus equality).

## Left unmeasured

Native SWI-Prolog; a budget per constraint; memory growth as such (the budget trips before the
stack); the `cheapest-evidence` and `most-pruning` policies; the translator's own quoting as a
separate gate (every atom quoted, every pattern validated; the raw-clause seeds stand for any
translator defect).

## Files

`round-5-preregistration.md` (amended; thirteen review items taken), `results/round-5-review.md`,
`results/round-5-{containment,gate,budget,mutations,scheduler}.txt`, `probe/run-boundary.mjs`,
`probe/kernel2/kernel.mjs`, `probe/kernel2/.gen/sched-lib.mjs`.
