# Review of adopting doc-verify's trusted kernel

## Abstract

This review asks whether `dv/trusted-kernel-trials` at `bd57aac` delivers a well-founded-semantics kernel that doc-verify on `main` can adopt, and whether that branch is safe to merge as it stands. The kernel is the production evaluator on the branch: `runProgram` translates the module, loads it into a fresh sandboxed `swipl-wasm` instance, and the TypeScript evaluator is gone. The suites that test that kernel passed in this review, including the slow property, seed, and clingo tracks (refuting count 0). One committed mutation gate is red: the evidence-budget runner's M3 edits the new per-atom budget check and leaves the batched check, which is the check its named case runs, so the case stays green and `npm run test:mutations` exits 1.

The branch is a larger change than the evaluator. It also makes per-atom judge requests the library default, adds promotion checks for goal evidence cells and per-row design witnesses, checks section references and dated prose at draft, and commits about 383,000 lines of trial logs. The round-2 sentence that the kernel passed 1,700 random programs with 0 counterexamples is not what the committed round-2 results file records (200 programs). A later 1,500-program property track does exist, and this review re-ran it, with one expected `loop-shape` failure that the suite does not count as refuting. The independent report that per-atom judging wrongly fails short `### Title` sections on JEV and Clef is not in this repository. The closest committed title-section run goes the other way. A short genuine witness cell does fail under per-atom and hold under batched, on JEV only.

Merge the kernel as its own change. Leave the per-atom default and the trial archive for separate decisions. Fix the mutation anchor before any merge that includes the mutations job. Leaving the branch unmerged leaves `main` on the TypeScript evaluator, which round 2 recorded as failing 14 of 24 model gate witnesses.

## 1. Subject and baseline

The subject is the doc-verify evaluator on `emliunix/home.conf` branch `dv/trusted-kernel-trials`, head `bd57aac473d2e89566a0b6ec4f48f967f8a36fb0` (2026-10-14, "round 12's M track re-run complete"). The baseline is `origin/main` at `24d31723e4bee831a531382639104da34e18ee06`. The merge-base is `82852854e35cbcad9ad479e45a83e483077bec05`. Three commits on `main` are absent from the branch (`76e0f0d`, `7eb6546`, `24d3172`); they touch the tracker and a containers section title. `git merge-tree --write-tree origin/main bd57aac` produced a tree and no conflict markers.

The branch is 66 commits and 532 files relative to the merge-base: +400,369 / −905 lines. Of that, `worklog/kernel-trials` is 411 files and +382,710 lines. The other 121 files are +17,659 / −905. This review did not push to `dv/trusted-kernel-trials` and did not merge it.

The acceptance question is the owner's: adopt this kernel in doc-verify on `main`. Design/06's own status line says the migration is landed on this branch and not merged to `main`.

## 2. Verdict

The kernel on this head is fit to adopt, after the mutation anchor is repaired and after the verdict-policy changes are split away from the evaluator. The branch as one merge is not fit. The slow suite and the draft corpus check support the engine. The promotion corpus check was not decidable here, because no judge key was available, so the live-judge PASS claimed in `bd57aac`'s message is unreproduced. The trial record supports feasibility, model conformance of the production kernel, and the trust-boundary seeds. It does not support the 1,700-program selection sentence as written, and it records a per-atom false fail that the library default now ships.

## 3. Findings

### Blocker

**B1. The evidence-budget mutation no longer kills the case it names, and the mutations runner exits 1.**

`doc-verify/tests/language/evidence-budget.mutations.mjs` M3 replaces the first occurrence of `  if (alone > limit) {` with `  if (false) {`. On the merge-base that predicate occurs once, in `doc-verify/src/engine/oracles.ts`. On this head it occurs twice: the per-atom loop at line 333 and the batched loop at line 344. `String.replace` edits the first. The case M3 names, "keeps the cap BELOW the judge's state ceiling", is built by `moduleText` in `doc-verify/tests/engine-helpers.ts`, which hard-codes `request_shape: batched`. That case still executes the second check, so it stays green.

This review ran the runner. M1, M2, and M4 were RED. M3 was GREEN. The runner printed `3/4 mutations redden the case their row names` and exited 1. `doc-verify/tests/language/references.mutations.mjs` was 9/9 RED. The skill runners under `skills/worktree-sop/tests/` were still executing when this review was written (see §7).

The unit test for the ceiling still passes, so the batched check is present. What failed is the gate that is supposed to go red when that check is removed. The branch's CI workflow `.github/workflows/ci.yml` runs `npm run test:mutations`. A merge of this head fails that job. The duplicate check arrived with the per-atom partition in `128f048`.

Repair: give the two checks distinct anchors, or replace every copy, and require the runner to exit 0.

### Should-fix

**S1. The selection sentence "1,700 random programs, 0 counterexamples" is not the committed round-2 kernel run.**

`goals/04-trusted-kernel.md` (the R1 evidence cell), `design/06-kernel-migration.md` (opening), `worklog/kernel-trials/decisions.md` (2026-10-12 row), and `worklog/kernel-trials/round-2-verdict.md` (the S1 random cell) state that the WFS kernel passed 24 of 24 gate witnesses and 1,700 random programs with 0 counterexamples. The verdict's predicate runs `--random 200` and `random-brute.mjs 500` for listed seeds. `worklog/kernel-trials/results/round-2-conformance.md` records `random (C4) S1: programs 200, seed 1, counterexamples 0`. The "1,500 programs" sentence in `worklog/kernel-trials/probe/reference/DERIVATION-LOG.md` is about the reference checker's soundness properties, in the section that also records prefix-stall counterexamples. It is not an S1 kernel log.

A later track does run 1,500 programs on the kernel. `worklog/kernel-trials/results/item-7-fix-S1-C5.txt` and `worklog/kernel-trials/results/generator-coverage-audit.md` record that track after the count fix, with failing kind `loop-shape` and a refuting count of 0. This review re-ran it (§7) and got the same shape: 1,500 programs, `{"loop-shape":1}`, refuting 0. That measurement is real. It is a different measurement from the round-2 selection sentence, and `loop-shape` is an exempted open class (gate-ledger item 8), so "0 counterexamples" and "0 refuting" are different claims.

Consequence: the goal this branch adds states a count its cited round-2 artifact does not contain. Correct the R1 cell, and the same sentence in design/06 and `decisions.md`, to the figures those files actually hold, before goal 04 is the adoption record.

**S2. Per-atom as the library default is a judge-policy change with a recorded false fail, and this repo does not contain the short-heading Clef result.**

`doc-verify/src/engine/module.ts` line 168 sets `requestShape` to `source.request_shape ?? "per-atom"`. At the merge-base the fallback was `batched`. `doc-verify/lib/goal.yaml` and `doc-verify/modules/design.yaml` declare `per-atom`. The four `doc-verify/lib/module-*.yaml` libraries pin `batched`. Commit `128f048`.

What this repo measured, judge `jev-1.13.0`, cache off, from `worklog/kernel-trials/results/round-6-compare.txt` and `round-6-verdict.md`:

- Witness fixture `controls` row 13, cell text `A known-bad document passes`, expected `holds`. Batched `holds` 0.93 and 0.93. Per-atom `fails` 0.75 and 0.74. The verdict calls per-atom wrong. The flip is on all four repeat pairs.
- Three real design witness cells flipped from `holds` under batched to `fails` under per-atom. The verdict says the lead's blind labels read those cells as witnesses, and that agreement with those labels was 26 of 30 under both shapes, on different cells.
- The pre-registered rule fired on a near-threshold shift of +0.22 on five witness cells, not on McNemar accuracy (k = 2, m = 1). The branch then rewrote the real cells that flipped.

The one committed "title section" measurement is round 8, `module_model/subtle-1`, atom `acme-widget--model` (`worklog/kernel-trials/results/round-8-compare.txt`). Expected `fails`. Batched `fails` 0.61 and 0.59. Per-atom `holds` 0.68 and 0.75. `worklog/kernel-trials/results/round-8-review.md` notes that `core.body` of the title section is the heading plus the whole subtree, so that atom's evidence is the page, not a bare heading. Per-atom is the arm that is wrong, and it is wrong by passing.

Searches of the branch found no Clef judge and no fixture whose evidence is the heading line `### Title`. Round 12's verdict lists judges other than `jev-1.13.0` as unmeasured.

Consequence: the default changes live labels on short witness text under JEV, in a direction the branch's own verdict called wrong for one genuine control. The short-heading failure on JEV and Clef is not established by the title-section run in this repo; that run shows the opposite error on a full-page title section. The evaluator does not depend on this default. Keep `batched` as the fallback in the kernel change. Decide per-atom, and the document rewrites that make the corpus pass under it, on their own.

**S3. The witness and corpus conformance tests load the kernel with the sandbox off.**

`Kernel.load` defaults `sandbox` to false (`doc-verify/src/kernel/kernel.ts`). `doc-verify/tests/kernel/witnesses.test.ts` and `doc-verify/tests/kernel/corpus.test.ts` call `load` without `{ sandbox: true }`. Production `evalKernel` in `doc-verify/src/engine/index.ts` always passes `{ sandbox: true }`. `doc-verify/tests/kernel/boundary.test.ts` does exercise the sandbox. A program the sandbox would reject can still match a witness `expect`. Pass `{ sandbox: true }` on those loads.

**S4. The dogfood sentences have no committed transcript, and this review could not decide promotion.**

Design/06's language-breaks paragraph says a before-and-after `check --all` on 27 documents, using the shared cache, changed no verdict or finding, and that `DOC_VERIFY_MOCK_JUDGE` does not exist in doc-verify. No results file holds that transcript. `bd57aac`'s message says that on `f25be1f`, `npm test` was 404/404, `test:kernel-slow` had refuting 0, and `check --all` passed at draft and at promotion. No log of those three commands is in `worklog/kernel-trials/results/`.

This review's draft run passed (§7). The promotion run exited 3, `BLOCKED`, 0 semantic calls, because `TYPESAFE_API_KEY` was unset. That does not confirm or refute the promotion PASS. Re-run `doc-verify check --all --profile promotion` with the judge before treating that sentence as measured.

**S5. The new promotion checks carry two gaps the owner has already accepted, and the acceptances should stay visible at merge.**

`doc-verify/modules/design.yaml` `design-witness-observable` is an error on the promotion profile, one judge question per witness cell. Gate-ledger item 11, accepted 2026-10-14: a genuine witness on the wrong row is not caught. Round 9 refuted the relevance questions. Round 12 refuted address context: E-der caught 0 of 11 under every arm, and the address arm turned 3 right witness labels wrong (`worklog/kernel-trials/results/round-12-compare.txt`). `context:` is in the language and used by no shipped library. Gate-ledger item 8, also accepted: a loop-resting binding is demanded once before it is called unfounded. Statuses stay the well-founded model; one question is wasted.

`doc-verify/lib/goal.yaml` `goal-evidence-reasons` is an error on every goal, open or closed, for a column headed `Evidence` (`5658273`). A column headed `Evidence required` is not judged (`round-4-verdict.md`). This review's promotion run asked `goal-evidence-reasons` on goals/01 (8 rows) and goals/04 (5 rows), and did not ask it on goals/02 or goals/03.

These gaps are not silent. A merge note that presents the new witness check as closing relevance would over-claim the branch.

### Nit

**N1.** The schema comment in `doc-verify/src/engine/module.ts` (the `request_shape` field) still says batched is the default. The fallback at line 168, and the comment above `RequestShape`, say per-atom.

**N2.** Constitution invariant 5 says the production path uses one fresh instance per check. `evalKernel` constructs a `Kernel` on every call, and `runProgram` calls it once before the oracle rounds and once after each round that asked. Draft `--all` on 28 documents took 4.3 s on this machine, with the kernel in the path and no judge.

**N3.** When the kernel returns `blocked` or `resource`, `runProgram` replaces every constraint report with an empty undetermined binding. The verdict is `BLOCKED`, which is the safe side. The partial proof the kernel had computed is dropped (`doc-verify/src/engine/index.ts`).

**N4.** Proof trees are parsed in the host and printed. `docs/doc-verify-constitution.md` calls a full derivation a debugging view. Nothing in the production path re-checks a proof against a second prover. `doc-verify/tests/kernel/proof.test.ts` asserts a violated binding has a non-empty proof; that test passed here.

**N5.** The header of `doc-verify/src/kernel/core.pl` still says the program is produced by `translate.mjs`. The production translator is `doc-verify/src/kernel/translate.ts`. The probe copy `worklog/kernel-trials/probe/kernel2/core.pl` is 511 lines and differs from the 843-line production file. Rounds 1 and 2 measured the probe. The slow suite and `doc-verify/tests/kernel/` measure the production file.

**N6.** `results/round-2-conformance.md` says "22 gate witnesses". The verdict says 24 of 24. The production witness directory has the later shared-negation file as well.

**N7.** `npm test` on this machine was 402 passed and 2 failed, both in `doc-verify/tests/selection/local-env.test.ts`. `doc-verify/src/local-env.ts` throws when a proxy is set and `http.setGlobalProxyFromEnv` is missing, and its comment says that resolver needs Node 24. Those files are unchanged since the merge-base. This machine is Node v22.14.0. CI's test job uses Node 24. This is not a kernel regression.

## 4. What the kernel does on this branch

`doc-verify check` calls `checkDocuments`, which calls `runProgram`. `runProgram` compiles the module, builds document facts in the host, and calls `evalKernel`. `evalKernel` runs `translateProgram`, `Kernel.create()` (a new `swipl-wasm` 8.2.2 instance), `load(..., { sandbox: true })`, `setAnswers`, and `evaluate` with the inference budget. There is no import of an `evaluate.ts` evaluator under `doc-verify/src`. Commit `9179867` deletes that file and routes evaluation through the kernel. `main` still has the TypeScript evaluator.

What is trusted, in the sense that a bug there changes verdicts without a second checker on the request path:

- `doc-verify/src/kernel/core.pl` and SWI-Prolog's well-founded semantics under tabling. An unanswered label atom is undefined via `core_u/1`, a negative self-loop through `tnot/1`. `unknown` is not a label: `core_has_label` rejects it, and `core_label` treats an unanswered or `unknown` atom as undefined.
- `doc-verify/src/kernel/translate.ts`, which lifts a negation whose unbound variables are local to that literal into a tabled helper. The host does not re-prove that translation at runtime.

What is checked around that kernel:

- `doc-verify/src/engine/checker.ts` refuses a negated literal that shares an unbound variable with another literal of the same body, an oracle negation with an unbound input, and a constraint goal that uses a forall count's result (`58d5f8a`, `a4985be`).
- The sandbox at load: directives outside an allow-list are rejected, and a module-derived body may call a `core_` predicate only when `SANDBOX_PRIMITIVES` or `SANDBOX_META` names it (`doc-verify/src/kernel/kernel.ts`). Round 5's boundary seeds are in `doc-verify/tests/kernel/boundary.test.ts`; that file passed in `npm test`.
- The inference budget maps to verdict `BLOCKED`.

Semantic differences from the TypeScript evaluator, as design/06 lists them and the code implements them: the three refusals above; prefix demand asks the residual undefined leaves rather than the old evaluator's longer prefix (round 2's over-demand witnesses); interval `count` is two queries over delays, because WFS has no three-valued aggregate. The old evaluator is not a reference on this branch. Round 2 records it failing 14 of 24 gate witnesses.

Determinism: each evaluation gets a new instance, which is the mitigation for gate-ledger item 9 (a history-dependent `instantiation_error` on a reused instance). This review's property arm reported `nondet: freshInstance=0 sameInstance=0`. Item 9 did not appear. The historical triple remains in `results/round-7-S1-C5.txt`.

Startup: one WASM instance per evaluation, and one evaluation per oracle round. On this machine, draft `--all` (28 documents, kernel on, judge off) took 4.3 s. Design/06's "7.8 s to 8.2 s on two documents" has no committed timing log.

## 5. Whether the trial record supports the claims

Rounds 1 through 12 each have a verdict file, and the numeric claims this review spot-checked against `worklog/kernel-trials/results/` matched the files, except the 1,700-program sentence in S1.

| Claim | Where it is stated | What the committed artifact shows |
| --- | --- | --- |
| K1–K4 feasible on swipl-wasm | round-1 verdict, goals/04 R1 | `results/round-1-swipl-wasm.md` agrees |
| 24/24 gate witnesses | round-2 verdict | `results/round-2-conformance.md` agrees for the kernel; the TypeScript evaluator is 10/24 there |
| 1,700 random programs, 0 counterexamples, as the round-2 selection | goals/04, design/06, decisions.md, round-2 verdict | Round-2 kernel random log is 200 programs, seed 1, 0 counterexamples. See S1 |
| Trust boundary in force | design/05, constitution invariant 5 | `results/round-5-*.txt` and `boundary.test.ts` |
| Count-bound class closed | gate-ledger item 7 | `results/item-7-fix-S1-C5.txt`: count-bound absent; `loop-shape` 1 of 1,500 remains, expected |
| Per-atom selected | round-6 verdict, `128f048` | `results/round-6-compare.txt` matches the verdict, including the control false fail |
| Module pages stay batched | round-8 verdict | `results/round-8-compare.txt`; pins are in the four `module-*.yaml` files |
| Context does not fix wrong-row evidence | design/07, round-12 verdict | `results/round-12-compare.txt`: E-der 0/11, W-fix 3 right-to-wrong |
| `check --all` PASS at draft and promotion after round 12 | `bd57aac` message | No transcript in `results/`. Draft reproduced here. Promotion not run against the judge |
| Language breaks, 27 documents, no verdict change | design/06 | No transcript |

Gate-ledger items 5 and 6 stay open in the file: clingo demand is D1-incomplete on program #231 of seed 1, and the generator's older hole around `choose` and UNSAT is what item 6 names. This review's clingo arm reproduced that one D1 counterexample and still passed, which is what `run-kernel-slow.mjs` treats as expected. Clingo is a differential subject, not the production evaluator.

`goals/04-trusted-kernel.md` still describes rounds 4b and 5 as unwritten in its workstream section, and its R1 cell still says the trust boundary is left to round 5. Those sentences are behind the verdicts in the same branch. The false count in S1 is the part that should be corrected; the stale "not yet written" lines are hygiene on the same page.

The generator coverage audit lists two gaps still open after `d379f16` and `79b445b`: recursion through a count, and a second document or a multi-element `in`. The audit's "1,500 programs, refuting 0" sentence matches the suite's definition of refuting, which exempts `loop-shape`.

## 6. Verdict changes that travel with the kernel

These change what `doc-verify check` decides on documents that already exist. They are independent of replacing the evaluator. The document edits that keep the branch's own corpus green are part of the same commits.

| Change | Commit | Profile | What it changes |
| --- | --- | --- | --- |
| Per-atom default | `128f048` | promotion, wherever the module omits `request_shape` | Judge requests. See S2. Goal and design modules set it explicitly. Module-page libraries stay batched. |
| Goal evidence chains | `8a67981`, `5658273` | promotion | Every `Evidence` cell, including closed goals. `Evidence required` is not judged. |
| Per-row design witnesses | round 4c, on this branch | promotion | `design-witness-observable` asks each Failure-witness cell. Item 11 stays open. |
| Section references | `8d812d6` | draft and promotion | Dangling `#` fragments and document-qualified `§` headings. This review's draft run had no `fragments-resolve` finding. |
| Dated-prose pre-check | `61e84db` | draft and promotion, `module-*` pages only | Host regex for former-state wording, before the kernel. This review's draft run had no `structure.dated-prose` finding. |
| Commit hook | `247273d` | the hook uses `draft` | `.pre-commit-config.yaml` runs `check --staged --profile draft`. At the merge-base the hook used `--profile auto`, which promotes non-draft documents and calls the judge. Promotion on this branch is `.github/workflows/judge-advisory.yml`. |

CLI `--profile auto` is unchanged: a document whose status word is `draft` runs at draft, and any other status runs at promotion. Design/05 and design/01 are `draft`. Design/02, 03, 04, 06, and 07 are `landed` or `reviewed`. Goals/01 and 02 are `CLOSED-GREEN`. A default `check --all` on `main` after this merge would send those documents to the judge.

Draft `--all` on this head printed three warning-severity `module.paths-resolve` findings on design/02 (paths `doc-verify/contracts/`, `jev-prompts/jev.py`, `doc-verify/tests/expected/`) and two metadata warnings (design/01 and the receipts file have no companion). The verdict was PASS. `warningCount` counts artifact warnings, which is why the summary says 2 warnings while the path findings also print. This review did not re-run `main`'s checker, so it does not claim those path warnings are new.

## 7. Commands run for this review

Machine: Node v22.14.0, npm 10.9.9, Linux. Worktree detached at `bd57aac`. `npm ci --ignore-scripts` (248 packages). No `TYPESAFE_API_KEY` and no `API_KEY`. Date: 2026-10-14.

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0. oxlint gate armed, 77 files |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 1. 402 passed, 2 failed, 404 total, 77.8 s. Failures are N7 |
| `npm run test:kernel-slow` | exit 0. Wall 1169.5 s. Property: 1,500 programs, failing kinds `{"loop-shape":1}`, refuting 0, `complete: true`, 142.5 s. Seeds: refuting cells 0, `complete: true`, 1017.8 s. Clingo: 500 programs, unequal to enumeration 0, D1 counterexamples 1 (program #231, reported as the expected item-5 case), S3 pass, 9.2 s |
| `node doc-verify/dist/cli.js check --all --profile draft --format text` | exit 0. `PASS: 28 artifact(s), 222 section(s), 2 warning(s), 0 semantic call(s)`, 4.3 s. Path findings as in §6 |
| `node doc-verify/dist/cli.js check --all --profile promotion --format text` | exit 3. `BLOCKED: 28 artifact(s), 222 section(s), 2 warning(s), 0 semantic call(s)`, 7.2 s. Every semantic finding's reason is `TYPESAFE_API_KEY is unavailable`. Unasked counts included 62 `design-witness-observable`, 13 `goal-evidence-reasons`, 4 `goal-coverage-complete`, and the module-page oracles. These lines are unasked atoms, not judge labels |
| `npm run test:mutations` | `evidence-budget.mutations.mjs` exit 1 (B1). `references.mutations.mjs` 9/9 RED. `skills/worktree-sop/tests/check-canonical-checkout-mutations.mjs` was still running `git commit` inside its scratch repositories when this review was written, about 14 minutes after the suite started, so the skill half is unfinished here |

`npm test` includes the kernel witness, corpus, boundary, proof, and regression files. Those passed. The 404 figure in `bd57aac` matches the test count; the two failures are the Node 24 proxy tests on this runtime.

## 8. Decision: how to land it

The decision is whether `dv/trusted-kernel-trials` at `bd57aac` merges to `main`, and in what shape. The kernel is wired and its suites passed here. The head also changes judge policy, promotion checks, and the commit hook, and it fails the mutations runner.

Options:

1. Merge `bd57aac` as it stands, history included.
2. Squash the whole branch into one commit on `main`.
3. Split. Land an engine change. Decide the verdict-policy changes separately. Keep the trial logs either on this branch or in their own commit, and do not squash them into the engine commit.

The recommendation is option 3. Option 1 ships the per-atom default, the accepted witness gap, and a red mutations job together with the evaluator, and it puts 383,000 lines of run logs on `main`. Option 2 keeps that coupling and deletes the commit identity the verdicts cite (`128f048`, `9179867`, `58d5f8a`). The trial logs are the evidence trail; folding them into the engine commit makes the citations in goal 04 point at a squash that does not exist yet.

Minimum for the evaluator to be the one doc-verify runs on `main`:

- `doc-verify/src/kernel/` (`core.pl`, `kernel.ts`, `translate.ts`, `keys.ts`, `index.ts`) and the build step that copies `core.pl` into `dist`.
- `runProgram` through `evalKernel`, deletion of `evaluate.ts`, and `kernel-bridge.ts`.
- The checker refusals the translator assumes (shared negation, unbound oracle negation, count-in-forall).
- `swipl-wasm` 8.2.2 in `package.json`.
- `doc-verify/tests/kernel/`, `doc-verify/tests/kernel-slow/`, and `.github/workflows/kernel-slow.yml`.
- The constitution invariant 5 amendment and the model sections the kernel implements, so the spec and the code name the same semantics.
- The M3 anchor repair if the mutations workflow lands with the engine.

Leave out of that change: the `?? "per-atom"` fallback and the cell rewrites that exist so the corpus passes under it; `goal-evidence-reasons`; `design-witness-observable`; the fragment check; the dated-prose pre-check; the hook's move from `auto` to `draft`; `worklog/kernel-trials/`. Spine relations (`9d0ab3d`) can land with the kernel or after it. Round 12 declined using them as judge context. They do not by themselves change a shipped oracle's verdict.

Consequence of not deciding: `main` keeps the TypeScript evaluator. Round 2 recorded that evaluator failing 14 of 24 model gate witnesses, including three failures under design 04's own over-demand rules. The branch continues to sit beside `main`; it already lacks three later `main` commits, which merge cleanly today and may not forever.

The distinguishing evidence is §3 and §7. The kernel suites and the draft corpus check passed. The mutations runner failed on M3. Promotion against the live judge was not run. The 1,700-program sentence is unsupported by the round-2 artifact. The per-atom default has a committed false fail on a short witness cell and no Clef or bare-`### Title` run.

The decision owner is the repository owner, the seat that accepts designs 05–07. The trigger is the merge of `dv/trusted-kernel-trials` into `main`. There is no calendar date on the branch.

## 9. Claim boundary

Established by this review, on `bd57aac`, Node v22.14.0, no judge key: the production path is the sandboxed WFS kernel; `npm test` kernel files passed; the slow suite's refuting count was 0 with one expected `loop-shape` and one expected clingo D1 case; draft `--all` passed in 4.3 s; promotion `--all` was `BLOCKED` with 0 semantic calls; the evidence-budget mutation M3 stayed green.

Established by reading committed artifacts, not re-run against the live judge: round 6's per-atom false fail on the short witness cell; round 8's title-section result in the opposite direction; round 12's negative context result; the round-2 kernel random log of 200 programs.

Designed and not observed here: a promotion PASS of the 28 documents under `jev-1.13.0`; the design/06 claim of no verdict change across a before-and-after corpus check; any Clef run; any fixture whose evidence is only `### Title`.

Unresolved: gate-ledger items 5, 6, 8, and 9 as the ledger still states them (item 8 accepted as cost, item 9 not reproduced in this property arm); generator gaps for count-through-recursion and a second document; the skill half of `npm run test:mutations`, which had not finished.

Deliberately not claimed: that the TypeScript evaluator and the kernel agree on every real document (the branch's own round 2 says they do not, and design/06's no-diff sentence has no transcript); that per-atom is safe or unsafe on short headings outside the cells named in §3; that merging the worklog is required to adopt the kernel.

## Reader key

### Glossary

| Term | Meaning in this review |
| --- | --- |
| WFS kernel | `doc-verify/src/kernel/core.pl` evaluated by SWI-Prolog tabling inside `swipl-wasm` 8.2.2 |
| Production path | `doc-verify check` → `runProgram` → `evalKernel` |
| Draft profile | Constraints with no `profiles` list. No oracle round, so no judge |
| Promotion profile | Every constraint, including those marked `profiles: [promotion]`, which ask the judge |
| Refuting | A slow-suite failure outside the pre-registered open classes. `loop-shape` is open (gate-ledger item 8) and is not refuting |
| Per-atom / batched | Whether one judge request carries one demanded atom or several |

### Source keys

| Key | What it pins |
| --- | --- |
| Branch | `origin/dv/trusted-kernel-trials` @ `bd57aac473d2e89566a0b6ec4f48f967f8a36fb0`, fetched 2026-10-14 |
| Main | `origin/main` @ `24d31723e4bee831a531382639104da34e18ee06` |
| Base | merge-base `82852854e35cbcad9ad479e45a83e483077bec05` |
| Run | Commands in §7, Node v22.14.0, worktree detached at the branch head, 2026-10-14, no judge credential |

Paths cited above are paths at the branch head. The trial logs are not on `main`.
