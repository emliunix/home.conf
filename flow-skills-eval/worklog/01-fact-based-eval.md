# Worklog — 01 fact-based eval

Path deviation (flagged): design lives at `flow-skills-eval/design/01-fact-based-eval.md`, not repo-root `design/NN-<topic>.md`. Same-topic worklog is `flow-skills-eval/worklog/01-fact-based-eval.md`.

Roles: orchestrator + architect/defender = this session. Reviewer = independent subagents. Implementer = not seated until `Status: reviewed`.

## 0. P0 project-contract

Project law: `skills/compatibility-design` + `skills/code-quality` (zero-compat / current-model). `flow-skills-eval` is in this repo; the law applies.

### P0-1 Dual grading worlds

- Finding: The draft adds Decision field-compare but does not state that as the only grader. Live code still grades free text: `src/eval/scoring.ts` `scoreAnswer`, `src/eval/qa.ts` `concepts`/`minimumScore`, `evals/flow-skills.qa.eval.ts`.
- Evidence: those files; design L1 § only describes the new schema.
- User impact: a dual harness can pass substring cases and fail Decision cases (or the reverse) for the same skill edit.
- Severity: blocker (P1, P0)
- Smallest correction: current machine is Decision field-compare only. No concept list.

### P0-2 Usage-field alias walk

- Finding: "cached_tokens (or the provider's cache-read field)" selects a shape by walking aliases.
- Evidence: `design/01-fact-based-eval.md` Prompt & efficiency.
- User impact: cache metric is not a positive contract; providers without that key get a second parse.
- Severity: blocker (P1, P0)
- Smallest correction: one usage path; absent field → 0; no other keys.

### P0-3 Env alias chain + cheap-model default

- Finding: `FLOW_SKILLS_EVAL_*` plus `API_KEY`/`OPENAI_*`/`PROVIDER_*` aliases and a hardcoded `gpt-4o-mini` default. Design leaves that chain in place and names gpt-4o-mini as a cheap-mode override.
- Evidence: `src/eval/env.ts`, `vieval.config.ts`, `README.md`. Design Prompt & efficiency last two paragraphs.
- User impact: two env worlds and two model defaults; missing project keys still boot via leftover names.
- Severity: blocker (P1, P0)
- Smallest correction: the three `FLOW_SKILLS_EVAL_*` keys are required; missing any is refuse. `vieval.config.ts` and `README.md` are in scope because they are the other writers of that contract.

### P0-4 Discarded-tree prose

- Finding: Prompt section narrates the deleted `read_skill` loop as a failed fixture-construction attempt.
- Evidence: `design/01-fact-based-eval.md` Prompt & efficiency.
- User impact: design body is not current speech; implementers keep a second-world story.
- Severity: blocker (P1, P0)
- Smallest correction: state the current prompt machine; do not compare to the discarded loop.

Architect verdict (item 0, this session): **Accept P0-1..P0-4 as P1.** Applied to the design body as current speech before other angles. `vieval.config.ts` + `README.md` added to Scope because they write the same env/model contract.

## Attack angles

Skipped: UI table — scope is eval harness, not the Vite shell.

Skipped: Observability as a standalone row — batched into verification (metrics). Schema rows batched into Decision-object angle.

| ID | Angle | Reviewer | Ask |
| --- | --- | --- | --- |
| A | Heads + Decision object | independent | Right problem? Scope at the true edge? Is `Decision` the object (identity, field semantics, completeness vs flow skills), not four unrelated columns? |
| B | Seam honesty + failure + testability | independent | One grader, one prompt, one agent loop. Missing/invalid `submit_decision`. One golden through the real path. |
| C | Minimum e2e + verification + cost claims | independent | Named happy path and outcome-proving checks. Cache-nonzero as pass/fail vs metric. L2 in this cycle? Corpus floor vs smallest slice. |

## Findings (reviewer wave)

Independent reviewers. Architect ranks below. Design body rewritten as current speech for every accepted P1.

### A — heads + Decision object

| ID | Verdict | Rank | Note |
| --- | --- | --- | --- |
| A1 Two problems in the head | Accept | P1 | Head is assertion-unit only. Call-shape/cache are Rationale constraints. |
| A2 “One root” does not follow | Accept | P1 | Rationale restated as Decision + L0 + metrics; model calls only produce the Decision. |
| A3 L2 vs scope edge | Accept | P1 | L2 is a non-goal this cycle. |
| A4 Decision has no identity | Accept | P1 | Decision = the prescribed outcome. When-table for each `next_action`. |
| A5 Writer / floor unnamed | Accept | P1 | expected=corpus, actual=tool; missing/invalid is `CaseOutcome`, not a Decision. |
| A6 `unchanged` / `opens_new_design` | Accept | P1 | `unchanged` = do not write Status. `opens_new_design` removed (derived from `open_new_design`). |
| A7 Exclusive `write_target` vs split writes | Accept | P1 | `write_target` is the non-Status artifact. Status is `status_to_set`. |
| A8 Corpus forks not unique tuples | Accept | P1 | Illegal-conjunction table; a fork is not in the corpus until unique. Extra forks not unique under the table are out. |

### B — seam + failure + testability

| ID | Verdict | Rank | Note |
| --- | --- | --- | --- |
| B1 Dual graders | Accept | P1 | Strengthens P0-1: no `scoreAnswer` / concepts / `minimumScore`. |
| B2 Dual prompt/agent/HTTP | Accept | P1 | One `createFrozenPrompt` (bodies inlined), one `askAgent` POST, `ChatModels` is not the case loop. |
| B3 Dual env readers | Accept | P1 | Strengthens P0-3: `readApiConfig` is the only reader; both callers use it. |
| B4 Untyped missing/invalid submit | Accept | P1 | Closed `CaseOutcome`; no retry/nudge. |
| B5 Missing cache field as a run fail; warmup owner | Reject | P3 | Cache is a metric (0 if absent). No second run-level outcome. Warm-up latch is extra machine — removed (see C3/C6). |
| B6 Two goldens | Accept | P1 | One exported `DecisionCase[]`; UT and eval import the same `expected`. |

### C — e2e + verification + cost

| ID | Verdict | Rank | Note |
| --- | --- | --- | --- |
| C1 No named happy path | Accept | P1 | `arch-failure-canonical` is the minimum e2e; listed checks observe only that case. |
| C2 L2 in `full` is YAGNI | Accept | P2 | Applied this cycle (cheap): L2 non-goal; `full` is smoke + remaining canonicals. |
| C3 Cache-nonzero pass/fail | Accept | P1 | Metric only. Does not fail the run. |
| C4 L0 doesn’t prove the problem; `http_calls===1` | Accept | P2 | Applied: L0 is a cheap invariant; harness throws on >1 HTTP call (construction defect). |
| C5 smoke drops trap/paraphrase | Accept | P1 | smoke = L0 + `arch-failure` triplet. Remaining rows are canonical-only. |
| C6 Warm-up barrier vs vieval | Accept | P1 | Correction is removal: no warm-up barrier, no “second case onward” pass/fail. |
| C7 Unverified provider assumptions | Accept | P1 | Assumptions section. Missing `submit_decision` is `missing_submit`, not assumed enforcement. |

## Defense record

- **Problem first:** A1/A2 keep the major problem as the assertion unit. Cost is measured, not a second problem. Off-problem L2 (A3/C2) is out of scope, not a work item.
- **Scope / non-goals:** L2, CI, judge model, goal-file, editing the flow skills stay out. `vieval.config.ts` / README stay in as the env contract’s other writers (P0-3).
- **Operational / failure boundary:** one POST, closed `CaseOutcome`, lock drift = suite abort. No nudge turns.
- **Observed vs TBD:** Assumptions section. Cache field is TBD; metric 0.
- **First-principles machine:** inline skills + one `submit_decision` + field-compare on a unique tuple. Corpus is the unique tuples that falsify substring grading, not a fork catalog.
- **Minimum e2e:** `arch-failure-canonical` + trap + paraphrase.
- **Complexity:** dropped `opens_new_design`, L2, 27-case floor, warm-up latch, cache pass/fail, env aliases, fractional score.
- **Reuse:** existing lock, `readApiConfig`, Vieval task, `vp test`. Custom `fetch` stays because ChatModels is not the case loop.
- **Compat:** none. Three env keys, refuse if missing.
- **Verification:** field match + one HTTP call + L0. Cache metrics do not prove the problem.
- **Scope expansion:** none authorized. Extra triplets swept.

## Simplicity delta

**Removed**
- Second problem (cache/call-shape as a GO condition)
- L2 sandbox from this outcome and from `full`
- `opens_new_design` as a model-supplied field
- 27-case triplet floor; P0-vs-bounded-correction and round-3-audit forks (not unique under the table)
- Warm-up barrier and cache-nonzero run fail
- Env alias chain, `gpt-4o-mini` default, usage-key walk
- `scoreAnswer` / concepts / `minimumScore` / fractional Vieval score
- `read_skill` loop and discarded-tree narration

**Retained (load-bearing)**
- Three-field `Decision` with when-table and illegal conjunctions — unique expected tuples
- `CaseOutcome` — missing submit is a fact, not a crash
- One exported `DecisionCase[]`
- Inlined Tier 1 + one POST + `submit_decision`
- Named e2e `arch-failure` triplet in smoke
- Canonicals for the other unique tuples in `full`
- L0 as cheap invariant
- `readApiConfig` as sole env reader
- Lock fail-closed + `lock:update`
- Cache/token metrics (measurement only)

## Follow-up sweep

Accepted-unfixed P2/P3: none left untracked. Extra trap/paraphrase triplets for the non-smoke rows are not accepted into this cycle; they are seeded in `design/02-eval-corpus-triplets.md` (`Status: draft-followup`), unit: L1 triplets for remaining unique tuples.

## Rematch

First rematch (independent): two blockers on the rewrite, not new scope.

| ID | Verdict | Rank | Note |
| --- | --- | --- | --- |
| R1 Conjunction table labeled “illegal” but listed the required shapes; `⇔ unchanged` collided across actions | Accept | P1 | Renamed to required implications `next_action ⇒ fields`; `new_design_file ⇒ open_new_design`. |
| R2 Layers pointer reimported guide warm-up / profiles / L2 / coverage floor | Accept | P1 | 01 is the law for those; guide principles 1–6 only, with listed exceptions. |
| R3 “No read_skill tool” discarded name | Accept | P3 | Folded: “The only tool is submit_decision.” |

Applied. Second rematch required.

Second rematch (same reviewer, independent): **Rematch clean. Accepted P1s solved.** No new blocker. Review gate GO.

`Status: reviewed` set on `design/01-fact-based-eval.md`.

## Implementation

**Round 1.** Decision harness per reviewed design: three-field `Decision`, `CaseOutcome`, inlined Tier 1, one POST `submit_decision`, `readApiConfig` as sole env reader, one `DecisionCase[]`, L0 lint, substring grader removed.

Evidence: `npx tsc --noEmit` clean; `vp test --run` 21/21. Named e2e tuple is in the corpus and well-formedness tests. Live L1 (`vp run eval`) is not run: no project `.env` with the three required keys.

Not `pending-retro` yet — the minimum e2e is a live L1 case.

