# Round 2 results — conformance of S1 (WFS kernel) and S2 (TypeScript evaluator) to the model

Run 2026-10-12 against HEAD `3cfd535` (worktree with the untracked `worklog/kernel-trials/`),
Node v26.10.0, macOS, `swipl-wasm` 8.2.2 embedding SWI-Prolog 10.1.15. Reference: the model
`docs/doc-verify-model.md` as amended 2026-10-12 after review and re-amended after the second
review (§1/§6 `asked(ans)`); witnesses `probe/witnesses/*.yaml` (22 gate witnesses +
`corpus-draft.yaml`), 21 hand-derived by the witness author before either subject ran, plus
`unknown-not-reasked.yaml`, written by the kernel author at the coordinator's request after the
re-amendment, expects derived by hand with a reason comment per step. No other witness, and no
model, constitution or preregistration file, was edited by this run.

## Re-run after the second review and the counterexample (re-amended §1/§6)

The model now reads (§1, §6 re-amended twice): an atom answered `unknown` is a `u` leaf for
valuation but **asked** for demand, and an asked atom is, for scheduling, as good as decided: every
policy skips it, and `prefix` takes the first **demandable** leaf of each residual derivation,
falling through past asked ones, so prefix is empty exactly when full is. A binding whose support is
empty after subtracting asked atoms is *unresolvable*: undetermined, demands nothing, NEEDS-REVIEW;
D1 is restricted to resolvable bindings.

Kernel: `core_demand/2` drops asked atoms at the leaf, so `core_first_leaves/4` falls through;
at binding level, prefix walks the forall first and falls through to the goal when the forall has
no demandable leaf (the C4 run caught my first version, which stopped at an all-asked forall:
"prefix empty while full `o1(d,b)` is not"). New finding kinds: `unresolvable` (leaves exist, all
asked) beside `unfounded` (no leaf: negative loop). D3 counts demanded atoms only.

An intermediate instruction (prefix contributes nothing past an asked-unknown leaf) was run first;
the scratch witness `prefix-blocked-by-unknown` showed it gives `prefix(Dem) = ∅` with `Dem = {o2}`,
which §6 forbids, and lets `full` reach NO-GO where `prefix` stops at NEEDS-REVIEW. That witness is
now `witnesses/prefix-unknown-fallthrough.yaml`, with the model's fall-through expects.

```
node worklog/kernel-trials/probe/run-conformance.mjs                              # exit 0
node worklog/kernel-trials/probe/run-conformance.mjs --corpus --random 200 --d3   # exit 0 (2 runs)
Policy invariance prefix-unknown-fallthrough step 1 S1: ok
Policy invariance prefix-unknown-fallthrough step 2 S1: ok
Policy invariance prefix-unknown-fallthrough step 3 S1: ok
Policy invariance prefix-unknown-fallthrough step 1 S2: ok
Policy invariance prefix-unknown-fallthrough step 2 S2: MISMATCH missing.c1: expected [{"D":"d","S":"a","literal":"w::o2(d,a)","path":["w::ok(d,a)#1"]}] got [{"D":"d","S":"a","literal":"w::ok(d,a)"}]
Policy invariance prefix-unknown-fallthrough step 3 S2: ok
D1 unknown-not-reasked steps 1-3 S1: ok; S2: ok
random (C4) S1: programs 200, seed 1, counterexamples 0, conservative undetermined 106,
  resolvable-at-ans but unresolvable-after-Dem (model D1 gap) 14
```

S2's step-2 mismatch is the §7 descent (model moved beyond design 04); its demand agrees.

**Open model gap (D1), measured by C4: 14 of 200 programs.** "Resolvable" is decided at `ans`, but
a binding whose support mixes a demandable atom and an asked-unknown one is resolvable at `ans` and
not decided by answering `Dem`: e.g. forall `section(d,S,_), o1(d,S)` with `o1(d,b)` unanswered and
goal `not o2(d,b)` with `o2(d,b)` = unknown. Dem = {o1(d,b)}; answering `holds` leaves the binding
undetermined (now unresolvable). C4 counts these separately (an undetermined binding left after
answering Dem must be unresolvable or unfounded in the resulting state; otherwise it is a
counterexample, and there are none). The model's D1 should read "decides every binding that was
undetermined, or makes it unresolvable", or define resolvable as "no asked-unknown atom in its
residual leaves".

## Files

- `probe/kernel2/core.pl` — the kernel core (each part names its model section).
- `probe/kernel2/translate.mjs` — witness/module → Prolog text (mechanical; naming and literal rules in its header).
- `probe/kernel2/kernel.mjs` — S1 host (swipl-wasm instance, answer state, report parsing, D3 measure).
- `probe/kernel2/subject-ts.mjs` — S2 driver. **Route: direct `evaluate(program, facts, view)`**, not `runProgram`.
- `probe/kernel2/corpus.mjs`, `probe/kernel2/random.mjs` — `--corpus` and `--random N` modes.
- `probe/run-conformance.mjs` — the predicate.
- `probe/witnesses/unknown-not-reasked.yaml` — added at the coordinator's request after the second review.
- `probe/witnesses/prefix-unknown-fallthrough.yaml` — promoted from my scratch witness at the coordinator's request.
- `probe/kernel2/scratch/*.yaml` — six scratch witnesses written while the witness set was not yet there (my derivations; informational).

## Commands

```sh
cd <repo-root>
node worklog/kernel-trials/probe/run-conformance.mjs                                  # the predicate; exit 0 (3 runs)
node worklog/kernel-trials/probe/run-conformance.mjs --corpus --random 200 --d3       # exit 0; corpus, C4, D3
node worklog/kernel-trials/probe/run-conformance.mjs --count=naive                    # interval count un-encoded (before)
node worklog/kernel-trials/probe/run-conformance.mjs --incremental                    # tables kept across steps (exit 1, F15)
node worklog/kernel-trials/probe/run-conformance.mjs --dir=kernel2/scratch            # scratch witnesses
KERNEL2_CORE=/tmp/kp/mutA.pl node worklog/kernel-trials/probe/run-conformance.mjs --random 100   # seeded defects (below)
```

## Summary

| Gate | Witness | S1 | S2 |
| --- | --- | --- | --- |
| Status table | choose-negated | pass | FAIL |
| D1 | d1-complete | pass | FAIL |
| D2 | d2-minimal | pass | expected-failure |
| Status table | example-status-table | pass | FAIL |
| Status table | forbid-undefined | pass | pass |
| Interval count | interval-count | pass | pass |
| M1 | m1-monotone | pass | FAIL |
| M2 | m2-negative-loop | pass | FAIL |
| M2 | m2-total | pass | FAIL |
| Status table | matches-bound-interval | pass | FAIL |
| Missing literal | missing-literal | pass | FAIL |
| Status table | nonempty-population | pass | FAIL |
| D3 | overdemand-o-not-o | pass | FAIL |
| PASS is final | pass-is-final-open | pass | FAIL |
| PASS is final | pass-is-final | pass | FAIL |
| Policy invariance | policy-invariance | pass | FAIL |
| Status table | present-candidates | pass | pass |
| Static checks | static-matches-unbound | pass | pass |
| Static checks | static-nonground-not | pass | pass |
| Status table | status-b-undefined-open | pass | pass |
| Status table | status-b-undefined | pass | FAIL |
| D1 (§1 asked(ans)) | unknown-not-reasked | pass | pass |
| Policy invariance | prefix-unknown-fallthrough | pass | FAIL (§7 descent only) |
| corpus | corpus-draft (24 documents, draft profile, no answers) | pass | pass |
| Brute force (C4) | random ×200, seed 1 (re-amended checks) | pass (0 counterexamples) | not run |
| Boundary | — | not measured | not measured |

**S1: no unexpected mismatch; the predicate exits 0.** No `unexpected-pass` was printed.
`EXPECTED_FAILURES` now holds only S2 `d2-minimal` (preregistration amendment); S1
`interval-count` was removed once the count encoding was in place (it is re-added by
`--count=naive`, see below).

F9 delay-order self-test (printed by every run): `most_recent_first((core_u(selftest_second),core_u(selftest_first)))`.

### Interval count, before and after the encoding

Before (`--count=naive`: `count` as `aggregate_all` over the goal, delays ignored, the engine's
native behaviour):

```
Interval count interval-count step 1 S1: expected-failure statuses.ge2: expected [{"D":"d","status":"undetermined"}] got [{"D":"d","status":"satisfied"}]
Interval count interval-count step 1 S1: expected-failure statuses.eq1: expected [{"D":"d","status":"undetermined"}] got [{"D":"d","status":"violated"}]
Interval count interval-count step 1 S1: expected-failure demand.full: expected ["w::o(d,b)"] got []
Interval count interval-count step 1 S1: expected-failure demand.prefix: expected ["w::o(d,b)"] got []
Interval count interval-count step 1 S1: expected-failure missing.lt1: expected [{"D":"d","literal":"1..2<1"}] got [{"D":"d","literal":"2<1",...}]
Interval count interval-count step 1 S1: expected-failure missing.eq1: expected [] got [{"D":"d","literal":"2=:=1",...}]
Status table matches-bound-interval step 1 S1: MISMATCH statuses.two: expected [{"D":"d","status":"undetermined"}] got [{"D":"d","status":"satisfied"}]
Status table matches-bound-interval step 1 S1: MISMATCH demand.full: expected [k(d,a),k(d,b),o(d,a),o(d,b)] got ["w::k(d,a)","w::k(d,b)"]
Status table matches-bound-interval step 1 S1: MISMATCH demand.prefix: (same)
```

The u tuple is counted as true (N = 2, not [1, 2]): `ge2` comes out satisfied and `eq1` violated,
both **unsound** (a completion with `o(d,b)` = fails decides them the other way), and nothing is
demanded. The preregistration expected this gate to fail; it did not anticipate that
`matches-bound-interval` (a `count` feeding `matches`) fails for the same reason, so the
expected-failure entry under-stated the blast radius by one witness.

After (`core_count/3`: two queries over the delays of a tabled count goal, `core_iv(C, P, UGoals)`
compared by `core_cmp/3`, an undetermined comparison made `u` through `G ∧ ¬G` over the
undetermined instances so their leaves reach the residual program): both steps of
`interval-count` pass, including demand `{o(d,b)}` and the missing literal `1..2<1`;
`matches-bound-interval` passes.

### S2 results (informational)

**S2's failures are measured against the AMENDED model**, not against design 04. Split of the 14
failing witnesses, which the verdict needs:

| Witness | Kind | Why |
| --- | --- | --- |
| choose-negated | model moved beyond design 04 | §7 descent (path, label literal) |
| d1-complete | model moved beyond design 04 | §7 descent |
| example-status-table | model moved beyond design 04 | §7 descent |
| m1-monotone | model moved beyond design 04 | §7 descent |
| m2-negative-loop | model moved beyond design 04 | design 04's checker refuses unstratified programs |
| m2-total | model moved beyond design 04 | §7 descent |
| matches-bound-interval | model moved beyond design 04 (text only) | §7 literal text: operands unquoted; the literal is the right one |
| nonempty-population | model moved beyond design 04 | §4 population row; step 2 demand follows design 04's conservative table (B = u never satisfied) |
| overdemand-o-not-o | model moved beyond design 04 | §7 descent |
| pass-is-final-open | model moved beyond design 04 | §7 descent |
| policy-invariance | model moved beyond design 04 | §7 descent |
| status-b-undefined | model moved beyond design 04 | §4 amended table: a B = u binding with goal t is satisfied, design 04 keeps it undetermined and demands its forall atom |
| d2-minimal | **genuine over-demand under design 04's own rules** | demands `r(d,a)`, the other disjunct of an `ok` already t via `o` (registered) |
| pass-is-final | **genuine over-demand under design 04's own rules** | step 1 demands `r(d,a)` though `ok(d,a)` is already t and the binding satisfied |
| missing-literal | **genuine over-demand** (plus §7 descent, model moved) | demands `r(d,a)` in `u-first` whose instance is already f through `o(d,a) = fails` |

So 11 failures are the model moving past design 04 (descent, status-table rows, population row,
loop refusal; one of them text only), and 3 witnesses show over-demand that design 04's own
"`settled` prefix over every possible instance" rule produces: an atom no labelling of which can
change any status is asked.

S2 = `evaluate()` of design 04, compiled by its own `compileModule` (checker included).
27 mismatch lines across 14 witnesses, falling into five kinds:

1. **No descent in the missing literal (§7 amended).** S2 reports the first goal literal that is not
   possible (the derived atom itself) with no clause path and no passed-`u` list:
   `choose-negated` (pos/neg/lab, both steps), `d1-complete` 2, `example-status-table` 1,
   `m1-monotone` 1–2, `m2-total` 1, `overdemand-o-not-o` 2–3, `pass-is-final-open` 2,
   `policy-invariance` 3, `missing-literal` 1 (`derived`, `u-first`). E.g.
   `expected [{"D":"d","S":"b","literal":"w::o(d,b)","path":["w::ok(d,b)#1"]}] got [{"D":"d","S":"b","literal":"w::ok(d,b)"}]`.
2. **Demand beyond the support (the prefix `settled` rule, §6).**
   `d2-minimal` 1 (registered: `["w::r(d,a)","w::w(d,a)"]` vs `["w::w(d,a)"]`),
   `pass-is-final` 1 (`["w::r(d,a)"]` vs `[]`), `missing-literal` 1 (`["w::r(d,a)"]` vs `[]`),
   `status-b-undefined` 1 (`["w::o(d,a)"]` vs `[]`: it demands the forall atom of a binding already
   satisfied by its goal, the pre-amendment table), `nonempty-population` 2 (`["w::o(d,b)"]` vs `[]`).
3. **No population row for a nonempty constraint whose bindings are all `B = u` (§4 amended).**
   `nonempty-population` 1: no `{population: undetermined}` row and verdict PASS where the model
   says NEEDS-REVIEW.
4. **Checker refuses an unstratified program.** `m2-negative-loop`: `rejected: "rules.p: negation
   or count over q in the same stratum; ..."` where the model evaluates it (undetermined,
   unfounded).
5. **Text only.** `matches-bound-interval` missing literals: S2 prints `matches(Notes,^Work - )`
   (unquoted operands) for `matches('Notes','^Work - ')`; the literal is the right one.

S2 passes `forbid-undefined`, `interval-count` (statuses, demand and missing literal agree after
normalising `dv_interval(1,2) < 1` to `1..2<1`), `present-candidates`, both static checks (by its
checker's static unsafe-variable refusal, not a when-reached check), `status-b-undefined-open`
and the corpus.

Preregistration expectations for S2 contradicted: M1, M2, PASS is final, Status table, D1 and
Missing literal were expected `pass`; all fail, almost entirely through kinds 1–3, i.e. through
the amended §4/§6/§7 rather than through wrong truth values. D2 was `uncertain`; it failed exactly
as the amendment registered. Interval count `pass`: confirmed.

## Measures

**D3 (model §6, S1, `--d3`)**: share of demanded atoms for which some single labelling changes some
status. 1.0 for both policies on every witness step with non-empty demand except
`matches-bound-interval` step 1: 0.5 (relevant `k(d,a)`, `k(d,b)`; `o(d,a)`, `o(d,b)` are not
individually relevant because `matches` on any non-degenerate interval stays `u`).
`overdemand-o-not-o` step 1: D3 = 1 for `o(d,a)` (see Disputed below).

**C4 brute force**: `random.mjs` reuses `reference/random-brute.mjs`'s generator, renderer,
two-valued evaluator and enumerator verbatim (extracted to `kernel2/.gen/brute-lib.mjs`; the source
exports nothing) and applies its checks (sound, cover, verdict, M2, M1, D1, D2, policy) with S1 as
the evaluator. 200 programs, seed 1: 0 counterexamples, 106 undetermined bindings that enumeration
decides (Kleene conservatism, not a failure). S2 not run under C4.

**Seeded defects** (checks counted only once a defect flips them; mutants written to `/tmp`, loaded
via `KERNEL2_CORE`):
- A: `core_status(require, _, f, violated)` (violated without `B = t`): witnesses flip
  (`status-b-undefined-open` step 1, 1 unexpected S1 mismatch) and C4 finds 7/100 counterexamples.
- B: full demand walks only the forall: 12 witnesses flip for S1 and C4 finds 67/100.

**Incremental tables (`--incremental`) — not the shipped mode.** The kernel as measured abolishes
all tables at every answer state (`abolish_all_tables`, the round-1 degraded path); `--incremental`
exists only to measure F15. Design 05's claim of "incremental re-evaluation" between rounds is
therefore replaced, on this evidence, by **"re-evaluation per step: ~1 ms on the corpus"** (round 1
K4 measured `abolish_all_tables` + full re-evaluation at 1.0 ms for 24 documents; here a later
witness step costs 0.1–0.6 ms and a first step 2–10 ms). Keeping tables across answer states: keeping tables across answer states (no
`abolish_all_tables`) gives 6 S1 failures (choose-negated 2, forbid-undefined 2, interval-count 2,
m1-monotone 2, nonempty-population 2–3, status-b-undefined-open 2–3): stale undetermined statuses
after answers arrive, a binding whose forall became f still listed. Cause: F15 below. The
predicate therefore abolishes tables per answer state (the round-1 degraded path); this is the
default S1 configuration and all figures above use it.

## Timings

| Measure | Value |
| --- | --- |
| predicate, process wall (`time -p`), 3 runs | 1.71 s, 1.79 s, 1.74 s (in-process 1451 / 1571 / 1499 ms) |
| S1 instance startup | 75 ms first (cold WASM compile), 21–34 ms later |
| S1 consult core.pl + program | 7–20 ms |
| S1 one step (abolish + evaluate + demand + missing) | 0.5–9.6 ms (first step of a witness 2–10 ms, later steps 0.1–0.6 ms) |
| S2 compile (warm) / one step | 3–10 ms / 0.0–2.6 ms |
| corpus, S1 per document (startup + consult + evaluate) | 30–41 ms, 822 ms for 24 documents |
| C4, 200 programs, S1 | 9.7 s (each program: one instance, ~12 evaluations) |
| full run `--corpus --random 200 --d3` | 12.6 s wall |

## Disputed witnesses

None of the witness `expect` values is disputed: S1 agrees with all of them, and I re-derived
`interval-count`, `overdemand-o-not-o`, `status-b-undefined`, `m2-negative-loop` and
`pass-is-final-open` by hand from the amended model before reading their expects.

One claim from the coordinator's brief (not a witness field) disagrees with the model:
"`overdemand-o-not-o` … D3 for o is 0". By §6 D3 is "the share of demanded atoms for which some
labelling changes some status". Under `ans = ∅` the binding is undetermined; labelling
`o(d,a) = holds` gives `p = t ∧ f = f`, violated; `fails` gives `p = f`, violated. The status
changes, so `o(d,a)` is relevant and D3 = 1; the witness's own steps 2 and 3 show exactly these
violated states. What the over-approximation note in §6 says is that no answer makes `p` *true*,
which is a different statement. S1 reports 1. The witness file carries no D3 field, so this is
not a mismatch.

## Design decisions in the kernel (where the model leaves a choice)

- Negation: `not` over a base fact → `core_naf/1` (ground check, `\+`); over a derived predicate →
  `core_tnot/1` (ground check, `tnot/1`); over an oracle → `core_not_label/2`, negation at the leaf
  (the negation of an undefined leaf is the same undefined leaf), so no `tnot` over an untabled
  wrapper. A `_` inside a negation is rejected when reached (strict §8; no auxiliary projection).
- Static checks (§8) throw `core_rejected(Reason, Goal)` when reached; the host reports `rejected`
  (`nonground_negation: core_child(d,a,_)`, `unbound_matches: matches(_,'^x')`).
- `matches` uses SWI's `re_match/2` (`library(pcre)` is in the build), unanchored like `RegExp.test`.
- Prefix policy: per residual derivation, the first literal in source order whose subtree still
  yields an unlabelled leaf; for a binding, the forall's derivation precedes the goal's.
- `unknown` (re-amended §1/§6): a `u` leaf for valuation, asked for demand: never demanded again;
  `prefix` falls through to the first demandable leaf (also from forall to goal). Results in this
  file are from the final re-run.
- `unfounded` finding (§3 M2): an undetermined binding with empty full support; the atom reported is
  the first literal of its residual body (`w::p(d,a)` for the negative loop).
- The design-04 checker refuses unstratified programs, oracle depth > `rounds`, and statically
  unsafe negations/`matches`; for those modules S1 resolves the parsed terms (`loadModule`, the
  parser) into the same Literal shapes without the checker (`syntaxProgram` in translate.mjs).
  Used by `m2-negative-loop`, `static-nonground-not`, `static-matches-unbound`; every run prints a note.

## Friction

- F1 (recurred): the Node entry `dist/swipl-node.js` is still required by path.
- F2 (recurred): CommonJS only; `createRequire` from ESM.
- F3 (recurred): npm 8.2.2 ships SWI-Prolog 10.1.15.
- F4 (recurred): no load-text API; `FS.writeFile` + `consult/1` (core.pl and the program concatenated into one file so dynamic declarations are shared).
- F5 (recurred): results read back via `format(atom(..), '~q'|'~w', ..)`; the report is a `\x1f`-separated text block.
- F8 (recurred): `call_delays/2` on `core_goal/2` returns the goal itself; demand is the residual-program walk.
- F9 (recurred, now pinned): delays most-recent-first; `core_selftest_order/1` asserts it every run.
- F10 (recurred): walk stops when an unconditional answer exists.
- F12 (generalised, see F15).
- F13 (recurred): `tnot/1` and `\+` accept non-ground goals; the kernel's ground checks implement §8.
- F15 (new, possible engine defect): under incremental tabling, after `assertz` into the incremental dynamic `core_answered/2`, `call_delays/2` keeps reporting a stale conditional answer for a tabled predicate that depends on another tabled predicate (`aux(X) :- q(X)`, both tabled incremental, no tabled wrapper): `call_delays(aux(X), D)` gives `a-aux(a)` while `call_residual_program(aux(X), P)` gives `(aux(a) :- true)`; a tabled predicate that aggregates (`findall`) over an incremental table is not invalidated at all. Reproduced on 6 witnesses with `--incremental`; workaround `abolish_all_tables` per answer state (≤ 10 ms per step here), which is the shipped mode: design 05's "incremental re-evaluation" becomes "re-evaluation per step, ~1 ms on the corpus".
- F16 (new): a residual program merges several derivations of one atom into one clause with a disjunctive body (`ok(d,a) :- u(r) ; u(o)`); undocumented; the demand walk splits `;` (before the fix S1 demanded nothing for a two-clause `u` atom).
- F17 (new, engine = doc-verify): `compileModule` cannot be used "for syntax only": its checker refuses unstratified negation, oracle depth > `rounds` and statically unsafe negation/`matches`, all of which the model allows or makes a when-reached check; worked around with `loadModule` plus a 40-line resolver.
- F18 (new, engine): `aggregate_all/3` and `findall/3` over a tabled goal ignore delays (a conditional answer counts as true); the naive count is unsound (interval-count before encoding). Known in round 1, not numbered there.
- F19 (new, probe-level): `reference/random-brute.mjs` exports nothing; its generator was reused by extracting its source text before the main loop into a generated module.
- F20 (new, witness format, since fixed by the witness author): FORMAT.md's example and `example-status-table.yaml` first wrote `{ask: q, evidence: core.own(D, S)}` in a YAML flow mapping, which splits at the comma; translate.mjs keeps a mechanical quoting repair as a fallback (no current witness needs it).
- F7: not hit (`style_check(-singleton)`/`-discontiguous` set in the generated program, pre-empting the `_V_` singleton-marked-variable warnings; not observed either way).
- F14: not hit.

## Left unmeasured

Boundary gate, `library(sandbox)`, inference budget `B`, round cap `R`; scheduler cost per policy
beyond D3; S2 under C4; the corpus under a scripted judge (no such witness step present).
