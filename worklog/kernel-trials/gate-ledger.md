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
| Reference self-check | the naive reference matches hand derivations and brute force | `node worklog/kernel-trials/probe/reference/run-reference.mjs worklog/kernel-trials/probe/witnesses/*.yaml` and `node worklog/kernel-trials/probe/reference/random-brute.mjs 500 1` | reference mutated: demand without goal leaves (15/200), `not u` read as `t` (76/200) | yes |

## Open items

1. **Convert the random checks to property tests with shrinking** (fast-check or equivalent):
   properties = model §9 gates, generator grammar over the whole language (joins, `choose`,
   `count`, `matches`, `present`, recursion, negative loops), subject pluggable (kernel, reference,
   TypeScript evaluator), coverage line per run, minimal counterexample printed. Owner's question
   of 2026-10-12; round 2 verdict §Findings about the probe method.
2. **Boundary gate** (round 5): a module that reaches the judge, the network, the filesystem or
   the budget without BLOCKED.
3. ~~`verification_falsifies` in extraction form~~ **Closed 2026-10-13 by round 4c**: re-authored
   on the cell grain (classification per row, not extraction); its gross and subtle fixtures
   redden. Still open from it: **witness relevance to the property** (the swapped fixture passes
   14/14), which the extraction form or a relevance question would cover.
4. **Evidence-cell threshold from real cells** (round 4 §Left unmeasured): goals/01's middling
   cells land at 0.55–0.66; a fixture set drawn from real goals, not seeded, is what sets the
   threshold. The wrong-row gap (the judge never sees the requirement text) is open with it.
