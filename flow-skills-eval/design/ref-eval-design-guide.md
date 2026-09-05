# ref — Skill-eval design guide

Durable guidance for designing and authoring evals of agent skills (the
`skills/*/SKILL.md` contracts). The specific redesign that first applied this
guide is `design/01-fact-based-eval.md`; this file owns the principles, the
layer structure, and the case-authoring rules.

## Principles

1. **Assert behavior, not text about behavior.** The unit of assertion is a
   machine-checkable fact: a structured decision, a cross-skill invariant, a
   resulting filesystem state, a usage metric. Never grade by matching expected
   vocabulary in free text — that passes wrong answers containing the right
   words and fails right answers in different words.
2. **A case exists to catch a named wrong route.** Before authoring a case,
   write down the specific wrong decision it falsifies. If no plausible wrong
   answer exists, the case measures nothing.
3. **Spend model calls only on producing decisions, never on grading them.**
   Grading is deterministic code. Anything checkable from the checked-in text
   alone costs zero model calls.
4. **Cheapest layer that can falsify the claim.** Every case belongs to exactly
   one layer (below); promoting a case to a more expensive layer requires a
   reason the cheaper layer cannot observe.
5. **Efficiency is measured, not asserted.** Token counts, cache-read tokens,
   and latency are emitted as metrics per case; claims like "the prefix is
   cached" must be visible in the run output.
6. **Fail closed on drift, accept drift in one command.** Content locks
   (hashes) detect skill edits; a scripted regeneration path accepts
   intentional ones. Detection without acceptance turns every edit into
   friction; acceptance without detection hides behavioral drift.
7. **Grade against the consumer model.** Default the eval to the model family
   that actually runs the skills; cheaper models are an explicit override for
   local iteration only.

## Structural design: three layers

### L0 — Contract lint (pure TS, zero model calls, every run)

Cross-skill invariants asserted against the SKILL.md texts in the unit-test
suite. Canonical checks:

- Every section one skill instructs the agent to write to exists per the owning
  skill's spec.
- Each lifecycle status word is set by exactly one skill's gate.
- Every dispatch phrase / skill mention resolves (or is explicitly declared to
  imply no separate file).
- Frontmatter descriptions mention every dispatch phrase the body claims.

### L1 — Structured decision cases (one model call each, smoke + full)

A fixture (concrete repo-state snippet) plus a question, answered via a
provider-enforced JSON tool call, graded field-by-field in TS. The shared
system prompt inlines the full skill bodies (the cacheable frozen prefix); the
per-case fixture+question is the only divergent suffix. Cases run
concurrently after one warm-up call.

### L2 — Sandboxed end-to-end (release-level only)

A real agent run against a temp-dir fixture repo; assertions are on the
resulting filesystem (files changed, `Status:` lines, worklog appended not
overwritten, supersession markers). Reserved for skill releases.

## Case-authoring rules (L1, and UT fixtures)

1. **State a fact, not a rule.** The fixture shows a state; the question asks
   for a decision. Never ask the agent to recite what a skill says — recitation
   cases measure memory of the prompt, not application of the contract.
2. **Author triplets per behavior:** *canonical* (straightforward),
   *trap* (fixture invites the forbidden route using correct vocabulary — kills
   false positives), *paraphrase* (no skill terminology — kills false
   negatives).
3. **One decision per case.** A case asserting two transitions can pass
   half-right; split it.
4. **Cite the rule.** Each case carries the `SKILL.md` line making its expected
   decision correct, so cases die traceably with the rules they test.
5. **Fixtures are inline strings**, deterministic and diffable; unit tests
   assert each fixture is itself well-formed.
6. **Fixture construction is free or it's wrong.** If establishing the
   precondition ("agent has read the skills") costs live calls, restructure so
   the precondition is built into the prompt instead.
7. **Coverage floor:** one triplet per gate transition, per routing fork
   (implementation defect / bounded correction / architecture failure / P0
   violation), per budget behavior, and per write-target rule.

## Profiles

- **smoke** — L0 + L1 canonical cases; runs on any skill edit.
- **full** — all L1 triplets + L2; runs at release or on structural skill
  changes.
