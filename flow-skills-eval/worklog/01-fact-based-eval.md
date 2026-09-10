# Worklog 01 — Fact-based, efficient flow-skill evals

Design: `design/01-fact-based-eval.md`

## Context note

Implementation was user-authorized ahead of the grill (Claude session, "All recommendation
LGTM" + worktree directive) and landed in this worktree before the review gate ran. The grill
below therefore reviews the design as-written against the as-built code; any accepted P1 that
changes the design materially triggers implementation remediation per the round budget.

## Attack angles

Scenario: code (eval pipeline). Three heads always under review.

1. **Case-corpus fidelity** — Do the L1 `Decision` enum values and the triplet corpus
   (expected decisions, SKILL.md line citations, trap/paraphrase construction) match what
   `skills/flow-common`, `flow-grill-review`, `flow-retro` actually say? Are traps/paraphrases
   genuinely falsifiable (each kills a named wrong route)?
2. **Measurement & efficiency mechanism** — Does the prompt inversion (inlined skill bodies,
   one call per case, tool-forced `submit_decision`) plus the `cached_tokens > 0` assertion
   actually prove prefix caching on the vieval OpenAI-compatible executor fronting Claude?
   Are usage metrics extracted correctly per provider shape?
3. **Minimum e2e & verification sufficiency** — Does the smoke profile (L0 lint + L1
   canonical) prove the stated user outcome ("evals assert real facts and measure their own
   cost")? Is deferring L2 safe, or does it hide a current correctness boundary?

Skipped suggested rows: observability (eval harness, no serving path — assertion/metric
output is the observability); failure/atomicity folded into angle 2's mechanism check.

## Findings

Reviewers: A = case-corpus fidelity (subagent), B = mechanism + verification (subagent),
C = peer agent (Claude pane wJ:p3, designer of record). Verdicts and P-ranks are the
defender's; reviewer severity was input only.

- **A1** Schema gap: `draft-followup` / follow-up sweep inexpressible in `Decision`
  (`StatusToSet` omits it; `WriteTarget` conflates sweep files with architecture-failure
  new designs). Evidence: flow-grill-review/SKILL.md:177 mandates the sweep destination.
  → **Accept, P2.** Fix alongside P1s (schema extension + corpus triplet).
- **A2** `budget-paraphrase` expects `write_target: "none"` but flow-common/SKILL.md:65
  demands a brief rewrite at rounds 3–4; the correct route is under-specified.
  → **Accept, P2.** Expected becomes `worklog` (the round/audit record's home).
- **A3** `remediate` overloaded across design-fix / impl-fix / brief-audit.
  → **Reject, P3.** The action × `write_target` product is the designed unit of fact;
  design body gained one sentence saying so. A finer verb taxonomy adds enum surface
  without killing a new wrong route.
- **A4** `opens_new_design` conflates architecture failure with sweep. → **Accept, P2**,
  subsumed by A1's fix (`followup_design_file` + `draft-followup`).
- **A5** Problem statement's "current suite" no longer on disk to verify. → **Accept, P3.**
  Tense fix applied ("the suite this replaces"); the audit findings predate the worktree
  (untracked project, no git history).
- **A6** Minimum corpus lacks a sweep triplet. → **Accept, P2**, subsumed by A1's fix.
- **B1** `cached_tokens > 0` is guaranteed to fail on the configured default:
  Anthropic's OpenAI-compatible shim supports no prompt caching and always returns empty
  `prompt_tokens_details` (Anthropic docs cited); agent.ts posts plain
  `/chat/completions` with no `cache_control`. → **Accept, P1.** Design corrected:
  cache-read is a metric + soft warn, never an assertion (see C2 refinement).
- **B2** Cache-metric extraction coupled to two provider field names. → **Reject, P3.**
  Normalizing a speculative provider zoo is unevidenced; the always-warn rule (B1 fix)
  already separates "field absent" from "no cache read".
- **B3** Warm-up runs inside the first concurrent batch, unmeasured. → **Accept, P2.**
  Move to run body before scored cases; emit as diagnostic metric.
- **B4** vieval.config.ts ChatModels/`flow-agent` alias is dead for the live path
  (agent.ts reads env directly) — two sources of truth for the model. → **Accept, P2.**
  Prefer removal: delete the dead plugin/override; env is the single source.
- **B5** Hard cache assertion contradicts "measure, don't assert". → **Accept, P1**,
  same correction as B1.
- **B6** Smoke omits trap/paraphrase, so green smoke doesn't validate anti-gaming.
  → **Accept, P2** as documentation: design now states smoke is a regression gate and
  `full` owns the anti-gaming claim (that was the intent; it was unsaid).
- **B7** L1 decisions can't observe filesystem behavior; deferring L2 leaves a boundary
  open (worklog overwrite, retro prose in design body, missing `Superseded by:`).
  → **Defer, P2** → `design/02-eval-l2-sandbox.md` (draft-followup). L2 is a declared
  non-goal this cycle; the boundary is real but release-level by scope.
- **B8** Schema asserts write *target*, not write *content*. → **Defer, P2** → same
  follow-up file, same functional unit (L2 filesystem assertions).
- **C1** (peer) Decision-record falsifiability: with small enums, is the correct answer
  unique per case, and is any enum value unproduced by skill rules? Folded into defense:
  all 7 `next_action` values trace to named skill rules; the ambiguous case is
  `budget-paraphrase` (A2, fixed); the unrepresentable route was the sweep (A1, fixed).
  Rematch re-checks unique-answer per case. → **Closed via A1/A2 + rematch brief.**
- **C2** (peer) Cache assertion is provider telemetry, not a suite fact; under
  concurrency-8 "second case onward" ordering doesn't hold either; keep hard invariants
  on what the suite controls (one call per case, stable promptHash). → **Accept, P1**,
  refines B1: soft warn *always*, even when the field exists. Design text updated.
- **C3** (peer) `eval:e2e` script is a byte-identical copy of `eval` — a false promise
  while L2 is unbuilt. → **Accept, P1.** Delete the script (prefer removal;
  `eval:full` already owns the profile axis).
- **C4** (peer) Old substring path fully deleted; no dead parallel scorer. Informational —
  seam honesty clean.

## Defense record

Lens, in rank order:

- **Problem statement first:** B1/B5/C2 and C3 serve the stated problem directly — the
  redesign's own cost claim must not rest on an unmeasured stack assumption, and a
  misnamed script is the same defect class (text promising behavior it doesn't have).
  A1/A2/A4/A6 serve "wrong file placement" falsifiability. B7/B8 are real but outside
  the declared scope edge (L2 is a named non-goal) → sweep, not scope creep.
- **Evidence:** B1/C2 carry external documentation (Anthropic compat page) plus code
  paths; C3 verified on disk (package.json scripts diffed). A3/B2 rejected for lack of
  an evidenced wrong route / speculative providers.
- **Complexity budget:** every accepted fix is removal or a small extension; no new
  subsystem. The schema grows by exactly two enum values, justified by a mandated skill
  route that was previously unrepresentable.
- **Scope check:** no accepted finding expands scope; L2 items carry a sweep destination.
- **Reversibility:** all corrections are local to flow-skills-eval; the lock regenerates
  with one command if skill text moves.

## Simplicity delta

Removed (this pass): the hard cache-read assertion (provider-coupled flake), the dead
ChatModels/runMatrix config, the `eval:e2e` script. Removed (round 1, pre-grill): the
`read_skill` loop and the substring scorer (C4 confirms no residue).

Retained, and why each is necessary to the outcome: tool-forced `Decision` schema (the
machine-checkable fact), triplet corpus (falsifiability in both directions), L0 contract
lint (cross-skill invariants a decision eval can't see), frozen-prefix lock (fail-closed
drift), two profiles (cost proportional to the edit's risk), cache/tokens/latency as
metrics (the "measure your own cost" requirement — as data, not verdicts).

## Implementation rounds

Round 1: coder subagent implemented the full redesign (prompt inversion, L0 lint, L1
decisions corpus + eval, metrics, profiles) — 34/34 `vp test` pass, `tsc` clean, `vp build`
clean. (Recorded retroactively; implementation preceded the grill, see Context note.)

Round 2: grill remediation. P1s: cache capability gate (per-case assert deleted;
`cached_tokens` always a metric; terminal `cache-observability` case warns+skips when the
provider omits the field, else asserts a nonzero read was observed — run-level because
concurrency-8 makes per-case ordering meaningless; vieval exposes no afterRun hook, hence
the terminal-case mechanism) and `eval:e2e` deleted from package.json. P2s: schema
extension (`draft-followup`, `followup_design_file`), sweep triplet, `budget-paraphrase`
write_target → `worklog`, dead ChatModels/runMatrix removal, README cache semantics.
Implementer was stopped mid-flight (design owner demanded direct orchestrator edits);
orchestrator completed package.json + a half-finished import, implementer resumed for the
remainder. Verification after orchestrator completion: `tsc` clean, 36/36 `vp test`.

Round 2 final state after implementer completion: `tsc` clean, `vp build` OK, 45/45
`vp test` (7 files; added metrics/capability-gate and schema-extension coverage).
Deviation noted: warm-up is a first-registered unscored `caseOf("warmup")` with a
`warmupDone` barrier — vieval's DSL has no run-body hook; same for the run-level cache
check (terminal `cache-observability` case + module accumulator, no afterRun hook).

## Rematch

Independent rematch (subagent) over the accepted P1/P2 corrections and the whole design:
**REMATCH CLEAN.** All corrections verified against code and skill citations; design body
intact current speech; baseline green (45/45, tsc clean).

One new finding, P3: `"draft"` in `StatusToSet` is unproduced by skill rules (the
lifecycle forbids un-reviewing; new design files carry `draft` as file content, never as
a `status_to_set` decision). Adopted and folded in silently: removed from
`src/eval/decisions.ts` (`StatusToSet`, `STATUSES_TO_SET`) and the design's `Decision`
interface; "keep as draft" remains expressible as `status_to_set: "unchanged"`.
Post-fold verification: `tsc` clean, 45/45. P3s do not force a rematch.

## Gate status

Review gate: designer of record (wJ:p3) accepted round 2 and authorized the transition;
rematch clean → `Status: reviewed` set by orchestrator. Two peer corrections absorbed:
README landed at 19:48:40, after the peer's 19:48:13 grep (my "already fixed" claim was
wrong — report only verified ordering); the npm-test devEngines blocker (pin 12.0.2 vs
installed 11.17.0, EBADDEVENGINES) must be disclosed, not hidden behind a bare green —
swept to design/02 (tooling hygiene unit).

Implementation gate: fresh evidence at transition — `tsc` clean, 45/45 `vp test`
(7 files: L0 contract lint, corpus triplet/fixture/coherence, decisions schema,
metrics capability gate, prompt lock, env, skill loader), `vp build` OK. Verification
boundary: live eval (`vp exec vieval run`) never executed — no API credentials in this
environment (only `.env.example`); the one-call-per-case + cache-metric behavior is
proven to the mockable layer only. `npm test` remains broken by the devEngines pin
(swept); `./node_modules/.bin/vp test --run` is the verified path.
→ `Status: pending-retro`; loop handed to `flow-retro`.
