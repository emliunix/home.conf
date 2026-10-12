# Round 5 plan: independent review (verbatim)

The independent seat (a sonnet subagent) read `round-5-preregistration.md` as first written on
2026-10-13, constitution invariant 5 and R6, model §6 and §8, design 05 §Kernel, the kernel host
and translator, the round 4b review and the seeded-defect-gate skill. It ran nothing and edited
nothing. Its review follows unedited; the plan's `## Review` section records how each finding was
taken.

---

# Review of the round 5 preregistration (trust boundary and scheduler policy)

I read the plan, constitution invariant 5 and R6, model §6 and §8, design 05 §Kernel and the "Trust boundary (round 5)" row, `kernel.mjs`, `translate.mjs`, `core.pl` (`core_count`, `core_matches`, `core_report`), the round 4b review, and the `seeded-defect-gate` skill. I ran nothing and edited nothing. `probe/run-boundary.mjs` does not exist yet, so everything below is judged against `kernel.mjs`, which already contains the T1 and T2 code.

## Findings

**1. The T1 gate as coded does not check the constraint goals, the `count` auxiliaries or the oracle wrappers. The plan says it checks "every module predicate and constraint goal".**
- `Kernel.load` collects heads with a regex over the program text, then drops every head whose name starts with `core_`.
- `translate.mjs` emits constraint goals as `core_forall(id,[..]) :- ..` and `core_goal(id,[..]) :- ..`. It emits `count` goals as `core_aux_k(..) :- ..`. All of these carry the `core_` prefix and are filtered out.
- Constraint bodies hold most of the author's literals: `matches`, `count`, `present`, and any raw clause an escape could ride in.
- The regex `^name\(([^)]*)\)\s*:-` also has these problems:
  - It misses zero-arity heads such as `p :- ..`.
  - It misses heads with a nested compound argument, such as `'w::p'(f(X)) :-`.
  - It splits arguments on commas, so the arity is wrong for a compound argument. `safe_goal` on a wrong-arity goal then says "unknown predicate": a false refusal, or a silent skip.
  - It misses multi-line clauses.
- Why it matters: the seeds are raw clauses "appended to a translated witness program". If a seed is named `core_x`, has arity 0, or is written as a directive or a fact, it is never checked. A green T1 column would then measure the regex, not the sandbox. This is the R6 failure the plan is meant to prevent.
- Amendment:
  - Replace the regex with Prolog-side enumeration. After consult, walk `clause/2` over every predicate in module `user` that is not defined by `core.pl`. Record the core.pl predicate set by loading it first, or tag its predicates. Run `safe_goal` on each clause body, not on a head with fresh arguments.
  - Include `core_forall/2`, `core_goal/2`, `core_aux_*`, the oracle wrappers, and any `core_`-prefixed clause not in core.pl's own set.
  - Add a seed whose escape sits in a constraint goal. For example, mutate `translateProgram` so a `forall` literal becomes `open(...)`.
  - Add a seed whose escape sits in a `core_aux_k` body, in a zero-arity head, and in a nested-argument head.
  - Report the census of checked predicates against the census of defined ones. Zero unchecked is part of `complete`.

**2. Declaring the twelve primitives as `safe_primitive` makes `sandbox` skip their arguments. `core_count/3` calls its second argument, so `core_count(V, open('/tmp/x',write,S), N)` passes T1.**
- `library(sandbox)` treats a `safe_primitive` as a leaf and does not examine its arguments. The right declaration for a meta-predicate is `safe_meta`, or a `meta_predicate` declaration that lets sandbox recurse into the goal argument.
- `core_count(V,G,N)` runs `call_delays(G,D)` or `aggregate_all(count,V,distinct(V,G),N)`. `G` is an arbitrary goal.
- `core_naf/1` and `core_tnot/1` also call their argument (`\+ call(G)`, `tnot(G)`). They are meta-predicates too. `core_choose/3`'s `Labels` argument is data and is fine.
- The plan reports "twelve primitives declared safe" as a fact. It is the weakest point of the boundary, and no seed tests it.
- The plan's pass condition "nothing the module language can express reaches the host" depends on this.
- Amendment:
  - Add primitive-level seeds E9 to E12, raw clauses that use only whitelisted primitives:
    - E9: `core_count(V, open('/tmp/dv-escape',write,_), N)`.
    - E10: `core_naf(open(...))` and `core_tnot(shell(..))`.
    - E11: a `matches` pattern. Test a catastrophic pattern, an invalid pattern, and a very long input. `core_matches` passes its pattern to `re_match/2`, which pcre compiles. The module language can already express this, so it belongs in the "expressible" half of the claim. The match limit is a library default, not a kernel decision. Record the limit value.
    - E12: a `core_count` goal that loops, such as an infinite left-recursive `count` goal or a counted aux that never terminates.
  - Expected result: E9 and E10 are `rejected` only if the declaration is corrected. Predict that the plan's declaration lets them through and that the fix is a `safe_meta`/`meta_predicate` declaration. If the declaration lets them through, that is a finding the round records and closes before the gate ships. The plan already says this for false refusals; it should say it for false acceptances too.
  - Table the twelve primitives by whether they call an argument, touch a regex, or are pure. Each needs a declared reason.

**3. E8 "judge reach" tests nothing. The judge is not in the instance. The real reach channel, the JS bridge, is not seeded.**
- E8 calls a nonexistent `core_judge/2` and expects an existence error. That only shows Prolog does not define a predicate the plan invented. It would be green on any kernel, so it cannot fail.
- The channel the kernel actually shares with the host is the wasm/JS bridge and the answer state (`core_set_answers`, `setAnswers`). Probe these:
  - Does the `swipl-wasm` 8.2.2 build ship `library(wasm)`/`wasm_call_string/3` or an equivalent? That would run JS inside the Node process, which has the host filesystem and network, regardless of the NODEFS absence on the Emscripten FS.
  - Does the `js` or `Module` object reach `require` from inside Prolog?
  - The plan's own table says `library(sandbox)` is not consulted for `swipl.prolog.query`, since the host uses it to drive the kernel.
- Amendment:
  - Replace E8 with a probe of the wasm/JS bridge. Test whether any predicate of the loaded build can call into JS (`wasm_call_string`, `js_eval`, `Module.*`), then attempt a seed that writes a host file through it. Record it as `rejected`, `error` or `ran`, with the host-effect check.
  - Seed the judge-reach claim in its real form: a module `ask:` or `evidence:` string, or an oracle declaration that tries to name a different oracle or an extra input. Show the translator keeps oracle declarations the author wrote and nothing else. Or move E8 to "Left unmeasured" with the reason that the judge is outside the instance by construction. Say which in the plan.
  - Do not keep E8 as a seed. It reports a pass that cannot be earned.

**4. E7's mutation is applied to the translator's `quoteAtom`, which is neither the sandbox's nor the instance's concern. The two layers it is meant to separate are not separated.**
- E7 mutates `quoteAtom` to identity, so the predicate name `x'), open('/tmp/dv-escape', write, _), ('` is spliced into program text.
- That breaks atom quoting in every place `quoteAtom` is used: `kernel.mjs` (`setAnswers`), `translate.mjs`, and `atomTerm`. It is a mutation of the translator, not a translated-text attack. What the translator emits is a Prolog parse of attacker text.
- Under the mutated translator the text is a different program (an `open/3` call appears as a conjunct). T1 rejecting it shows only that `safe_goal` rejects `open/3`, the same fact as E1.
- E7 at T0 should be the interesting cell: does consulting the injected text run `open/3` at load time, as a directive or an immediate clause? A `:- initialization` or directive runs at consult, before any gate. That is a different escape from the clause-body case (see finding 5).
- Also, `readCanonical`/`writeTerm` in the compile step may reject the name earlier, so the seed may never reach the translator mutation. The plan does not say.
- Amendment:
  - Keep the translator mutation as a seeded defect of the translator gate (a separate track, with its own claim), and apply the attack to the translated text. Take a translated witness, textually splice an injection into a predicate name or a string constant, and run T0/T1/T2.
  - Add a directive seed: `:- open('/tmp/dv-escape',write,_).` in the program text, and `:- initialization(...)`. Consult runs these before T1. T1 as designed cannot catch them, because it runs after consult. Either the load path must refuse directives (scan the read terms before executing them, with `read_term` in a sandboxed load) or the plan must list the directive class as contained only by the instance.
  - State which of the three layers each seed attacks (translator, load, evaluation).

**5. The axis conflates three layers, and the table's T0/T1/T2 columns mix them.**
- "Where the boundary is enforced" has three separable claims:
  - Instance containment: no host effect. T0, tested by E1 to E4.
  - Static gate: T1, `safe_goal`.
  - Dynamic budget: T2, `call_with_inference_limit`.
- The seeds do not partition. E5 (regex) and E6 (inference) test resource limits, and so do no static check. E7 tests the translator. E1 to E4 test T0 and T1 together. E8 tests nothing. The table implies each mechanism's seed is separate, but T2 has exactly one cell (E6) where it differs from T1.
- T2 wraps only `core_report`. The budget does not cover consult (so load-time directives and `:- table` setup), `setAnswers`/`abolish_all_tables`, or `core_demand`. Only evaluation is bounded. Invariant 5 says "runs past the budget" for the run; a looping directive or a looping `core_set_answers` goes uncounted.
- Candidates are not independent. T1 and T2 add to T0, so the third column cannot distinguish "T2 catches" from "T1 already caught": every non-E6 cell reads `rejected` at T1 and therefore says nothing about T2.
- Amendment:
  - Make a seed-by-mechanism matrix with one seed per mechanism the seed alone can be caught by, and mark which cells are meaningless. For each seed, name the candidate that is predicted to catch it first.
  - Add budget-only seeds that pass the sandbox: a pure Prolog infinite loop in a whitelisted-only clause (`p :- p.` with tabling off, or a left recursion), a tabled-loop, and exponential `count` nesting. These show the budget catches what the gate cannot. Add static-only seeds that finish within the budget (E1 to E4 as designed).
  - Wrap load and answer-state setup under the budget too, or list them in "Left unmeasured" with the reason.
  - Run a candidate T2-without-T1 (budget only) so the budget column is independent.

**6. The seed set is incomplete for invariant 5's falsifier ("judge, network, filesystem, budget") and for the model §8 static checks.**
- Missing:
  - Judge reach: see finding 3.
  - Network, in the real form: see finding 3. `http_open` is absent from the build, which makes E3 a probe of the build, not of anything the plan adds.
  - The budget in the shapes a module can express: E6 (one blow-up) only. Add `count` over `count` (nested), a recursive predicate with unbounded growth (`p(X) :- p(f(X))`, tabled and untabled), and a long `core_present` list. These are the cases the model §8 means by "runs past the budget".
  - Exceeding the budget inside a `catch/3`: a raw clause `catch(loop,_,true)` could swallow `inference_limit_exceeded`, so the evaluation would finish and T2 would report a normal result. Seed this.
  - Memory and stack growth. The wasm instance has a heap ceiling, and a stack overflow is `resource_error`. E5's mapping already turns `resource_error` into `rejected`, which conflates a budget failure with a static refusal. A stack-blowing seed (deep non-tail recursion, huge `findall`) would show whether the instance dies, throws, or hangs. B bounds inferences, not memory.
  - The static checks model §8 names (groundness of negated goals, `matches` operand bound) are kernel-side and not in this round. Say so.
- Amendment: add the seeds above, or move each to "Left unmeasured" by name with the reason. The invariant lists "runs past the budget without BLOCKED"; a seed is needed for each way an evaluation can end without `BLOCKED`.

**7. Pre-established facts are partly legitimate and partly make the predictions post hoc.**
- Legitimate: the build facts (NODEFS absent, `library(process)` absent, `shell/1` unimplemented, `library(sandbox)` loads). They bound the design and are properties of the build, not of the plan's outcomes. Keep them, and mark them "build facts, re-verified by the runner as controls".
- Not legitimate as predictions:
  - "safe_goal accepts every translated clause of a witness program" and "rejects a raw clause calling `open/3`" are E1 and the false-refusal control, already run. Their "high confidence" rows in Expected outcomes are not predictions.
  - The `match_limit` figure (E5, "about 240 ms") and the 2M-inference figure (177 ms) were measured before the plan. E5 and E6's expectations are the measurements restated.
  - The scheduler row "full = prefix on 26/26, 105 atoms" was measured in the probe and the plan then gives it "high confidence". The measured number is the prediction.
  - The probes also found that sandbox rejects `core_report/1`: so the whitelist's scope was shaped by a failure, which the plan records as "trusted by review". That is a design decision made from data, and it should be in the review gate, not the facts.
- Why it matters: an experiment whose expectation equals the pre-run measurement cannot be wrong, so a pass is unearned in the same sense R6 describes.
- Amendment:
  - Split "Facts established" into build facts, which stay, and prior measurements, which move into the table as "known before the run; the run re-measures with the committed command". Record those rows' confidence as "not a prediction".
  - Put genuinely open predictions with real uncertainty in the table. Candidates: E9 and E10 (finding 2), the directive seed (finding 4), the JS bridge probe (finding 3), E6's T0 inference count, whether the budget wrapper overhead is under a stated percentage.

**8. B = 5M is neither justified nor measured. The calibration is in "Measurements" but the value is already fixed in the hypothesis, the seeds and the expectations.**
- The plan sets B = 5M, expects the corpus maximum under 1M, and expects E6 to exceed 5M. Only the first and last are tested, and both are tuned to each other: E6's size ("60 sections, a 4-way product") is chosen to land above 5M, and the corpus maximum is measured after B is chosen.
- Evidence for 5M: the 177 ms figure is for one cubic loop, which says nothing about how many inferences a realistic large document needs.
- The plan has no cell that would catch a B too tight (false BLOCKED on a bigger real document) or too loose (a hostile module that stays under B but takes minutes). The budget's job is wall time and memory, and an inference count is a proxy. The plan must show the proxy: inferences per second varies by workload (the 1.4 s for 200M is one workload).
- Amendment:
  - Measure first, then set B as `k *` corpus maximum, with `k` stated in advance. Record both numbers and the derivation. Pre-register that B is derived, not chosen.
  - Add a scaling probe: documents of 10, 30, 100, 300 sections, with inferences and wall time. State the growth and where B falls. A budget that blocks a 100-section legitimate document is a finding about the language's cost, not about the boundary.
  - Add a wall-clock check alongside inferences: for each seed, record both. Report the ratio, to show inference count tracks time within a stated factor. A seed that burns time without inferences (the regex engine, `sort` of a huge list, `atom_length` on a huge atom, which are single inferences) bypasses the budget. E5 is the only such seed, and its limit comes from pcre, not from B.
  - Add a seed that is expensive per inference: a builtin on a large term (`length(L, 10000000)`, `numlist(1,5000000,L)`, a `findall` over a large `between`). Predict it passes T2 and times out or exhausts memory. That tells the reader what the budget does not bound.

**9. The scheduler hypothesis is a tautology on this corpus, its refuting cell is one-sided, and the "default policy" conclusion does not follow.**
- `prefix` picks a subset of `full` by definition (model §6). So "a corpus document where `prefix` asks fewer atoms than `full`" is impossible to refute in the direction stated: prefix can only ask fewer or equal. The refuting cell should be a difference in either direction, and the statement "reach the same statuses" is M1, already a gate (§9) passed in round 2.
- The plan measured that no corpus document has a derivation with more than one unanswered oracle leaf, so `full = prefix` for a structural reason. That is not a result about policies. It is a property of the 26 documents. The plan itself says the policies "differ only when a derivation has more than one unanswered oracle leaf, which no real constraint in this corpus has". The hypothesis is therefore true by that fact and the run cannot refute it.
- The witness cell (prefix needs one more round, same final statuses) tests M1 on one witness. A single witness whose conclusion is predicted is a regression test, not a policy-invariance measurement. The hypothesis says "policy-invariance"; the cell must test it over inputs where the policies differ. Use the existing random programs from `run-conformance.mjs --random`, which can have multi-leaf derivations, and compare final statuses and round counts under both policies, within the round cap, with the judge simulated.
- The conclusion "`full` is the default policy at no cost" does not follow either. Design 05 §Kernel declares `prefix` the default and keeps `full`/others as candidates. A tie on this corpus is no ground for changing the default, and the decision criterion (cost per round, atoms asked in total, rounds) is not stated. Total atoms asked, not just round-1 atoms, is the cost measure. `full` can ask more atoms overall when an early answer prunes later demand. The plan measures only round 1.
- Also, this is a second hypothesis in a round whose axis is the boundary. The experiment-round method has one hypothesis, one axis. The scheduler question is independent and could not fail the boundary hypothesis or the reverse.
- Amendment:
  - Move the scheduler to its own round or its own track with its own axis, or declare it a measurement track with no hypothesis and no verdict. If kept, restate the claim as "policy-invariance on random multi-leaf programs, with the cost difference measured", and pre-register the cost measure (total atoms asked until `Dem = ∅`, rounds).
  - Fix the refuting cell to any difference in final statuses, or any case where `prefix` asks a leaf outside `Dem`.
  - Do not select `full` as default on this evidence. State the default stays `prefix` unless the multi-leaf measure shows a cost difference above a pre-registered threshold. A tie keeps the declared default.
  - Drop the `|Dem.full|` equality row's "high" confidence (finding 7).

**10. The controls are directionally right but under-specified. Their expectations are recorded, but several necessary controls are missing and the "no spurious BLOCKED" control cannot fail.**
- Present: 23 witnesses and 26 corpus documents agree with T0 under T1 and T2; corpus maximum inferences under 1M. Good.
- Missing:
  - A host-effect positive control. The check "no host file `/tmp/dv-escape`" would be green if the checker looked at the wrong path, or if the instance FS is mapped differently. The runner must create the file host-side once, show the detector sees it, then remove it. Without it, every "no host effect" cell is unfalsified.
  - A positive control for the gate itself: a deliberately unsafe clause that the false-refusal logic must reject. This is E1, but it must be run against the same code path the controls use (after the regex fix in finding 1).
  - A control for the budget: a program that needs exactly more inferences than B must `BLOCKED`, and one that needs fewer must not. E6 is one point; a second near the boundary, run at B and B+, shows the wrapper counts what the plan thinks it counts.
  - The statuses compared across candidates should include the findings (`missing`, `unfounded`, `passed_u`), not just statuses, demand and verdict. A budget wrapper could change evaluation order and alter findings.
  - The controls run the corpus with no answers (promotion state). Run them with answered states too: the sandbox and budget apply per step, and tables are rebuilt per step.
  - A control that the wrapper's overhead is below a stated bound: the plan lists the measurement but gives no threshold and no expectation. Add one.
- Amendment: add the controls above, each with its expected value written before the run.

**11. Cost, `complete` flags and tracks.**
- The plan has one command with `complete: true|false` but does not define `complete`. Per the method, `complete` is false if any seed or control is skipped, errored in the harness, or not executed because a prerequisite failed.
- Define `complete: true` as:
  - every seed run under every candidate, with a recorded outcome class and host-effect check;
  - the host-effect positive control passed;
  - the checked-predicate census (finding 1) shows zero unchecked predicates;
  - all 23 + 26 controls ran under each candidate;
  - the seeded-defect flips of finding 12 all went red.
- The cost model is thin. Each seed per candidate rebuilds an instance (`Kernel.create`) or reuses one? An escape that corrupts instance state could affect later seeds. Use a fresh instance per seed per candidate and record it.
- A separate track per concern, each with one command and `complete`: containment (T0 seeds and host-effect), gate (T1 seeds and census), budget (T2 seeds, calibration, scaling), controls, scheduler. The single `run-boundary.mjs` makes a gate failure indistinguishable from a harness failure.
- Add the wall-time bound for the whole run, a timeout per seed (a hanging T0 seed must not hang the runner), and what a timeout is recorded as (`hang`, not `pass`).
- Also, T0 E6 "completes in < 30 s" is an unguarded wait: set the per-seed timeout below it and record exceedance as the refuting cell.

**12. A pass would be unearned under R6, because the plan shows the gates catching but never failing.**
- The plan's Reading says "the seeds under T0 are the failing case the gates catch". That is not what R6 asks. R6 requires a seeded defect in the gate itself to turn it red, then green on restoration (`seeded-defect-gate` item 3, two-directional). T0 containing an escape is not a defect of T1.
- Cells that never go red in this plan as written:
  - T1: no run with the sandbox gate defective. Mutate it: remove a check (stop excluding `core_`, drop the `core_count` unsafe case), empty the whitelist (every program should be refused, controls go red), skip the gate (E1 to E4 at T1 should now run as at T0).
  - T2: no run with the budget defective. Set B to infinity (E6 must complete, E6 cell red), set B to 1 (controls must BLOCK, control cell red), remove the wrapper.
  - The host-effect detector: no positive control (finding 10).
  - The control "no false refusal": red only if a primitive is removed from the whitelist. Seed this: delete one declaration and watch the control name the failing witness.
  - The census: red only if a predicate is added to core.pl's exclusion list.
  - The scheduler cell: a mutation that makes `prefix` take a leaf outside `Dem` must flip the invariance check.
- Amendment:
  - Add a mutation table to the plan: one row per gate (host-effect detector, sandbox gate, whitelist, census, budget wrapper, B calibration, scheduler check), each with the defect that must make it fail, the cell that goes red, and restoration to green. Run each, and record the red and green outputs.
  - "Pass" for the round means every seed is caught and every gate mutation flips its cell. State this in the Reading. State also that a boundary pass establishes invariant 5 "in force" only for the language features the seeds cover, and name the classes not covered.

**13. Smaller points.**
- E5: `resource_error(match_limit)` is reported as `rejected: resource: match_limit` by `kernel.evaluate`, not by a gate. Class it separately (`resource`), since "rejected" implies the static gate. The refuting cell "a hang" is only checkable with a timeout (finding 11).
- E2 expects "error, not implemented". On other builds of swipl-wasm `shell/1` may exist; pin the version in the table so the T0 rows are versioned facts, and add a test of the version string to the controls.
- Sandbox cost "< 50 ms per load": `use_module(library(sandbox))` itself loads many libraries in wasm and probably costs more than the per-predicate checks. Measure library load, per-predicate check, and per-document total separately, and state the corpus total, not a per-load figure.
- The plan says "native SWI-Prolog (not installed)" is unmeasured, but the budget semantics (`call_with_inference_limit` and tabling, inference counts) could differ natively, and the design says the boundary is the wasm instance. Say the claim is limited to this build.
- Design 05 and the constitution say "`library(sandbox)` and inference-limit probes" as the command. The plan's predicate is a single runner; make the verification-table row cite the committed command after the run.
- The Reading says a false refusal "is a finding about the kernel's primitive surface, recorded and closed before shipping the gate". Good. Add the same for any false acceptance, and say the gate does not ship while any seed in the matrix runs under T1.
- Ownership of the review: the plan says the independent seat's review is appended verbatim in `results/round-5-review.md`; the amendments must be listed under `## Review` per the AGENTS.md programme layout.

## Answers to the specific questions

- Falsifiable by the named predicate? Boundary: partly. Its refuting cells are real, but the cells it can actually refute are narrower than the claim (findings 1 to 6). Scheduler: no (finding 9).
- Is "where the boundary is enforced" the axis? It is the right axis, but the seeds conflate instance, gate and budget, and the budget covers only evaluation (finding 5).
- Complete for invariant 5? No: judge, network (as the real channel), budget shapes, memory, `catch`-swallowing and load-time directives are missing or not testing what they claim (findings 3, 4, 6).
- E8, E7, E6: E8 tests nothing; E7 mutates the translator and not the text, and omits the directive class; E6 is one point whose size is tuned to B (findings 3, 4, 8).
- Pre-established facts: build facts are fine, the measured results are not predictions (finding 7).
- Whitelist risk: the meta-predicates `core_count`, `core_naf`, `core_tnot` expose arbitrary goals to the whitelist, and `core_matches` hands a pattern to pcre (finding 2). Test both.
- B = 5M: circular and unmeasured (finding 8).
- Scheduler: a tautology on this corpus, and the default does not follow (finding 9).
- Controls: right idea, with several missing and the budget one unable to fail (finding 10).
- Unearned pass: yes, as the plan stands (finding 12).

Run after amendments. The amendments that must land first are 1 (the gate does not check what it claims), 2 (the whitelist hole), 3 (replace E8), 9 (split or restate the scheduler), and 12 (gate-defect rows).
