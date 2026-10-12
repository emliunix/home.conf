# Round 1 results — C1 `swipl-wasm` 8.2.2 under Node 26

Run 2026-10-12 against HEAD `3cfd535` (worktree with the untracked `worklog/kernel-trials/`), Node
v26.10.0, macOS. The npm package is `swipl-wasm` 8.2.2; the SWI-Prolog it embeds reports
`version` 100115 (**10.1.15**). Native `swipl` is not installed, so C2 did not run.

## Command

```sh
cd <repo-root>
node worklog/kernel-trials/probe/run-probes.mjs     # exit 0
```

Files: `probe/run-probes.mjs`, `probe/prolog/k1-delays.pl`, `k2-incremental.pl`, `k3-proof.pl`,
`k4-corpus-rules.pl`; K4 reads `probe/prolog/corpus-facts.pl` (exported by `probe/export-facts.mjs`,
1509 fact clauses, 24 documents).

Loading mechanism that worked: `createRequire(import.meta.url)` then
`require("./vendor/node_modules/swipl-wasm/dist/swipl-node.js")` (CommonJS wrapper that locates
`swipl-web.data`), `await SWIPL({arguments: ["-q"]})`, `swipl.FS.writeFile("/x.pl", text)` and
`swipl.prolog.query("consult('/x.pl')").once()`. Results are read back by formatting with `~q`
into an atom (`format(atom(Out), '~q', [R])`) and reading `.Out` from the bindings object. One
fresh instance per condition.

## Verdict per condition

| Condition | Result | Observed |
| --- | --- | --- |
| K1 undefined + delays | **pass** (with the deviations below) | `ok(a)`, `violated(c1)` undefined; prefix demand `[o1(a)]`, `o2(a)` excluded; `ok2(a)` true demands `[]`; holds / fails / unknown and choose (positive and `tnot`) all as expected |
| K2 incremental | **pass** (full, not degraded) | without abolishing: `ok_i(a)` undefined→true, `violated_i(c1)` undefined→false; `ok_i(b)` undefined→false, `violated_i(c2)` undefined→true; control without `incremental` stays undefined (stale) until `abolish_all_tables` |
| K3 proof tree / missing | **pass** | `node(...)` trees with `fact(F)` and `oracle(purpose(d1,goal),goal)` leaves; `missing(goal_section(d2,_))`, `missing(heading(d2,intro,'Goal'))`, `missing(purpose(d3,goal,goal))` |
| K4 corpus scale | **pass** | evaluation 2.1–4.8 ms (cold tables); total 46–53 ms with a warm WASM module, ~105 ms worst case with the cold first instance (82 ms) |

All four `complete: true` lines printed; the hypothesis is not refuted for C1 on this round's
predicates. Three consecutive runs agreed (process wall time 0.37–0.40 s including Node start).

## Timings (three runs)

| Measure | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| first instance startup (cold WASM compile) | 82.1 ms | 64.6 ms | 69.3 ms |
| later instance startup (K4's instance) | 26.3 ms | 26.9 ms | 30.9 ms |
| consult corpus facts (1509 clauses) | 16.3 ms | 15.5 ms | 15.4 ms |
| consult K4 rules | 2.0 ms | 1.8 ms | 1.7 ms |
| evaluate all 14 constraints × all docs, cold tables | 4.2 ms | 2.1 ms | 2.3 ms |
| second pass (design scope, warm tables) | 0.5 ms | 0.5 ms | 0.5 ms |
| `abolish_all_tables` + full re-evaluation (degraded-path round) | 1.0 ms | 1.0 ms | 1.0 ms |
| K4 total as printed (K4 instance startup + consult + eval) | 48.9 ms | 46.2 ms | 50.3 ms |
| K2 re-query after `assertz` (incremental re-evaluation) | 0.4 ms | — | — |

The printed K4 "startup" is the fourth instance in the process, which reuses the compiled WASM
module; a CLI that starts one instance pays the first-instance figure (65–82 ms), giving a total
of roughly 100–105 ms. Both are far inside the 1000 ms / 2000 ms thresholds and the 500 ms
degraded-round threshold.

## K4 per-constraint counts (satisfied, violated, undefined over distinct forall bindings)

Two scopes: *all* applies every constraint of the three modules to all 24 exported documents
(what the task literally asked); *design* restricts to the documents `.doc-verify.yaml` binds to
these modules (`artifact_kind: design`, 4 documents). Only the design scope is comparable with the
TypeScript checker; in the all scope the module-* docs, goals and the receipt fail
`artifact-has-status` / `artifact-has-goal` / the vocabulary because they are governed by other
modules.

| Constraint | profile | all | design | TS checker `--profile draft` (design docs, population / status) |
| --- | --- | --- | --- | --- |
| references-resolve | all | 12,0,0 | 0,0,0 | 0 / satisfied ×4 |
| paths-resolve | all | 59,3,0 | 29,3,0 | 6+22+2+2 = 32; violated on design/02 only |
| specs-resolve | all | 0,0,0 | 0,0,0 | 0 / satisfied |
| spec-paths-resolve | all | 0,0,0 | 0,0,0 | 0 / satisfied |
| artifact-has-status | all | 7,17,0 | 4,0,0 | 1 / satisfied ×4 |
| artifact-status-in-vocabulary | all | 4,3,0 | 4,0,0 | 1 / satisfied ×4 |
| artifact-has-goal | all | 7,17,0 | 4,0,0 | 1 / satisfied ×4 |
| design-has-problem-statement | all | 4,0,0 | 4,0,0 | 1 / satisfied ×4 |
| design-has-rationale | all | 4,0,0 | 4,0,0 | 1 / satisfied ×4 |
| design-has-review | all | 4,0,0 | 4,0,0 | 1 / satisfied ×4 |
| design-has-status-section | all | 4,0,0 | 4,0,0 | 1 / satisfied ×4 |
| design-status-is-one-word | all | 4,0,0 | 4,0,0 | 1 / satisfied ×4 |
| design-problem-resolved | promotion | 0,0,4 | 0,0,4 | not run under draft |
| design-verification-falsifies | promotion | 0,0,3 | 0,0,3 | not run under draft |

The three violated `paths-resolve` bindings are all in design/02 (`doc-verify/contracts/`,
`jev-prompts/jev.py`, `doc-verify/tests/expected/`), and the TS checker also reports
`paths-resolve` violated for design/02 only (a warning; the document verdict is PASS). The
comparison is structural and by eye: I ran `node doc-verify/dist/cli.js check --all --profile
draft --format json` once (1.6 s wall) and read the per-constraint population/status from each
design artifact's `engine.text`; populations agree (32 = 29 + 3). design/03's extra module
`design-03.yaml` was not translated. Verdict equivalence is round 2's question.

## Deviations from the preregistration

1. **`call_delays/2` does not name the oracle atom for a negated or tabled constraint.**
   `call_delays(violated(c1), D)` gives `D = tnot(ok_t(a))`; for a tabled goal it gives the goal
   itself (e.g. `D = ok(a)`). It names the leaves only through non-tabled positive rules
   (`call_delays(ok(a), D)` → `u(o2(a)),u(o1(a))`). The original K1 wording ("must name the oracle
   atom in D") fails literally; the amended K1 (demand set by a transitive walk of the residual
   program) passes. Printed as `[info] ... names o1(a) directly: false`.
2. **The prefix rule is not native.** WFS delays every unknown in a conjunction: the full
   residual walk of `ok(a)` gives `[o1(a), o2(a)]`. The prefix demand `[o1(a)]` comes from walking
   only the first source-order literal of each residual clause body. That depends on an observed
   (undocumented, as far as I know) ordering: SWI lists delayed literals **most recent first**, so
   the first source literal is the *last* element. The walk is our code, ~20 lines in
   `k1-delays.pl`.
3. **A disjunct already true still has conditional answers.** `findall(D, call_delays(ok2(a), D), L)`
   gives `[true, u(o3(a))]`; the demand walk must short-circuit when an unconditional answer exists,
   otherwise it demands `o3(a)`. With the short-circuit, `ok2(a)` demands `[]`. Note `u(o3(a))` was
   still tabled (explored), only not demanded.
4. **Choose oracle encoding has no mutual exclusion.** One undefined atom per label means the WFS
   does not know that `label(k(a),x)` and `label(k(a),y)` cannot both hold; fine for the tests run
   (each literal's truth is right in all three states), but a rule needing exclusivity would be
   weaker than the current evaluator.
5. **`tnot/1` over a non-ground goal does not flounder or raise.** `tnot(has_fact(_))` fails
   (an answer exists), `tnot(ok_t(_))` succeeds conditionally with delay `tnot(ok_t(_))`: it
   behaves as existential negation (`\+ ∃X`). No error text to record. The finiteness/groundness
   check must therefore be ours (invariant 5), not the engine's.
6. **K2 works only with an untabled oracle wrapper.** With `oracle/1` itself tabled
   incremental (`*_t` in `k2-incremental.pl`), after `assertz(answered_t(o(a), holds))` in a fresh
   instance, `call_delays(ok_t(a), D)` keeps returning the stale `D = ok_t(a)` (undefined) while
   `call_residual_program/2` gives `[(ok_t(a):-true)]` and `tnot(ok_t(a))` / `violated_t(c1)` is
   correctly false. When the same query ran after other tables in the same instance had been
   touched, `call_delays` reported `true`. The probe's K2 pass uses the untabled wrapper, where
   `call_delays` and the residual program agree; the tabled-wrapper anomaly is recorded, not fixed.
   It could not be checked against native SWI (C2 not installed).
7. **The encoding is a transformation** (as the amendment says): `u(A) :- tnot(u(A))` under
   `:- table u/1`, and `oracle(A) :- answered(A, holds). oracle(A) :- \+ answered(A, holds),
   \+ answered(A, fails), u(A).` (`listing/1` prints the table directive as `:- table u/1 as
   variant.`). Author rules (`top/2`, `goal_section/2`, ...) were translated without change.
8. **K3 `missing` binding policy is ours.** The first failing literal is reported with the
   forall binding plus the prefix's binding only when the prefix has exactly one solution
   (`heading(d2,intro,'Goal')`, `purpose(d3,goal,goal)`); otherwise unbound
   (`goal_section(d2,_)`). The harness and this policy were iterated during development before
   the recorded runs (the pre-fix version printed `missing(purpose(d3,_,goal))`); the recorded
   runs are the first full runs after that.
9. **K4 startup** printed by the runner is a warm-module instance; see Timings for the cold figure.

## Friction (one line each; to file as issues)

- `swipl-wasm` package `main` is `dist/index.js`, which loads the single-file *bundle*; the Node wrapper that finds `swipl-web.data` is `dist/swipl-node.js`, not documented in the README.
- The package is CommonJS only (no `exports`); ESM callers need `createRequire` (did not try a bare `import` of `dist/swipl/swipl.js`).
- The npm version (8.2.2) differs from the embedded SWI-Prolog version (10.1.15); nothing in the README says which SWI it ships.
- No documented "load source text" API: `load_string` exists on the Prolog object in `swipl.js` but is untyped; writing to `swipl.FS` and `consult/1` worked.
- `query(...).once()` returns a bindings object with `$tag`/`success`; a failed goal returns `{success:false}` rather than `false`, and compound terms come back as JS objects, so every probe formats with `~q` into an atom to read results.
- Library sources are shipped only as `.qlf` (e.g. `library(wfs)`), so `call_delays/2` cannot be inspected in the build.
- `current_table(u(A), T)` with a partially bound pattern returned nothing; `current_table(V, T), V = u(A)` works.
- `call_delays/2` on a tabled goal returns the goal itself as the delay, not its leaves; the leaves need `call_residual_program/2` / `delays_residual_program/2`.
- Delayed literals are listed most-recent-first (reverse source order).
- `call_residual_program/2` returns `[]` for a plain unconditional answer, but `[(G:-true)]` for an answer that became unconditional by incremental re-evaluation.
- `call_delays/2` reports a stale conditional delay after incremental re-evaluation when the oracle wrapper is tabled (see deviation 6); `tnot` and the residual program are correct.
- `tnot/1` accepts non-ground goals silently (existential negation), no floundering error.
- Consult warnings (discontiguous clauses) are printed to the Node console, not returned to the caller.
- `library(sandbox)` is present as `sandbox.qlf` (not exercised; round 2).

## Full output (run 1)

```
== K1 undefined + delays (k1-delays.pl)
  (instance startup 82.1 ms)
  encoding of an unanswered atom: ":- table u/1 as variant. u(A) :- tnot(u(A)). oracle(A) :- answered(A, holds). oracle(A) :- \\+ answered(A, holds), \\+ answered(A, fails), u(A). "
  [ok] no answers: ok(a): undefined
  [ok] no answers: violated(c1): undefined
  call_delays(ok(a), D):          D = u(o2(a)),u(o1(a))
  call_delays(violated(c1), D):   D = tnot(ok_t(a))
  call_residual_program(violated(c1), P): P = [(ok_t(a):-u(o2(a)),u(o1(a))),(u(o2(a)):-tnot(u(o2(a)))),(u(o1(a)):-tnot(u(o1(a))))]
  [info] call_delays(violated(c1)) names o1(a) directly: false
  demand walk (full residual leaves) violated(c1): [o1(a),o2(a)]
  [ok] demand walk (prefix) violated(c1) = [o1(a)], excludes o2(a): [o1(a)]
  demand walk (full) ok(a): [o1(a),o2(a)]
  [ok] demand walk (prefix) ok(a) = [o1(a)]: [o1(a)]
  naive findall over call_delays(ok2(a), D): [true,u(o3(a))]
  [ok] disjunct already true: ok2(a) true, demands nothing: [true,[]]
  u/1 subgoals tabled so far: [o1(a),o2(a),o3(a)]
  [ok] o1(a) holds: ok(a) still undefined, demand moves to [o2(a)]: undefined-[o2(a)]
  [ok] o1,o2 hold: call_delays(ok(a),D) D == true; violated(c1) false: true-false
  [ok] o1(a) fails: ok(a) false; violated(c1) true with D == true: false-true
  [ok] o1(a) unknown: ok(a) undefined, still demands o1(a): undefined-[o1(a)]
  [ok] choose unanswered: is_x(a), not_y(a) undefined; demand label x / label y: [undefined,undefined,[label(k(a),x)],[label(k(a),y)]]
  [ok] choose answered x: is_x(a) true, not_y(a) true: [true,true]
  [ok] choose answered y: is_x(a) false, not_y(a) false: [false,false]
  (d) tnot(ok_t(_)) non-ground, conditional answers exist: succeeded(tnot(ok_t(_3928)))
  (d) tnot(has_fact(_)) non-ground, fact(a) exists:         failed
  K1 complete: true
== K2 incremental tabling (k2-incremental.pl)
  (instance startup 29.5 ms)
  [ok] round 1 (incremental): ok_i(a), violated_i(c1) undefined: [undefined,undefined,undefined]
  [ok] round 1 (incremental): ok_i(b), violated_i(c2) undefined: [undefined,undefined]
  round 1 control (plain tables): [undefined,undefined,undefined]
  [ok] after assertz, no abolish: ok_i(a) undefined->true, violated_i(c1) ->false: [true,false,true]
  [ok] after assertz, no abolish: ok_i(b) undefined->false, violated_i(c2) ->true: [false,true]
  [ok] negative control (no incremental): stale tables persist (still undefined): [undefined,undefined,undefined]
  negative control after abolish_all_tables: ok_s(a) = true
  variant with tabled oracle wrapper [tv(ok), tv(violated), rtv(ok)], same instance: before [undefined,undefined,undefined], after [true,false,true]
  re-query time after assertz (incremental re-evaluation): 0.4 ms
  (instance startup 25.8 ms)
  [info] tabled-oracle variant isolated: before tv(ok_t(a)) = undefined; after assertz [call_delays D, residual program, tv(violated_t(c1))] = [ok_t(a),[(ok_t(a):-true)],false]
  K2 complete: true
== K3 proof tree and missing literal (k3-proof.pl)
  (instance startup 24.5 ms)
  [ok] artifact-has-goal d1: node(goal_section(d1,goal),[node(top(d1,goal),[fact(section(d1,goal,root)),fact(depth(d1,goal,2))]),fact(heading(d1,goal,'Goal'))])
  [ok] artifact-has-goal d2: missing(goal_section(d2,_86))
  [ok] goal-has-purpose d1: node((top(d1,goal),heading(d1,goal,'Goal'),purpose(d1,goal,goal)),[node(top(d1,goal),[fact(section(d1,goal,root)),fact(depth(d1,goal,2))]),fact(heading(d1,goal,'Goal')),oracle(purpose(d1,goal),goal)])
  [ok] goal-has-purpose d2: missing(heading(d2,intro,'Goal'))
  [ok] goal-has-purpose d3: missing(purpose(d3,goal,goal))
  K3 complete: true
== K4 corpus scale (corpus-facts.pl + k4-corpus-rules.pl)
  (instance startup 26.3 ms)
  version: 100115  ('10.1.15')
  flags: [answer_write_options=[quoted(true),portray(true),max_depth(10),spacing(next_argument)],executable=swipl,max_answers_for_subgoal_action=error,max_table_answer_size_action=error,max_table_subgoal_size_action=error,portable_vmi=true,table_incremental=false,table_monotonic=eager,table_shared=false,table_space=1073741824,table_subsumptive=false,toplevel_list_wfs_residual_program=true,unknown=error,unknown_option=ignore]
  facts: 1509 clauses, documents: 24
  per constraint, scope all documents (name-profile-counts(satisfied,violated,undefined)):
    'references-resolve'-all-counts(12,0,0)
    'paths-resolve'-all-counts(59,3,0)
    'specs-resolve'-all-counts(0,0,0)
    'spec-paths-resolve'-all-counts(0,0,0)
    'artifact-has-status'-all-counts(7,17,0)
    'artifact-status-in-vocabulary'-all-counts(4,3,0)
    'artifact-has-goal'-all-counts(7,17,0)
    'design-has-problem-statement'-all-counts(4,0,0)
    'design-has-rationale'-all-counts(4,0,0)
    'design-has-review'-all-counts(4,0,0)
    'design-has-status-section'-all-counts(4,0,0)
    'design-status-is-one-word'-all-counts(4,0,0)
    'design-problem-resolved'-promotion-counts(0,0,4)
    'design-verification-falsifies'-promotion-counts(0,0,3)
  per constraint, scope = documents governed by these modules (kind design):
    'references-resolve'-all-counts(0,0,0)
    'paths-resolve'-all-counts(29,3,0)
    'specs-resolve'-all-counts(0,0,0)
    'spec-paths-resolve'-all-counts(0,0,0)
    'artifact-has-status'-all-counts(4,0,0)
    'artifact-status-in-vocabulary'-all-counts(4,0,0)
    'artifact-has-goal'-all-counts(4,0,0)
    'design-has-problem-statement'-all-counts(4,0,0)
    'design-has-rationale'-all-counts(4,0,0)
    'design-has-review'-all-counts(4,0,0)
    'design-has-status-section'-all-counts(4,0,0)
    'design-status-is-one-word'-all-counts(4,0,0)
    'design-problem-resolved'-promotion-counts(0,0,4)
    'design-verification-falsifies'-promotion-counts(0,0,3)
  violated bindings (design scope): ['paths-resolve'-ref('design/02-programmatic-document-contract-verification.md','implementation-ownership','doc-verify/contracts/',path),'paths-resolve'-ref('design/02-programmatic-document-contract-verification.md','implementation-ownership','jev-prompts/jev.py',path),'paths-resolve'-ref('design/02-programmatic-document-contract-verification.md','verification-design','doc-verify/tests/expected/',path)]
  startup 26.3 ms; consult facts 16.3 ms; consult rules 2.0 ms; evaluate all constraints (cold tables) 4.2 ms; second pass, design scope (warm) 0.5 ms; abolish_all_tables + full re-evaluation 1.0 ms; total 48.9 ms
  [ok] evaluation < 1000 ms: 4.2 ms
  [ok] total (startup + consult + evaluation) < 2000 ms: 48.9 ms
  [ok] promotion constraints come back undefined (no oracle answers): see rows above
  degraded-pass path (re-evaluation per round < 500 ms): 1.0 ms
  K4 complete: true
== process wall time 279.4 ms (the first instance pays the WASM compile; later instances reuse it)
== summary
K1 complete: true
K2 complete: true
K3 complete: true
K4 complete: true
```
