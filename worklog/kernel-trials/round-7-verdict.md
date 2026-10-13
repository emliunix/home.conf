# Round 7 verdict — property tests with shrinking over the whole language (2026-10-13)

## Predicate

```sh
node worklog/kernel-trials/probe/run-property.mjs --subject S1 --arm C5           --programs 500 --seeds 1,2,3   # exit 1: complete: false (one same-instance non-determinism); one refuting loop-shape cell
node worklog/kernel-trials/probe/run-property.mjs --subject S3 --arm C5           --programs 500 --seeds 1,2,3   # exit 0: complete: true; S3 × D1 red as pre-registered (43 triples)
node worklog/kernel-trials/probe/run-property.mjs --subject S1 --arm C5-features  --programs 500 --seeds 1,2,3   # exit 0: complete: true; 0 failures
node worklog/kernel-trials/probe/run-property.mjs --subject S1 --arm C5-shrink    --programs 500 --seeds 1,2,3   # exit 1: the same flips as C5, unshrunk
node worklog/kernel-trials/probe/run-property.mjs --seeds-table --programs 500 --seeds 1,2,3                     # exit 1: complete: true; one refuting cell (K3')
```

Run by the lead 09:40–10:11 (sequentially, 31 min); the takeover builder's run of the same
code (09:16–09:24) gives the same failing-kind counts, the same seeds table and the same single
non-determinism, and is archived beside the lead's. Outputs: `results/round-7-{S1-C5,S1-C5-features,
S1-C5-shrink,S3-C5,seeds}.txt`; the lead's hand-made record of the first finding,
`results/round-7-sound-repeated-count.txt`. The build went through two seats (the Cursor
`builder` until its provider failed mid-round, then an Opus subagent), two reviews by the
`reviewer` seat (`/tmp`: 24 findings on the first build, 10 on the second; the second review
closes blocking findings 1–8 at the cited lines and reproduces the count-bound finding
independently), and two pre-run amendments by the lead (trigger weights; the `count-bound` mode).

## What measured

**Seeds table** (triggers per 500 programs; flips = the predicted property fails under the seed
and not on the restored subject; every witness minimal under the plan's neighbourhood):

| Seed | Role | C5 triggers / flips | C5−features triggers / flips | Witness |
| --- | --- | --- | --- | --- |
| K1 (require violated under a `u` forall) | control | 151 / 170 | 122 / 95 | 19→3 |
| K2 (forall-only demand) | control | 440 / 478 | 481 / 895 | 22→3 |
| S3a (status rule ignores the body) | control | 282 / 258 | 260 / 284 | 19→3 |
| K3' (answered choose leaves other labels `u`) | axis | 88 / **0** (M2 73, loop-wfs 15 as other kinds) | 0 / 0 | none |
| K4-low (count upper bound one too low) | axis | 147 / 121 | 0 / 0 | 14→4 |
| K4-high (count upper bound one too high) | axis | 47 / 17 | 0 / 0 | 17→3 |
| S3b (UNSAT treated as vacuous) | axis | 137 / 373 | 0 / 0 | 15→4 |
| S3c (choose exclusivity dropped) | axis | 71 / 42 | 0 / 0 | 22→5 |

Controls flip under both arms; every axis seed is invisible to the C4 grammar (0 triggers) and
every axis seed but K3' flips under C5. C5−shrink gives the same flips with unshrunk witnesses
3–5× larger. Every trigger floor (20 of 500) is met by 47–481.

**Unmutated subjects, C5 (1500 programs each).** S1: failing programs by kind sound 26, verdict
15, policy 5, loop-wfs 16, D2 5, loop-shape 1; 32 distinct shrunk triples, every one of them in
the `count-bound` class (the pre-run amendment's class; `loop-wfs` instances are the same
`core_count` unification inside loop programs), plus one loop-shape triple and one same-instance
non-determinism; d1Weak 115 (7.7%, the predicted 7–8%); coverage choose .27, count .72,
countBound .075, matches .62, unboundMatches .067, in .64, cmp .64, recursion .13, negative
loops .33, unknown answers .39; wall 473 s. S1 C5−features: 0 failures. S3: D1 85 programs, 43
distinct triples, all of gate-ledger item 5's class (a binding decided only jointly), smallest 5
atoms; exact, D2, loop-stable and unbound-matches 0; wall 388 s.

## The findings

1. **A bound `count` result is a kernel defect (new gate-ledger item).** `core_count/3` in
   interval mode binds its result to `core_iv(C, P, UGoals)` when atoms are unknown; a second
   `count` literal sharing that result variable, or a constant result, then fails unification
   instead of delaying, so the conjunction is false: `satisfied` under `forbid` (a false PASS,
   the lead's hand-made record) and `violated` under `require` (a false NO-GO, the smallest
   generated triple: one section, one oracle, `ans: {}`, two counts sharing `N0`). Single
   counts, a fresh variable per count, and clingo all say `undetermined`. The design-04 checker
   refuses a constant result but accepts the shared variable, so the defect is reachable from a
   legal module. The generator's share of the class is 7.5% of programs; nothing else failed on
   S1 loop-free programs, so the amended expectation ("S1 sound counterexamples of exactly this
   class; S3 clean") holds. Fix (round 11 or earlier, under the kernel migration): a count whose
   result is already bound compares the value against the interval and delays when the interval
   does not decide it; the property arm is the gate.
2. **A binding resting on a loop through an unsatisfiable choose conjunction is demanded once
   before it is called unfounded** (refuting on the plan's loop-shape wording). Verified by the
   lead: with `ans: {}` S1 demands `k(d,a)` although neither label can decide `c1/a`; after
   either answer it reports `undetermined` and lists `p1(d,a)` unfounded; clingo reports UNSAT.
   Statuses and verdict equal the WFS throughout, so this is a demand-precision gap (one judge
   question wasted on a binding no answer decides), of the same nature as `d1Weak`, and the
   plan's wording ("resting bindings listed under unfounded") is stronger than the model's
   syntactic support. Recorded as an open precision item; the model text is not moved here.
3. **History-dependent `instantiation_error` on a reused instance** (seed 1, program 301, 16
   atoms, not minimal). As call 20 of a 28-call check sequence on one swipl instance the input
   `ans + {k(a)=x}` raises `error(instantiation_error, _)` (BLOCKED); as the first call on a
   fresh instance the same input gives NO-GO with statuses; reproducible 4/4 on that history,
   gone when any one of the 19 preceding calls is removed; simple histories (repeats,
   alternations, the lead's 35-call sequence) do not trigger it; fresh-instance divergence 0 in
   1500 programs, S3 0/0. Production (design 06 §Model) uses one fresh instance per check, so no
   verdict can see it; the harness can. Recorded as an open kernel item with the triple and the
   history in `results/round-7-S1-C5.txt`.
4. **K3' cannot flip `sound` (the plan's prediction was wrong, corrected in place).** The
   plan's defect for K3' ("an answered choose leaves the other labels `u`") is conservative by
   construction: a `u` label never makes a `require` pass or a `forbid` fail, so `sound` and
   `cover` cannot flip. The patch is live (88 triggers, M2 73 and loop-wfs 15 other-kind flips,
   8 green-still) and the harness sees it under M2 (the total-answer property), which is where
   the plan now predicts it. The refuting cell stands as recorded; it is a prediction error, not
   a harness or kernel fault.

## Expectations against the run

| Expectation | Outcome |
| --- | --- |
| controls flipped in both arms | met (rates 11%, 32%, 17% under C5; the "as before" rates were C4's) |
| axis K3', K4-low, K4-high: ≥ 5 flips in C5, 0 in C5−features | K4-low 121, K4-high 17 met; **K3' 0 (prediction corrected: M2 is its property)**; 0 in C5−features met |
| axis S3b, S3c | 373 and 42: met |
| triggers ≥ 20 of 500 | met (47–481) |
| S3 × D1 red, witness ≤ 6 | met on the cell's smallest witness (5); 16 of 43 triples exceed 6 and are printed |
| unmutated S1 loop-free: 0 counterexamples | **as amended**: the count-bound class only (finding 1); nothing outside it |
| unmutated S1 loops: exact against WFS | met except finding 2 (one loop-shape triple) and finding 1's loop instances |
| unmutated S3 exact except D1 | met |
| minimality ≤ 8 atoms | met (3–5) |
| C5−shrink same flips, 2–5× larger | met (3–5×) |
| cost ≤ 40 min | met (31 min sequential by the lead; 40 min by the builder with the shrinker on) |
| `complete` | S1 C5 and C5−shrink `false` for finding 3 alone; the other three `true` |

## Decisions recorded (`decisions.md`)

Gate-ledger item 1 closes: the property track exists (fast-check 4.10.2 pinned, a structural
arbitrary over the whole language with keep-masks so the raw shrinker reaches small programs,
properties = the model's §9 gates plus loop and demand shapes, subject pluggable, independent
oracles with a real alternating-fixpoint WFS and stable-model enumeration, a coverage line and
weights printed per run, every distinct minimal counterexample recorded with its (module, facts,
ans) triple and its minimality under the plan's neighbourhood, `complete` from the plan's list
only, exit non-zero on a refuting cell); eight seeds redden it. The builder's decisions beyond
the plan, accepted: fast-check's shrinker on the raw record with the plan's neighbourhood as the
check only; D1 uncapped (every labelling of Dem, cost in the checking time); the S3 × D1 bound
read on the cell's smallest witness with every size printed; the constant count result refused
by the checker, run past it for S1 (recorded) and expected `rejected` for S3; stable models over
the whole program (an odd loop makes every program UNSAT, so the plan's "unrelated constraints
decided as loop-free" is S1's property, not S3's); the count-bound class defined operationally
(the unbound twin passes the same kind); correlated counts in constraint goals only, forced count
constraints with a section-only forall, the choose trigger weight 0.45. New gate-ledger items for
findings 1–3; the K3' prediction corrected in `round-7-preregistration.md`.

## Left unmeasured

`present/3`; loops behind derived predicates deeper than the two generated shapes; the 16 S3 × D1
triples above 6 atoms (a shrinker limit, not a new class); the constant-result count on S1 (66
programs generated, no boundary hit; the manual probe shows the same defect); judge involvement
(none in this round); the C4 script control (unchanged, historical).

## Records

`round-7-preregistration.md` (plan, review, two amendments, the K3' correction),
`results/round-7-review.md` (plan review), `results/round-7-*.txt` (the five outputs and the
hand-made record), `probe/run-property.mjs` and `probe/property/*.mjs` (the track),
`probe/kernel2/kernel.mjs` (the in-memory `corePatch` load option), `probe/vendor/package.json`
(fast-check pinned), `decisions.md`, `gate-ledger.md`.
