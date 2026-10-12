# Gate ledger

Committed predicates of the kernel-trials programme, each with the claim it protects, the seeded
defect that has been seen to flip it (`seeded-defect-gate`), and its honest `complete` flag.

| Gate | Claim | Command | Seen failing on | Complete |
| --- | --- | --- | --- | --- |
| Round 1 feasibility | the WFS engine in swipl-wasm gives undefined leaves, demand, proof trees, corpus speed | `node worklog/kernel-trials/probe/run-probes.mjs` | native-count mode (K1 demand walk from `call_delays` alone fails) | yes |
| Round 2 conformance, witnesses | the kernel matches the model on every §9 gate | `node worklog/kernel-trials/probe/run-conformance.mjs` | `core.pl` mutated: require violated under `u` forall (1 witness flips); forall-only demand (12 flip) | yes |
| Round 2 conformance, corpus + random | the kernel matches the model on real documents and on random programs against brute force | `node worklog/kernel-trials/probe/run-conformance.mjs --corpus --random 200 --d3` | the same mutations: 7/100 and 67/100 random programs flip | yes |
| Reference self-check | the naive reference matches hand derivations and brute force | `node worklog/kernel-trials/probe/reference/run-reference.mjs worklog/kernel-trials/probe/witnesses/*.yaml` and `node worklog/kernel-trials/probe/reference/random-brute.mjs 500 1` | reference mutated: demand without goal leaves (15/200), `not u` read as `t` (76/200) | yes |

## Open items

1. **Convert the random checks to property tests with shrinking** (fast-check or equivalent):
   properties = model §9 gates, generator grammar over the whole language (joins, `choose`,
   `count`, `matches`, `present`, recursion, negative loops), subject pluggable (kernel, reference,
   TypeScript evaluator), coverage line per run, minimal counterexample printed. Owner's question
   of 2026-10-12; round 2 verdict §Findings about the probe method.
2. **Boundary gate** (round 4): a module that reaches the judge, the network, the filesystem or
   the budget without BLOCKED.
3. **Oracle fixtures** (round 3): per-oracle separation and false-pass, the toolkit's own gate.
