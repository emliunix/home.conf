# Round 7 — property tests with shrinking over the whole language

Written 2026-10-13 before the run; amended the same day after the independent review
(`results/round-7-review.md`, verbatim) and before the run. Gate-ledger item 1 (open since round
2): the random track (`--random`, witness class C4) is brute force over a narrow generator (2–3
two-label oracles, 2–4 non-recursive rules, 1–2 constraints; no `choose`, `count`, `matches`,
`present`, recursion, loops or `unknown` answers), reports a counterexample without a minimal
program and prints no coverage. Round 4b's seeds showed two defect classes it cannot see. The
gate ledger asks for "fast-check or equivalent, properties = model §9 gates, generator over the
whole language, subject pluggable, coverage line per run, minimal counterexample printed". Owner
direction of 2026-10-13: continue autonomously; the implementation is built by the `builder`
seat (Cursor) and reviewed by the `reviewer` seat (Devin) in the Herdr team led by this session.

## Hypothesis

With a fast-check generator over the whole module language (C5) and structural shrinking:
(a) every axis seed (K3', K4-low, K4-high, S3b, S3c) is flipped by the arm with the new features
on and by no arm with them off, while the control seeds (K1, K2, S3a) are flipped by both; (b)
every counterexample shrinks to a program that is minimal under the neighbourhood below and no
larger than 8 atoms for a seed; (c) on the unmutated subjects, S1 shows no counterexample in
`sound`, `cover`, `verdict`, `M1`, `M2`, `D2` or `policy` on loop-free programs and matches the
WFS oracle exactly on loop programs, and S3 matches enumeration exactly on loop-free programs
except the pre-registered expected red in `D1` (round 4b's single-flip demand). **Refuting
cells:** an axis seed flipped by the features-off arm, or not flipped by the features-on arm; a
control seed not flipped by either; a shrunk seed witness that is not minimal or exceeds 8 atoms;
a new counterexample on an unmutated subject in a cell not pre-registered red (a new finding: for
S1 in `sound`, `M1` or `verdict` it is unsoundness and reopens the kernel decision; in `D1` on S1
it moves the model's D1 wording, not the kernel; on S3 it is tagged as round 4b tagged
refinements); a seed's trigger floor not met (the claim is narrowed, and `complete` is false).

## Axis: a 2×2 on the random track, one runner and comparator

| Arm | Generator | Shrinking | Role |
| --- | --- | --- | --- |
| C5 | full language | on | the main arm |
| C5−features | C5 with `choose`, `count`, `matches`, `in`, `cmp`, recursion, loops and `unknown` off (C4's grammar) | on | shows the axis seeds are invisible for want of the generator, not the properties |
| C5−shrink | full language | off | shows flips do not depend on shrinking; gives size before and after |
| C4 script | the existing `--random` | none | historical control only (its own RNG and comparator) |

fast-check seeds `[1, 2, 3]`, 500 programs per arm per seed; the same seed list in every arm.
Shrinking is a sub-axis that affects only measurement (b).

## Subjects, oracles and comparisons (per property)

Subjects: S1 (the SWI WFS kernel, `kernel2/kernel.mjs`) and S3 (clingo, `kernel3/`). The
reference evaluator is not a subject this round. Oracles live in the brute-force file and share
no code with `reference.mjs`, `core.pl` or `subject-clingo.mjs`:

| Program class | Oracle | S1 comparison | S3 comparison |
| --- | --- | --- | --- |
| loop-free (incl. positive recursion) | enumeration over every total extension of the partial answer, each completion evaluated by least fixpoint per stratum; `choose`: one label per unasked atom per completion | `sound`, `cover`, `verdict`, `M1`, `M2`, `D1` (amended wording, below), `D2`, `policy`, as C4 states them | exact equality of statuses and verdict with enumeration; `D1`/`D2` on S3's demand |
| even negative loop | an independent ground alternating-fixpoint (WFS) evaluator; stable-model sets by subset enumeration of the ground program | exact: the resting bindings `undetermined`, listed under `unfounded`, no atom in `Dem` decides them, D1 exempt for them, verdict NEEDS-REVIEW when an error constraint rests on one | cautious/brave over the stable models: `undetermined` on the loop, decided elsewhere |
| odd negative loop reachable from a constraint | the same WFS evaluator | as above (the loop is unfounded) | UNSAT reported explicitly; every status `undetermined`; verdict NEEDS-REVIEW; never a vacuous PASS |
| odd loop in a predicate no constraint reaches | the same | the loop is reported unfounded only if demanded; constraints decided as loop-free | S3's status rule over the relaxed forall: the unrelated constraints decided as loop-free |
| `matches` on an operand not bound by an earlier positive literal (explicit "unbound" mode) | syntactic: `rejected` | `rejected` by the kernel's static check (not a truth value) | `rejected` (S3 refuses pre-evaluation on a derived operand) |

D1 wording, copied from `kernel2/random.mjs`: every labelling of `Dem(full)` decides every
binding that enumeration can decide, with the `exempt()` cases (bindings resting on a loop) and
the `d1Weak` count (resolvable at `ans` but unresolvable after `Dem`) reported, not failed, for
S1; for S3, D1 is pre-registered **red** (round 4b, program #231; item 5), the shrunk witness
expected ≤ 6 atoms, and the command exits 0 on that cell with "expected" printed.

`count` exactness is asserted only on uncorrelated counts (`count(S, o(d, S), N)` directly over
oracle atoms with distinct sections): there `[c, p]` equals `[min, max]` over completions and a
`cmp` is `t`/`f`/`u` exactly as enumeration says; correlated counts are checked for containment
only (model §3 says they over-approximate).

## Generator (C5): plain-data AST, structural arbitrary, no `chain` or `filter`

- Facts: `section(d, S, P)` for 2–4 sections in a parent chain (`root → a → b → c → e`), which
  gives the edge relation recursion walks; `selected(d, S)` at 50%; `heading(d, S, T)` with `T`
  from a fixed vocabulary of six words; `depth(d, S, N)` with `N` = 1–4.
- Oracles: 2–3 two-label oracles; a `choose` oracle (2–3 labels) at 30%; answers partial: each
  ground atom answered at 40%, and of those `unknown` at 15% (never demanded; model §6).
- Rules: 2–6 over predicates `p1..pk`; body literals: a base fact, an oracle atom (a two-label
  atom or a `choose` label atom), an earlier predicate; negation at 30%; `in` (over the heading
  vocabulary) at 30%; `matches` (patterns: literals, `^`/`$` anchors, `|`; the same subset S1's
  PCRE and the oracle's JS matcher agree on) at 30%; `cmp` on `depth` (`<`, `>=`, `=:=` against
  1–4) at 30%; `count` at 30%, uncorrelated form at 50% of those, bound `N >= K`, `K` in
  1–sections; positive recursion (`anc(S, T) :- child(S, T). anc(S, T) :- child(S, U), anc(U,
  T).`) at 20%; a negative loop (even or odd, 50/50) at 15%, reachable from a constraint at
  50% of those. Predicates refer only to earlier ones except through the recursion and loop
  switches (stratified by construction).
- Constraints: 1–3, `require`/`forbid`, `nonempty` at 25%, `forall` over a base fact or an
  oracle atom at 40%.
- Triggers: a program with two labels of one `choose` atom in one rule body or goal, same
  section variable, atom unanswered (S3c's site) at ≥ 10%; a boundary `count` (`c < K ≤ p` under
  some completion) at ≥ 10%; a reachable odd loop at ≥ 7%.
- References are indices resolved modulo the pool at render time, so any sub-AST renders to a
  valid program and deletion is a legal shrink; optional features are optional fields that shrink
  to absent. Everything the property draws on (`ans`, the chosen total completion as a bitmask,
  the `mid` subset) is part of the shrinkable value; a counterexample is re-evaluated once before
  shrinking and printed `non-deterministic` if it does not reproduce.
- Caps enforced by the generator: free (unanswered) atoms ≤ 10; `|Dem|` for the D1 loop ≤ 4.

## Seeds (applied in memory through options, never by editing a committed file)

| Seed | Subject | Defect | Kind | Flipped by (arm, property) |
| --- | --- | --- | --- | --- |
| K1 | S1 | require violated under a `u` forall (round 2's `core.pl` text patch, applied by a kernel load option) | control | both arms, `sound` |
| K2 | S1 | forall-only demand (round 2's patch) | control | both arms, `D1` |
| S3a | S3 | status rule ignoring the body (`defect: ignore-body`) | control | both arms, exact equality |
| K3' | S1 | an answered `choose` leaves the other labels `u` (patch of `core_not_label`/`core_choose`) | axis | C5 only, `sound` (a `forbid` over another label is `satisfied` by enumeration, `undetermined` by the kernel is conservatism; the flip is on `cover`/`sound` where the kernel says `t` for a label the answer rules out) |
| K4-low | S1 | `count` interval upper bound one too low | axis | C5 only, `sound` |
| K4-high | S1 | `count` interval upper bound one too high | axis | C5 only, exactness on uncorrelated counts |
| S3b | S3 | UNSAT treated as vacuous (`defect: unsat-vacuous`) | axis | C5 only, odd-loop shape (verdict PASS where NEEDS-REVIEW) |
| S3c | S3 | `choose` exclusivity dropped (`defect: no-exclusivity`) | axis | C5 only, exact equality on two-label-of-one-atom programs |

Per seed and arm the runner prints: programs where the seed's site is exercised and can change
the outcome (the trigger count; floor 20 of 500, else "narrowed"), flips among the 500, and the
shrunk witness with its size before and after. Red under the seed, green restored, as round 5.

## Minimality (the neighbourhood, independent of the shrinker)

A shrunk counterexample is *minimal* when no neighbour fails the same property: delete one rule,
oracle, constraint, fact, `selected` fact or answer entry; delete one body literal; flip one `not`
to positive; weaken one `unknown` answer to absent; narrow one `choose` to two labels. An
invalid neighbour (dangling predicate, checker-rejected) is skipped and counted. Printed as
minimal / non-minimal counts with the non-minimal program; seed witnesses ≤ 8 atoms.

## Measurements

- Per arm, subject, property: programs, counterexamples (each with the shrunk program, sizes,
  the minimality line, a `cause` tag for S3 as round 4b tagged refinements), `d1Weak` and
  exempt counts.
- The seed table above.
- Coverage line per arm from the generated programs: share with each feature, the three trigger
  shares, the share of undetermined bindings; "narrowed" when a named feature is under 5%.
- Cost: wall time per arm, the shrinker's share, S1 and S3 evaluations counted; a per-property
  timeout of 10 minutes makes `complete` false.

## Expected outcomes (recorded before the run)

| Measure | Expectation | Refuting cell | Confidence |
| --- | --- | --- | --- |
| controls K1, K2, S3a | flipped in both arms (K1 ≈ 7%, K2 ≈ 67%, S3a ≈ 20% of programs, as before) | not flipped in either | high |
| axis K3', K4-low, K4-high | flipped in C5 (≥ 5 flips each), 0 in C5−features | 0 flips in C5, or any in C5−features | medium |
| axis S3b, S3c | flipped in C5 (≥ 5 each), 0 in C5−features | as above | medium-high |
| triggers | each ≥ 20 of 500 | a floor missed | medium |
| S3 × D1 | red, pre-registered; witness ≤ 6 atoms | a witness > 6 atoms, or green (the item-5 finding gone) | medium |
| unmutated S1, loop-free | 0 counterexamples in sound/cover/verdict/M1/M2/D2/policy; `d1Weak` ≈ 7–8% | any | medium (D1 under `count` is the likeliest) |
| unmutated S1, loops | exact against the WFS oracle | any | medium-low (first time the loop shape is checked) |
| unmutated S3 | exact except D1 | any | medium |
| minimality | every seed witness minimal under the neighbourhood, ≤ 8 atoms | one non-minimal or larger | medium-low (the arbitrary's shrink may be coarser than the neighbourhood; then the finding is about the arbitrary) |
| C5−shrink | the same flips as C5; sizes 2–5× larger | different flips | medium-high |
| cost | ≤ 40 min for all arms and subjects at 1500 programs each | — | low |

## Predicate

```sh
node worklog/kernel-trials/probe/run-property.mjs --subject S1 --arm C5           --programs 500 --seeds 1,2,3
node worklog/kernel-trials/probe/run-property.mjs --subject S3 --arm C5           --programs 500 --seeds 1,2,3    # exits 0 with "expected" on S3 × D1
node worklog/kernel-trials/probe/run-property.mjs --subject S1 --arm C5-features  --programs 500 --seeds 1,2,3
node worklog/kernel-trials/probe/run-property.mjs --subject S1 --arm C5-shrink    --programs 500 --seeds 1,2,3
node worklog/kernel-trials/probe/run-property.mjs --seeds-table --programs 500 --seeds 1,2,3                     # every seed × arm, red then green
node worklog/kernel-trials/probe/run-conformance.mjs --random 500 --s3                                          # the C4 script, historical control
```

`complete: true` iff no property was skipped or timed out, every seed applied and restored,
every counterexample printed with its shrunk program and minimality line, every trigger floor
met, no named feature under 5%, and every out-of-scope skip covered by the expected-failure
table (S3 refuses `present` and `matches` over a count; the generator does not emit them for S3).
Exit non-zero on a refuting cell; zero on a pre-registered expected red.

## Left unmeasured

The model's own D1 gap (`d1Weak`): a property of the definition, reported not failed; a new
class found by C5 moves the model text. Item 5 (S3's single-flip demand): the shrunk witness is
produced; a second class would not change "S3 is a differential reference". `present/3`. The
missing-literal gate and the non-ground-negation static check (kernel-side; round 2). Multi-step
answer growth (M1 is checked on one extension). Real documents against random (the conservatism
figure is the generator's). Whether a loop counterexample is the kernel's or the S3-versus-WFS
gap: tagged by cause.

## Review

`results/round-7-review.md`, fifteen findings, "run after amendments". Taken before the run:
1 (exclusivity dropped as a property; K3 replaced by K3'; S3c kept; the trigger), 2 (D1 wording
copied; S3 × D1 pre-registered red with exit 0; cells split by subject; the reopening criterion
named), 3 (the 2×2 arms; controls and axis seeds labelled; one seed list), 4 (the oracle table:
lfp enumeration, WFS evaluator, stable-model sets; expected statuses per loop placement), 5
(K4 in both directions; exactness on uncorrelated counts only; `cmp` shape), 6 (the
neighbourhood; invalid neighbours counted; size bound), 7 (determinism: every drawn value in the
shrinkable value; reproduce before shrink), 8 (fast-check pinned in `probe/vendor`; the AST and
index-modulo scheme; invariants), 9 (triggers with floors; flips counted; three seeds; weights
stated), 10 (caps on free atoms and `Dem`; timeout; cost row revised), 11 (subjects S1 and S3;
S3's out-of-scope features not generated for it; the fact vocabulary; `rejected` defined; K1–K4
as load options), 12 (S3a by exactness; gates out of scope listed), 13 (the loop shape for S1
defined), 14 (`complete` conditions; expected red exits 0), 15 (left unmeasured).
