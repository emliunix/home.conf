# Round 5 — the trust boundary (and a scheduler measurement track)

Written 2026-10-13 before the run; amended the same day after the independent review
(`results/round-5-review.md`, verbatim) and before the run. Constitution invariant 5: finiteness
and the trust boundary hold by construction; falsifier: a module that reaches the judge, the
network or the filesystem, or runs past the budget, without BLOCKED. Design 05 §Kernel says the
WebAssembly instance is the boundary, `library(sandbox)` and an inference budget give the rest,
and the scheduler policy is declared. None of that was measured on the selected kernel (S1).
Owner direction of 2026-10-13: evaluate and decide autonomously. The claims below are limited to
this build: `swipl-wasm` 8.2.2 embedding SWI-Prolog 10.1.15 under Node 26.

## Build facts (properties of the build, re-verified by the containment track as controls)

No `NODEFS` mount; `library(process)` and `library(http/http_open)` absent; `shell/1` raises
"Function not implemented"; `getenv/2` returns the instance's fake home; `library(sandbox)` loads;
`library(pcre)` enforces a match limit; `call_with_inference_limit/3` works. A `wasm` module
exists with `wasm_call_string/3` (Prolog-from-JS); whether a JS-from-Prolog bridge (`:=/2`,
`js_call`, `js_eval`) is reachable from a loaded program is **not known** and is seed E8.

Prior measurements that are **not predictions** and are re-measured by the committed commands:
`safe_goal/1` accepts translated witness clauses with the kernel primitives declared safe and
rejects a raw `open/3` clause; it rejects `core_report/1` (introspection), so the kernel's own
code is outside the sandbox and trusted by review (a design decision, now in the review gate);
`^(a+)+$` on 26+ `a`s raises `resource_error(match_limit)` in ~240 ms; a cubic loop stops at
2M inferences in 177 ms; `full` = `prefix` demand on 26/26 corpus documents at round 1.

## Hypothesis (the boundary)

With the sandbox gate over every module-derived clause body (T1) and an inference budget around
one evaluation (T2), every seed in the matrix below that a mechanism is predicted to catch is
`rejected` or `BLOCKED` by that mechanism, no seed under any candidate has a host effect, no
real program (23 witnesses with every answered step, 26 corpus documents) is refused or blocked,
and every gate mutation in the table turns its cell red and green again on restoration.
**Refuting cells:** a seed that runs to completion under the candidate predicted to catch it; a
host effect under any candidate; a false refusal or spurious BLOCKED on a real program; a gate
mutation whose cell stays green; an unchecked module-derived predicate in the census.

The scheduler is a **measurement track with no hypothesis and no verdict** (review finding 9).

## Axis

Where the boundary is enforced, with the layers separated: T0 the instance alone; T1 = T0 + the
static gate at load; T2b = T0 + the budget alone (so the budget column is independent); T2 = T1
+ budget. The seeds are classed by the layer they attack (load, evaluation, translator) and by
the mechanism predicted to catch them first; a cell where an earlier mechanism already caught the
seed is marked meaningless for the later one.

## The gate (T1), as amended

After consult, every predicate defined in `user` that `core.pl` does not define (the census: the
oracle wrappers, module rules, `core_forall/2`, `core_goal/2`, `core_aux_*`, and any clause a
translator defect emitted) has each clause body checked with `safe_goal/1`. The kernel's
primitives are declared by their kind, each with its reason:

| Primitive | Kind | Reason |
| --- | --- | --- |
| `core_section/3`, `core_selected/2`, and every other base fact | `safe_primitive` | data |
| `core_label/2`, `core_not_label/2`, `core_choose/3` | `safe_primitive` | read the answer state |
| `core_matches/2`, `core_not_matches/2` | `safe_primitive` | pcre with its own match limit (seed E5) |
| `core_cmp/3` | `safe_primitive` | arithmetic on ground operands |
| `core_naf/1`, `core_tnot/1`, `core_count/3` | **`safe_meta`** (goal argument recursed into) | they call their argument; declared as primitives they would let E9/E10 through |
| `core_present/3` | `safe_primitive` | data |

A directive in the program text (`:- …`, `:- initialization(…)`) runs at consult before any
gate, so the load path refuses program text containing a directive outside `core.pl`
(translated programs never carry one). The declarations are placed after `core.pl` in the
consulted text (they cannot precede the predicates they name).

## Seeds, by layer and by the mechanism predicted to catch them

| Seed | Layer | Payload | Caught first by | T0 | T1 | T2b | T2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 filesystem | evaluation | raw clause `open('/tmp/dv-escape', write, S)` | instance (no host file); gate | ran, no host effect | rejected | ran | rejected |
| E2 process | evaluation | raw clause `shell(...)` | build (unimplemented); gate | error | rejected | error | rejected |
| E3 network | evaluation | raw clause `http_open/3` | build (absent); gate | error | rejected | error | rejected |
| E4 environment | evaluation | raw clause `getenv/2` | instance (fake); gate | ran | rejected | ran | rejected |
| E8 JS bridge | evaluation | raw clause through `library(wasm)` (`:=`, `js_call`, whatever the build exposes) trying `require('fs').writeFileSync('/tmp/dv-escape')` | gate | **unknown**: predicted `error` (no `require` in the module scope), low confidence; a host file here is the headline finding | rejected | as T0 | rejected |
| E9 meta escape | evaluation | raw clause `core_count(V, open(...), N)` | gate, **only with `safe_meta`** | ran | rejected (under the amended declarations; `ran` under `safe_primitive`, which the mutation table shows) | ran | rejected |
| E10 meta escape | evaluation | raw clauses `core_naf(open(...))`, `core_tnot(open(...))` | gate, as E9 | ran | rejected | ran | rejected |
| E13 directive | load | `:- open('/tmp/dv-escape', write, _).` in the program text | load refusal | runs at consult, no host file | rejected at load | runs at consult | rejected at load |
| E14 constraint-goal escape | evaluation | the translator mutated so a `forall` literal becomes `open(...)` (translator track) | gate | ran | rejected | ran | rejected |
| E5 regex | evaluation | `matches(H, '^(a+)+$')` over 30 `a`s (in-language) | pcre, class `resource` | resource | resource | resource | resource |
| E6 count blow-up | evaluation | a 4-way `count` product over the largest corpus document (in-language) | budget | ran (seconds) | ran | **BLOCKED** | BLOCKED |
| E15 untabled loop | evaluation | raw clause `'w::loop' :- 'w::loop'` reached from a constraint | budget | hang (timeout) | hang | BLOCKED | BLOCKED |
| E16 nested count | evaluation | `count` over `count` over a 4-way product (in-language) | budget | ran or hang | same | BLOCKED | BLOCKED |
| E17 catch swallow | evaluation | raw clause `catch(loop, _, true)` | budget, if the wrapper's exception is not catchable by the program | hang | hang | **unknown**: predicted BLOCKED (SWI's limit exception is re-raised past `catch/3`?), low confidence | as T2b |
| E18 expensive builtin | evaluation | raw clause `numlist(1, 20000000, L), length(L, _)` | nothing: single inferences | ran or resource | ran or resource | ran or resource (the budget does not bound this; recorded) | as T2b |
| E19 stack | evaluation | raw clause with deep non-tail recursion (10^7) | instance (resource error) | resource | resource | resource | resource |

Every seed runs in a fresh instance in a child process with a 20 s timeout; a timeout is
recorded as `hang`, never as a pass. Before every seed the host file is removed; after it, its
presence is the host-effect check. Outcome classes: `ran`, `error`, `rejected` (gate or load),
`BLOCKED` (budget), `resource` (instance or library limit), `hang`.

## Controls (each with its expected value)

- Host-effect positive control: the runner writes `/tmp/dv-escape` from the host once and the
  detector must report it (expected: detected), then removes it.
- No false refusal: 23 witnesses, every step with its answers, and 26 corpus documents under T1,
  T2b, T2 give the same statuses, demand, verdict **and findings** (`missing`, `unfounded`) as T0
  (expected: 0 differences).
- Census: unchecked module-derived predicates = 0 (expected: 0), reported as checked / defined.
- Budget boundary: the corpus document needing the most inferences (N) is run at B = N − 1
  (expected: BLOCKED) and at B = N + 1 (expected: ran).
- Overhead: T2b total evaluate time on the corpus within 20% of T0 (expected: within).
- Version: the build's `current_prolog_flag(version)` equals 100115 (expected: equal).

## The budget: derived, not chosen

B = k × (largest corpus evaluation in inferences), k = 20, pre-registered. The scaling probe runs
synthetic documents of 10, 30, 100 and 300 sections under the goal module and records
inferences and wall time per size (prediction: inference count grows linearly in sections for
the shipped modules and B at k = 20 sits above the 300-section document; a BLOCKED there is a
finding about the language's cost). Inferences against wall time are reported per seed, to show
where the proxy fails (E18 is the seed that burns time without inferences).

## Mutation table (R6: each gate shown failing, then restored)

| Gate | Mutation | Cell that must go red |
| --- | --- | --- |
| host-effect detector | detector reads a wrong path | positive control |
| sandbox gate | gate skipped | E1 under T1 runs |
| whitelist | `core_count` declared `safe_primitive` instead of `safe_meta` | E9 under T1 runs |
| whitelist | one base-fact primitive removed | no-false-refusal control names a witness |
| census | `core.pl`'s predicate set widened to include `core_goal` | census reports unchecked > 0 (and E14 runs) |
| directive refusal | refusal skipped | E13 under T1 runs at consult |
| budget wrapper | B = ∞ | E6 under T2b runs |
| budget wrapper | B = 1 | no-spurious-BLOCKED control fails on the corpus |
| scheduler check | `prefix` made to take a leaf outside `Dem` | the invariance check fails |

Each mutation is applied in-process by an option, run, then restored; the run prints red and
green per row. `complete: true` for the round requires every seed run under every candidate
with an outcome class and a host check, the positive control detected, census unchecked = 0,
every control run under every candidate, and every mutation row red then green.

## Scheduler measurement track (no hypothesis, no verdict)

- Round-1 demand on the corpus at promotion with no answers, per policy (re-measured by the
  committed command; the prior probe says 105 = 105 on 26/26, which is a property of these
  documents, not of the policies).
- Random programs (`kernel2/random.mjs`, 200 programs, seed 1) with a simulated judge (fixed
  labels per atom, drawn once): under `full` and `prefix`, rounds until `Dem = ∅` (cap 6),
  final statuses, total atoms asked. Reported: programs where final statuses differ (expected 0,
  M1), total atoms asked per policy, mean rounds per policy.
- Design 05's declared default (`prefix`) stays unless the multi-leaf measure shows `prefix` asks
  more than 20% more atoms in total than `full`, in which case the verdict records the number
  and the design decides later; a tie keeps the default.

## Predicate

```sh
node worklog/kernel-trials/probe/run-boundary.mjs --containment   # T0 seeds, host-effect control, build facts, version
node worklog/kernel-trials/probe/run-boundary.mjs --gate          # T1 seeds, census, false-refusal controls
node worklog/kernel-trials/probe/run-boundary.mjs --budget        # calibration, scaling, T2b/T2 seeds, boundary control, overhead
node worklog/kernel-trials/probe/run-boundary.mjs --mutations     # the mutation table, red then green
node worklog/kernel-trials/probe/run-boundary.mjs --scheduler     # the measurement track
```

Each ends `complete: true|false` for its own track and exits non-zero on a refuting cell.

## Reading

A pass makes invariant 5 *in force* under R6 for the language features the seeds cover (raw
clauses in rule bodies and constraint goals, directives, meta-primitive arguments, regex,
count products, loops); not covered: memory beyond one stack seed, native SWI-Prolog, the
judge-side outbound policy (design 02's, gated elsewhere), and the model §8 static checks
(kernel-side, measured in round 2). A false acceptance (E9/E10 running under T1) is a finding
closed by the `safe_meta` declaration before the gate ships; a false refusal is a finding about
the primitive surface, closed the same way. The gate does not ship while any seed runs under T1.

## Left unmeasured

Native SWI-Prolog; a budget per constraint; the `cheapest-evidence` and `most-pruning` policies;
memory growth beyond E18/E19; the translator's own quoting as a separate gate (every atom is
quoted and every pattern validated as a regex before emission; the raw-clause seeds stand for
any translator defect).

## Review

`results/round-5-review.md`, thirteen findings, "run after amendments". Taken before the run:
1 (Prolog-side census of every module-derived predicate, clause bodies checked, constraint-goal
and aux seeds E14), 2 (`safe_meta` for the three meta-primitives, seeds E9/E10, the primitive
table), 3 (E8 replaced by the JS-bridge seed; judge reach by construction stated), 4 (directive
seed E13 and load refusal; the translator mutation kept only as E14), 5 (layers separated, T2b
added, meaningless cells marked, budget-only seeds E15–E17), 6 (nested count, catch swallow,
stack and expensive-builtin seeds; model §8 static checks named as out of scope), 7 (build facts
and prior measurements separated; open predictions E8, E9/E10, E13, E17, scaling), 8 (B derived
as k × corpus max, scaling probe, inferences against wall time), 9 (scheduler demoted to a
measurement track; random multi-leaf programs; the default stays), 10 (positive host control,
boundary control, findings compared, answered steps, overhead threshold), 11 (five tracks, child
process per seed with timeout, `complete` defined), 12 (the mutation table), 13 (`resource`
class, version pin, sandbox cost split, build-limited claim).
