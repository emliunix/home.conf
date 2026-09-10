# 01 — Fact-based, efficient flow-skill evals

## Problem statement

The Vieval suite this replaces graded skill understanding by substring-matching
expected vocabulary in free-text answers. That passed answers prescribing
forbidden behavior while containing the right words, failed correct paraphrases
lacking the exact phrase, and could not see the failure modes that matter
(misrouting, wrong file placement, broken round budget). It was also expensive: a
forced sequential `read_skill` ritual made every case 4–6 serial API calls, while
the heavy shared content sat *after* the per-case divergence point, defeating
provider prefix caching. We need evals that assert real facts and measure their
own cost.

## Scope — what we touch

- `flow-skills-eval/src/eval/*` — prompt assembly, agent loop, scoring
- `flow-skills-eval/evals/*` — case corpus and Vieval task
- `flow-skills-eval/tests/*` — deterministic layer, extended with contract lint
- Non-goals: the flow skills themselves (edited separately), the goal-file skill
  (future integration seam), CI wiring, any judge-model layer.

## Rationale

Every defect class found in review traces to one root: the eval checks *text about
behavior* instead of *behavior*. The fix is to make the unit of assertion a
machine-checkable fact — a JSON decision, a cross-skill invariant, a usage metric —
and to spend model calls only where a model is irreducibly needed (producing the
decision), never for grading it.

## Layers

This design applies the layer structure, principles, and case-authoring rules
owned by `design/ref-eval-design-guide.md` (L0 contract lint / L1 structured
decisions / L2 sandboxed e2e). This file owns only the flow-skills-specific
decisions below.

### L0 — Contract lint: flow-specific invariants

Beyond the guide's canonical checks, assert: write-target sections referenced by
`flow-common` exist per `flow-grill-review`'s design/worklog split (this would
have caught the "Review log" contradiction), and each of
`draft`/`reviewed`/`pending-retro`/`landed` is set by exactly one gate.

### L1 — Decision schema for flow cases

**Case shape:**

```ts
interface DecisionCase {
  id: string;
  kind: "canonical" | "trap" | "paraphrase";
  fixture: string;        // rendered repo-state snippet: design file with Status, finding, etc.
  question: string;       // the decision to make
  expected: Decision;     // exact-match target
}

interface Decision {
  next_action: "implement" | "remediate" | "open_new_design" | "run_retro"
             | "set_status" | "halt_structural" | "reject_finding";
  status_to_set: "reviewed" | "pending-retro" | "landed"
               | "draft-followup" | "unchanged";
  write_target: "design_body" | "worklog" | "new_design_file"
              | "followup_design_file" | "none";
  opens_new_design: boolean;
}
```

`next_action` is deliberately coarse: the machine-checkable fact is the action ×
`write_target` product (`remediate` + `worklog` vs `remediate` + `design_body`),
not a fine-grained verb taxonomy. `followup_design_file` (paired with
`status_to_set: "draft-followup"`) is the P2/P3 sweep destination and is distinct
from `new_design_file`, which supersedes the current design after architecture
failure.

The agent must answer with only this JSON (tool-forced via a `submit_decision`
function so the schema is provider-enforced). `expected` is compared field-by-field;
a miss reports which field diverged.

### L2 — Sandboxed end-to-end (release-level only, optional)

A real agent run against a temp-dir fixture repo, asserting the resulting
filesystem: which files changed, final `Status:` lines, worklog entries appended
not overwritten, old design carries `Superseded by:`. Expensive; run on skill
releases, not every edit.

## Case-authoring guidance

Rules for writing L1 cases (and the UT fixtures backing them):

1. **State a fact, not a rule.** The fixture shows a repo state ("design 03 is
   `pending-retro`; retro found the parser rejects valid input X"); the question
   asks for the decision. Never ask the agent to recite what a skill says.
2. **Every case must be falsifiable by a wrong route.** Before adding a case, name
   the specific wrong decision it catches (e.g. "resets reviewed design to draft").
   If no plausible wrong answer exists, the case measures nothing — drop it.
3. **Triplets: canonical / trap / paraphrase.** For each behavior under test,
   author (a) the straightforward case, (b) a trap whose fixture invites the
   forbidden route using the correct vocabulary, (c) a rewording with none of the
   skill's terminology. The trap kills false positives; the paraphrase kills false
   negatives.
4. **One decision per case.** A case asserting two transitions can pass half-right;
   split it.
5. **Expected values come from the skills, cited.** Each case carries a comment
   with the `SKILL.md` line that makes the expected decision correct, so a skill
   edit that invalidates a case is traceable, and cases die with the rule they
   test.
6. **Fixtures are inline strings, not files** — deterministic, diffable in review,
   and reusable verbatim by unit tests that assert the fixture itself is
   well-formed (valid status word, three heads present).
7. **Minimum corpus:** one triplet per gate transition (draft→reviewed,
   reviewed→pending-retro, pending-retro→landed), one per routing fork
   (implementation defect vs. bounded correction vs. architecture failure vs. P0
   violation), one for round-budget behavior (round 5 halt vs. round 3 brief
   audit), one for write-target discipline (retro prose → worklog, never design
   body), one for the follow-up sweep destination (accepted-but-unfixed P2/P3 →
   `draft-followup` file, never left untracked).

## Prompt & efficiency redesign

**Invert the tiers.** Tier 1 (frozen system prompt) inlines the full skill bodies —
they are already hashed by the lock, ~412 lines, the ideal cacheable prefix. Tier 2
stays the per-case user message. `read_skill` and the forced sequential reading
loop are deleted; each case becomes exactly one API call. (The old loop was a
fixture-construction attempt — "agent has read all skills" — but it built the
fixture with 3–5 live calls per case and failed the whole case on ordering
violations that say nothing about skill comprehension. Inlining constructs the same
fixture for free.)

**Measure, don't assert.** Per case, emit as Vieval metrics from the response
`usage`: `prompt_tokens`, `completion_tokens`, cache-read tokens (normalized from
the provider's cache-read field), and wall latency. Cache-read enforcement is
capability-gated on observability: when the provider omits the cache-read field
(e.g. Anthropic's OpenAI-compatible shim supports no prompt caching and always
returns empty `prompt_tokens_details`), the run warns and skips enforcement — a
missing field is never coerced to a failing zero, and provider telemetry never
fails a comprehension case. When the provider does expose the field, a run-level
check asserts at least one case past the warm-up read cache (per-case ordering is
meaningless under concurrency, so the assertion is run-level, not per-case). The
always-on hard invariants are the ones the suite controls: exactly one API call
per case and a stable `promptHash` (enforced by the lock).
Measuring real cache hits on Claude requires the native Anthropic API with
`cache_control` breakpoints or a caching gateway in front of the
OpenAI-compatible executor. One unscored warm-up probe runs before all scored
cases (its usage/latency emitted as a diagnostic metric), then cases run
concurrently (the shared prefix is identical).

**Two profiles.** `smoke` = L0 + L1 canonical cases (runs on any skill edit);
`full` = all L1 triplets + L2 (release-level). `smoke` is a fast regression gate
only — the anti-gaming claim (trap/paraphrase resistance) is owned by `full` and
is not proven by a green smoke run. Default eval model should be the
model family that actually consumes these skills; `gpt-4o-mini` remains only an
explicit cheap-mode override, not the default.

**Lock lifecycle.** Keep fail-closed drift detection, add the missing acceptance
path: a `vp run lock:update` script that regenerates `frozen-prefix.lock.json`
from current skill content, so intentional skill edits are a one-command
re-approval instead of a hand-edited JSON.

## Review

worklog/01-fact-based-eval.md

## Status

pending-retro
