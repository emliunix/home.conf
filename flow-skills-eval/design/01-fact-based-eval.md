# 01 — Fact-based, efficient flow-skill evals

## Problem statement

The Vieval suite grades flow-skill application by substring-matching expected
vocabulary in free-text answers. That passes answers that prescribe a forbidden
route while containing the right words, fails correct paraphrases that lack the
exact phrase, and cannot observe the facts that matter: next action, status
write, and write target. We need evals whose unit of assertion is those facts.

## Scope — what we touch

- `flow-skills-eval/src/eval/*` — prompt assembly, agent loop, Decision grading
- `flow-skills-eval/evals/*` — case corpus and Vieval task
- `flow-skills-eval/tests/*` — deterministic layer, including contract lint
- `flow-skills-eval/vieval.config.ts` — calls the same env reader as the agent loop
- `flow-skills-eval/README.md` — documents that contract
- `flow-skills-eval/frozen-prefix.lock.json` and `flow-skills-eval/scripts/update-lock.ts`
- Non-goals: the flow skills themselves (edited separately), the goal-file skill,
  CI wiring, a judge-model layer, a temp-dir L2 sandbox agent (guide-owned, later).

## Rationale

The assertion unit is a structured `Decision` compared field-by-field, plus L0
invariants over checked-in SKILL.md text, plus usage metrics. Model calls exist
only to produce the Decision. Tier 1 inlines the skill bodies, so the “skills
are loaded” fixture costs zero live calls. Token counts and optional cache
reads are measured; they are not a pass/fail on provider capability.

## Assumptions

- **Observed:** live grading is `compareDecision` on a `submit_decision` payload
  (`src/eval/decision.ts`, `evals/flow-skills.qa.eval.ts`). Live agent is one POST
  (`src/eval/agent.ts`). vieval’s openai/xsai usage type exposes `prompt_tokens`,
  `completion_tokens`, `total_tokens`.
- **Inference:** the configured `/chat/completions` endpoint accepts tools and a
  required `tool_choice`.
- **TBD:** whether that endpoint populates `usage.prompt_tokens_details.cached_tokens`.
  Absence is recorded as metric `0`; it does not fail the run.

## Layers

`design/ref-eval-design-guide.md` principles 1–6 apply except where this file
overrides them. This file is the law for Decision shape, `CaseOutcome`, smoke/full
contents, L1 run shape (one POST, no warm-up barrier, cache is a metric), and
which forks exist. Guide L2, guide profiles, guide coverage floor, and
“concurrently after one warm-up call” are not this outcome.

### L0 — Contract lint

Zero model calls, every `vp test` run. Assert on the checked-in skill texts:

- Write-target sections one skill names exist per `flow-grill-review`’s
  design/worklog split.
- Each of `draft` / `reviewed` / `pending-retro` / `landed` is set by exactly
  one gate.

L0 does not prove the Problem statement. It is a cheap invariant.

### L1 — Decision

A `Decision` is the single outcome the flow skills prescribe for the fixture.

```ts
interface DecisionCase {
  id: string;
  kind: "canonical" | "trap" | "paraphrase";
  fixture: string;
  question: string;
  expected: Decision;
  /** SKILL.md path + location that makes `expected` correct. */
  cite: string;
  /** Wrong Decision this case exists to catch. */
  catches: string;
}

interface Decision {
  next_action: NextAction;
  status_to_set: StatusToSet;
  write_target: WriteTarget;
}

type NextAction =
  | "implement"
  | "remediate"
  | "open_new_design"
  | "run_retro"
  | "set_status"
  | "halt_structural"
  | "reject_finding";

type StatusToSet = "draft" | "reviewed" | "pending-retro" | "landed" | "unchanged";
type WriteTarget = "design_body" | "worklog" | "new_design_file" | "none";
```

**Who writes.** `expected` is immutable corpus data. `actual` is only the
`submit_decision` payload. The model does not supply derived flags.

**`next_action` — when this is the value**

| Value | When |
| --- | --- |
| `set_status` | The prescribed act is a gate status write (review pass → `reviewed`; impl pass → `pending-retro`). |
| `implement` | Design is `reviewed`; do the work. Status is not written in this decision. |
| `remediate` | Implementation defect inside the reviewed design. Status stays as-is. |
| `run_retro` | Implementation complete and evidence proves the outcome; dispatch the closing pass. |
| `open_new_design` | A `reviewed` / `pending-retro` / `landed` design is the wrong machine. |
| `halt_structural` | Implementer round would exceed 5. |
| `reject_finding` | Occupying reviewer: the finding is out of scope, speculative, or disproportionate. |

**`status_to_set`.** A lifecycle word means write that `## Status` line.
`unchanged` means do not write `## Status`. Re-emitting the fixture’s current
word is wrong; that is `unchanged`.

**`write_target`.** The non-Status artifact this action writes. Status is
`status_to_set`, never this field. `none` means no design/worklog/new-file
write (code-only `implement` / `remediate`). Operations that the skills split
across Status + worklog use `write_target: "worklog"` plus a non-`unchanged`
status.

**Required conjunctions** (corpus and grader refuse *violations* of these
implications, not the listed shapes themselves):

- `open_new_design` ⇒ `write_target: "new_design_file"` ∧ `status_to_set: "unchanged"`
- `write_target: "new_design_file"` ⇒ `open_new_design`
- `halt_structural` ⇒ `status_to_set: "unchanged"` ∧ `write_target: "worklog"`
- `implement` ∨ `remediate` ⇒ `status_to_set: "unchanged"` ∧ `write_target: "none"`
- `set_status` ⇒ `status_to_set ≠ "unchanged"` ∧ `write_target: "worklog"`
- `run_retro` (land close) ⇒ `status_to_set: "landed"` ∧ `write_target: "worklog"`
- `reject_finding` ⇒ `status_to_set: "unchanged"` ∧ `write_target: "worklog"`

A fork is not in the corpus until its expected tuple is unique under these rules.

**Case loop.** One POST to `/chat/completions`. Tools: only `submit_decision`
(the schema above). `tool_choice` required for that function. `askAgent` is the
only model client. vieval `ChatModels` is not a second agent loop.

**Case outcome** (closed; no retry, no nudge turn):

```ts
type CaseOutcome =
  | { kind: "ok"; decision: Decision }
  | { kind: "missing_submit" }
  | { kind: "invalid_arguments" }
  | { kind: "extra_tool" }
  | { kind: "api_error"; class: string };
```

Grade: `ok` + `compareDecision(expected, actual)` empty ⇒ pass; `ok` + named
field divergences ⇒ fail; any non-`ok` kind ⇒ fail as that kind. Lock drift
aborts the suite, not a case.

`compareDecision` runs only on two valid `Decision`s. Parse failure is
`invalid_arguments`, not a Decision.

The harness throws if the loop issues more than one HTTP call (construction
defect, not a skill-behavior grade).

## Minimum e2e

One live L1 case. All listed checks observe this case.

- **id:** `arch-failure-canonical`
- **kind:** `canonical`
- **fixture:** Design `03-parser.md` with the three heads, `Status: pending-retro`.
  Worklog records retro evidence: the parser cannot accept valid input X; the
  machine is wrong.
- **question:** What next action, status write, and write target do the flow
  skills prescribe?
- **expected:** `{ next_action: "open_new_design", status_to_set: "unchanged", write_target: "new_design_file" }`
- **cite:** `skills/flow-common/SKILL.md` Lifecycle — a `pending-retro` design that
  is the wrong machine is superseded by a new `design/NN`; never un-pended.
- **catches:** reset `03-parser.md` to `draft` / `status_to_set: "draft"`.

Checks on this case: one HTTP call, `CaseOutcome.kind === "ok"`, field match.

Smoke also runs the trap and paraphrase of this same behavior (same `expected`,
fixture that invites the reset-to-draft route; paraphrase with none of the
skill’s terminology).

## Corpus

One exported `DecisionCase[]`. Fixture well-formedness tests and the Vieval
task import the same `expected` object. There is no concept list, no
`minimumScore`, no fractional score, no `scoreAnswer`.

**smoke:** L0 + the `arch-failure` triplet.

**full:** smoke + one **canonical** per remaining unique tuple:

| id | next_action | status_to_set | write_target | catches |
| --- | --- | --- | --- | --- |
| `review-pass-canonical` | `set_status` | `reviewed` | `worklog` | implement while still `draft` |
| `impl-pass-canonical` | `set_status` | `pending-retro` | `worklog` | set `landed` without retro |
| `retro-land-canonical` | `run_retro` | `landed` | `worklog` | write retro prose into the design body |
| `round-budget-halt-canonical` | `halt_structural` | `unchanged` | `worklog` | start round 6 as another bounce |
| `impl-defect-canonical` | `remediate` | `unchanged` | `none` | open a new design for an implementation defect |
| `reject-finding-canonical` | `reject_finding` | `unchanged` | `worklog` | accept an out-of-scope finding as a work item |

Further trap/paraphrase triplets for those rows are not this outcome.

## Prompt and measurement

`createFrozenPrompt` inlines the full skill bodies in stable order. The lock
hashes those bodies. Tier 2 is fixture + question. The only tool is
`submit_decision`.

`readApiConfig` is the only env reader. It requires
`FLOW_SKILLS_EVAL_API_BASE_URL`, `FLOW_SKILLS_EVAL_API_KEY`,
`FLOW_SKILLS_EVAL_MODEL`. Missing any is a refuse. No other env names.
`vieval.config.ts` and `askAgent` call this function.

Per case, emit Vieval metrics:

- `prompt_tokens` ← `usage.prompt_tokens`
- `completion_tokens` ← `usage.completion_tokens`
- `cached_tokens` ← `usage.prompt_tokens_details.cached_tokens` (0 if absent)
- wall latency

No other usage keys are read. `cached_tokens === 0` does not fail the run.
Cases may run concurrently; there is no warm-up barrier and no “second case
onward” pass/fail.

**Lock.** `frozen-prefix.lock.json` fails closed on prefix or skill-hash drift.
`vp run lock:update` regenerates that lock from current skill content.

## Review

worklog/01-fact-based-eval.md

## Status

reviewed
