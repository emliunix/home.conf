# Gate ledger

Committed predicates of the kernel-trials programme, each with the claim it protects, the seeded
defect that has been seen to flip it (`seeded-defect-gate`), and its honest `complete` flag.

| Gate | Claim | Command | Seen failing on | Complete |
| --- | --- | --- | --- | --- |
| Round 1 feasibility | the WFS engine in swipl-wasm gives undefined leaves, demand, proof trees, corpus speed | `node worklog/kernel-trials/probe/run-probes.mjs` | native-count mode (K1 demand walk from `call_delays` alone fails) | yes |
| Round 2 conformance, witnesses | the kernel matches the model on every §9 gate | `node worklog/kernel-trials/probe/run-conformance.mjs` | `core.pl` mutated: require violated under `u` forall (1 witness flips); forall-only demand (12 flip) | yes |
| Round 2 conformance, corpus + random | the kernel matches the model on real documents and on random programs against brute force | `node worklog/kernel-trials/probe/run-conformance.mjs --corpus --random 200 --d3` | the same mutations: 7/100 and 67/100 random programs flip | yes |
| Round 3 oracle fixtures | each oracle as declared separates its good fixture from its defective ones, and no defective fixture PASSes (the toolkit's gate, not the engine's) | `node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --cap 300` (live; 33 questions) | the seeded defects themselves: `verification_falsifies` fails on both (false PASS at p ≥ 0.97), `problem_resolved` and `scope_explicit` on the subtle one | yes |
| Round 4 evidence cells | the cell-grain oracle separates every seeded evidence-cell defect (bare, pointer, restatement, padded, one-in-four) from true chains, with and without paths | `node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle evidence_reasons --repeat 2 --ledger round4-B --cap 400` (live; 132 questions) | the seeded fixtures themselves: every defective and mixed fixture NO-GO, `terse` (goals/04 at HEAD before the rewrite) NO-GO on 5/5 cells | yes |
| Round 4 table facts | the host's table parser yields the rows and cells the oracle is asked over | `npx vitest run doc-verify/tests/language/tables.test.ts` | a table without the column binds nothing (the vacuous-pass case is a test); a scripted judge failing one cell violates that row only | yes |
| Round 4c witness cells | the cell-grain `witness_observable_in_row` separates restated, negated, padded, verified-asserting and pointer witness cells from genuine ones, and PASSes only the good fixture | `node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle witness_observable_in_row --repeat 2 --ledger round4c-C2 --cap 500` (live; 168 questions) | the seeded fixtures: gross, both subtle and the controls NO-GO; `good` PASS; the swapped fixture PASSes (the known relevance gap, not a gate) | yes |
| Round 4b S3 witnesses + corpus | the clingo subject agrees with the model's decided statuses and verdicts on every witness and corpus document (undetermined may refine, tagged) | `node worklog/kernel-trials/probe/run-conformance.mjs --s3` and `--s3 --corpus` | seed `no-exclusivity`: 3 witnesses FAIL | yes |
| Round 4b S3 random | the clingo subject equals brute-force enumeration exactly on random programs, with D1 and D2 checked on its demand | `node worklog/kernel-trials/probe/run-conformance.mjs --s3 --random 500` (exits 1 while the known D1 counterexample stands) | seed `ignore-body`: 105/500 unequal; seed `unsat-vacuous`: the inline odd-loop fixture | yes |
| Round 5 containment | no seeded escape has a host effect under any candidate; the build facts hold | `node worklog/kernel-trials/probe/run-boundary.mjs --containment` | the host-effect detector on a wrong path misses the planted file | yes |
| Round 5 gate | every module-derived clause body is sandbox-checked, directives and catch-class control refused, no real program refused | `node worklog/kernel-trials/probe/run-boundary.mjs --gate` | gate skipped (E1 runs); `core_count` as primitive (E9 runs); census widened (E14 runs); directive refusal skipped (E13 runs); a primitive dropped (a real program refused) | yes |
| Round 5 budget | the inference budget is sharp and bounds loops and large builtins; `catch/3` is refused by the gate because the budget alone cannot stop it | `node worklog/kernel-trials/probe/run-boundary.mjs --budget` | B = ∞ (E18 runs); B = 1 (a corpus document BLOCKED); catch refusal skipped (E17 runs under T2) | yes |
| Round 5 mutations | every boundary gate fails on its seeded defect and recovers | `node worklog/kernel-trials/probe/run-boundary.mjs --mutations` | the table itself (10 rows red then green) | yes |
| Round 5 scheduler | `full` and `prefix` reach the same final statuses on random multi-leaf programs; corpus round-1 demand equal | `node worklog/kernel-trials/probe/run-boundary.mjs --scheduler` | `prefix` made to take a leaf outside `Dem` (invariance fails) | yes |
| Round 6 request shape | the shape comparer sees a confident flip, a discordant cell and a position trend when they exist, and nothing on a clean pair; the engine's default shape is the declared one | `node worklog/kernel-trials/probe/compare-shapes.mjs --self-test` and `npx vitest run doc-verify/tests/oracles/request-shape.test.ts` | the comparer's planted synthetic pair; `request-shape.mutations.md` M2 (the default flipped back) | yes |
| Reference self-check | the naive reference matches hand derivations and brute force | `node worklog/kernel-trials/probe/reference/run-reference.mjs worklog/kernel-trials/probe/witnesses/*.yaml` and `node worklog/kernel-trials/probe/reference/random-brute.mjs 500 1` | reference mutated: demand without goal leaves (15/200), `not u` read as `t` (76/200) | yes |
| Round 7 property track | S1 matches the model on random programs over the whole language (loop-free by enumeration, loops by an alternating-fixpoint WFS), S3 matches stable models; every axis seed is visible only with the full grammar; counterexamples shrink to minimal programs | `node worklog/kernel-trials/probe/run-property.mjs --subject S1 --arm C5 --programs 500 --seeds 1,2,3` (and `--arm C5-features`, `--arm C5-shrink`, `--subject S3`, `--seeds-table`) | eight in-memory seeds: K1 170, K2 478, S3a 258 flips (controls, both arms); K4-low 121, K4-high 17, S3b 373, S3c 42 (axis, C5 only); K3' 73 under M2 | `true` on every arm; exit 1 on the refuting cells (loop-shape and the same-instance non-determinism on the S1 arms, K3' on the seeds table) |
| Round 8 module-page shape | the four `module-*` libraries' `current_not_history` separates seeded history from current law equally under `batched` and `per-atom`, and agrees with the lead's labels on the real pages | `node worklog/kernel-trials/probe/oracle-test.mjs --fixtures --oracle current_not_history --request-shape both --repeat 2 --no-spans --ledger round8-pages --cap 240` and the real-cells, pairs, claims and comparer commands of `round-8-verdict.md` | the gross pages (structural NO-GO under both shapes); the comparer's planted section-keyed flip | `true` on every track (the first claims/real attempt returned BLOCKED with no question sent and was re-run) |
| Round 9 relevance candidates | a relevance-only question per row labels a genuine witness on the wrong row `fails` (the bar: ≥ 8 of 10 swapped, ≥ 11 of 12/13 deranged, ≥ 4 of 5 decoys, ≥ 11 of 15 real deranged) while genuine rows hold | the five commands of `round-9-verdict.md` | the derangement, swap and decoy fixtures (every candidate reads them `holds`, so the gate is red by construction until the extraction form) | `true` on every track; the hypothesis refuted, nothing shipped |

## Open items

1. **Convert the random checks to property tests with shrinking** — **closed by round 7** (2026-10-13; `round-7-verdict.md`): fast-check 4.10.2 over a structural arbitrary for the whole language, subject pluggable, independent oracles, coverage and weights per run, every distinct minimal counterexample printed with its triple, eight seeds reddening it. Original text follows.
   **Convert the random checks to property tests with shrinking** (fast-check or equivalent):
   properties = model §9 gates, generator grammar over the whole language (joins, `choose`,
   `count`, `matches`, `present`, recursion, negative loops), subject pluggable (kernel, reference,
   TypeScript evaluator), coverage line per run, minimal counterexample printed. Owner's question
   of 2026-10-12; round 2 verdict §Findings about the probe method.
2. ~~Boundary gate~~ **Closed 2026-10-13 by round 5**: five tracks above; invariant 5 in force for
   the seeded classes. Still open from it: memory as such (the budget trips before the stack), a
   budget per constraint, native SWI-Prolog.
3. ~~`verification_falsifies` in extraction form~~ **Closed 2026-10-13 by round 4c**: re-authored
   on the cell grain (classification per row, not extraction); its gross and subtle fixtures
   redden. Still open from it: **witness relevance to the property** (the swapped fixture passes
   14/14), which the extraction form or a relevance question would cover.
4. **Evidence-cell threshold from real cells** (round 4 §Left unmeasured): goals/01's middling
   cells land at 0.55–0.66; a fixture set drawn from real goals, not seeded, is what sets the
   threshold. **Threshold half closed by round 10** (2026-10-13): on the rewritten corpus under
   per-atom, 0/13 evidence cells and 0/44 witness rows sit on the wrong side at 0.5, and every
   higher t only demotes right-side cells; 0.5 stays on both oracles (`round-10-verdict.md`;
   seeded defect: the sweep's eight self-test mutations each turn their case red). The wrong-row
   gap (the judge never sees the requirement text) stays open and is round 9's.
5. **S3's demand is D1-incomplete** (round 4b): a single-flip demand misses an atom that decides
   a binding only jointly with another (program #231 of seed 1). A syntactic cone (S1's) is the
   only D1-safe demand known; if S3 is ever more than a reference, its demand must be the cone.
6. **The random generator cannot see two defect classes** (round 4b seeds): no `choose` oracles
   and no UNSAT programs, so `no-exclusivity` and `unsat-vacuous` flip only witnesses. Extending
   the generator (item 1's property tests) is where this closes.
7. **A bound `count` result loses undefinedness** (round 7 finding 1): `core_count/3` binds its
   result to an interval term when atoms are unknown; a second count sharing the variable, or a
   constant result, fails unification instead of delaying (false PASS under `forbid`, false NO-GO
   under `require`); clingo says `undetermined`. Reachable from a legal module. Gate: the round 7
   property track's `count-bound` class (7.5% of programs) must report 0 after the fix; the fix
   belongs to the kernel before design 06's step 2 parity.
   **Closed 2026-10-13** (design 06 step 3): a bound result is compared through `core_cmp`
   (6f261fc), and identical count goals share one aux predicate so two counts of the same goal
   are equal (`core_same_count/2`, landed in doc-verify by the builder's review-fix commits). The
   round 7 S1 C5 arm re-run on the probe with both changes applied (in a scratch worktree; the
   committed probe stays the record): failing kinds `{"loop-shape":1}`, count-bound class 0 of
   1500 programs (was 63), complete; the seeds table flips as before (K3' 0 on `sound`, as
   corrected). Records: `results/item-7-fix-S1-C5.txt`, `results/item-7-fix-seeds.txt`; tests:
   `doc-verify/tests/kernel/regressions.test.ts`.
8. **A loop-resting binding is demanded once before it is called unfounded** (round 7 finding 2):
   a choose conjunction no answer satisfies, behind a loop, keeps its atom in Dem for one round.
   Statuses and verdict are the WFS's; one judge question is wasted. Open precision item; the
   model's syntactic support is the current text.
9. **History-dependent `instantiation_error` on a reused kernel instance** (round 7 finding 3):
   one program in 1500 raises it as call 20 of a 28-call sequence on one instance and never on
   a fresh one. Production uses a fresh instance per check; the harness keeps the triple and the
   history (`results/round-7-S1-C5.txt`). Open until reproduced in isolation and fixed.
10. **`current_not_history` passes regex-clean history under both request shapes** (round 8):
    11 of 12 seeded pages whose one edited sentence states a former value or order read
    `holds` at 0.6–0.98 under `batched` and `per-atom` alike; the hook's dated-prose regex
    catches only dated and numbered history. Open: a question round on this oracle (a
    per-sentence or per-paragraph ask, or an explicit former-value clause) with
    `probe/oracle-fixtures/module_*_pages/` as its fixtures; until then the module-page history
    check is the regex plus a judge that misses the subtle form.
11. **Witness relevance: neither a question nor a one-shot extraction decides it** (round 9,
    five candidates): a relevance-only question reads any plausible failure as this row's
    (0.5–0.93); a `choose` over the table's properties with the row's own Property cell in the
    evidence echoes that cell (E1: every wrong row named its own property at 0.8–1.0); the same
    choose over the witness alone extracts correctly when it decides (E2: precise source-row
    names, `none` on neutral text, no echo) but a 15-way answer leaves half the rows below 0.6.
    Open: a binary-per-candidate or rule-read ranked extraction over witness-only evidence,
    against round 9's bar (≥ 8/10 swapped, ≥ 11 of 12 and 13 deranged, ≥ 4/5 decoys, ≥ 11/15
    real deranged; held ≥ 13/14 and ≥ 28/30), with round 9's sets and labels as fixtures;
    `core.row_with_column` and the E1/E2 sets are in the tree for it. Supersedes item 4's
    wrong-row half.

