# flow-skills-eval

A Vite+ + Vieval evaluation project for the three `flow-*` skills in the parent
`home.conf/skills` directory:

- `flow-common` — lifecycle, roles, and implementation gate
- `flow-grill-review` — independent review gate
- `flow-retro` — evidence-backed loop closing

## Design

Layered, fact-based evals (see `design/01-fact-based-eval.md` and
`design/ref-eval-design-guide.md`):

- **L0 — contract lint** (`tests/contract-lint.test.ts`): cross-skill invariants
  asserted against the checked-in SKILL.md texts — each lifecycle status word is
  set by exactly one gate, write-target sections referenced by `flow-common` /
  `flow-retro` exist per `flow-grill-review`'s design/worklog split, dispatch
  phrases resolve to frontmatter descriptions, and skill mentions resolve to
  checked-in skills. Zero model calls; runs in every `vp test`.
- **L1 — structured decision cases** (`evals/flow-skills.decisions.eval.ts`):
  each case is a repo-state fixture plus a question, answered in exactly one API
  call via the provider-enforced `submit_decision` tool carrying the Decision
  schema (`next_action` / `status_to_set` / `write_target` / `opens_new_design`).
  Grading is a deterministic field-by-field comparison that reports which field
  diverged. Cases are authored as canonical / trap / paraphrase triplets, each
  with a comment citing the SKILL.md line that justifies the expected decision.
- **L2 — sandboxed end-to-end** (release-level): not built yet. A real agent run
  against a temp-dir fixture repo asserting the resulting filesystem. TODO.

### Prompt tiers and efficiency

Tier 1 (frozen system prompt) inlines the full skill bodies — the cacheable
prefix. Tier 2 is the per-case user message (`<fixture>` + `<question>`), the
only divergent suffix. There is no `read_skill` tool and no sequential reading
ritual; each case is one API call. One unscored warm-up case runs first to prime
the provider prefix cache; its usage and latency are emitted as diagnostic
metrics, then scored cases run concurrently (the shared prefix is identical).

Per case, the eval emits Vieval metrics from the response `usage`:
`prompt_tokens`, `completion_tokens`, `cached_tokens` (OpenAI
`prompt_tokens_details.cached_tokens` or Anthropic `cache_read_input_tokens`),
and `latency_ms`. Cache-read enforcement is capability-gated on observability:
when the provider omits the cache-read field, the run warns and skips
enforcement — a missing field is never coerced to a failing zero. When the
provider exposes the field, a run-level check asserts at least one scored case
observed a nonzero cache read (per-case ordering is meaningless at concurrency
8, so the assertion is run-level, not per-case).

### Prefix cache: what makes reuse work

The cacheable prefix is the whole request head — the frozen Tier 1 system text
**plus** the tool schema, `tool_choice`, and the model/route. Reuse requires that
head to be **byte-identical** across calls; only the Tier 2 user message may
differ. What guarantees it:

- **Fixed per run.** `readApiConfig()` resolves one provider/model/route for the
  entire run (`src/eval/env.ts`), the system text is built once
  (`createFrozenPrompt`), and `tools` / `tool_choice` / `temperature` are module
  constants (`src/eval/agent.ts`). There is no per-case model, route, or tool
  override.
- **Fail-closed drift.** `frozen-prefix.lock.json` + `assertFrozenPromptLock`
  refuse the run if the skill text or Tier 1 hash changes; re-approve with
  `vp run lock:update`.

Caveats:

- **Provider-side, not local.** The harness holds no cache. Reuse is entirely the
  provider's; a provider without prefix caching yields `cached_tokens: 0`, and the
  run warns (capability-gated) rather than failing.
- **Cross-process, single model/route.** A separate process sending the identical
  prefix hits the same cache (verified: 11,392 of 11,896 prompt tokens cached on a
  second `node` process). The cache is **not** shared across different models or
  routes.
- **Eviction is provider-controlled** and time-bounded, so the warm-up must run
  immediately before the scored cases. The eval does this: an unscored warm-up
  case primes the cache, and scored cases `await warmupDone` before running
  concurrently.
- **Automatic vs explicit.** Some providers cache automatically (e.g. DeepSeek via
  a local gateway: `cache_write_tokens: 0`, cache read in
  `prompt_tokens_details.cached_tokens`); Anthropic needs `cache_control`
  breakpoints or a caching gateway to show real cache reads.

### Profiles

- **smoke** (default) — L0 lint plus L1 canonical cases; runs on any skill edit.
- **full** — all L1 triplets; run at release or on structural skill changes.
  (L2 will join this profile once built.)

Select with `FLOW_SKILLS_EVAL_PROFILE=smoke|full` in `.env` or the shell.

### Drift lock

`createFrozenPrompt()` builds Tier 1 as a deterministic system prefix and hashes
it. `frozen-prefix.lock.json` records the approved role/task/skill order and
hashes; Vieval and the unit tests fail closed if the loaded skill text or Tier 1
prefix drifts. After an **intentional** skill edit, re-approve the drift with
`vp run lock:update` (regenerates the lock from current skill content), then
re-run the tests.

The unit-test suite is fully deterministic: skill loading, prompt assembly,
contract lint, corpus invariants, and Decision parsing/comparison. No live API
calls happen under `vp test`.

## Setup

```bash
cp .env.example .env
# edit .env with the API base URL, key, and (optionally) model
vp install
```

The runner reads the project `.env`. The API key and base URL are never
hardcoded in source. The default eval model is `claude-sonnet-4-5` — the model
family that actually consumes these skills; set `FLOW_SKILLS_EVAL_MODEL` (e.g.
to `gpt-4o-mini`) only as an explicit cheap-mode override. For compatibility
with existing local setups, `src/eval/env.ts` also accepts `API_KEY`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PROVIDER_API_KEY` and matching base URL
names (including `OPENAI_API_BASE`) as fallbacks; the project-specific
`FLOW_SKILLS_EVAL_*` names take precedence.

A local OpenAI-compatible gateway (e.g. a Bifrost instance on
`http://127.0.0.1:8080`) works as-is — set the base URL, any non-empty key, and a
tool-calling model:

```dotenv
FLOW_SKILLS_EVAL_API_BASE_URL=http://127.0.0.1:8080/v1
FLOW_SKILLS_EVAL_API_KEY=local
FLOW_SKILLS_EVAL_MODEL=openai/deepseek/deepseek-v4-flash-0731
```

### Helper scripts

- `scripts/ask.ts "<question>"` — run one ad-hoc question through the real frozen
  Tier 1 + `submit_decision`, printing the Decision, raw arguments, usage, and
  latency. Useful for probing the skills without authoring a case.
- `scripts/cache-probe.ts save|load [file]` — demonstrate cross-process prefix
  cache reuse: `save` sends the frozen prefix and writes the messages array to
  `file`; `load` (a separate process) reads it, appends a turn, and prints the
  cache fields. On a caching provider the `load` call reports nonzero
  `cached_tokens`.

```bash
node --experimental-strip-types scripts/ask.ts "you find that the change surface is small, and the process is long, what should you do"
node --experimental-strip-types scripts/cache-probe.ts save /tmp/flow-cache-probe.json
node --experimental-strip-types scripts/cache-probe.ts load /tmp/flow-cache-probe.json
```

## Commands

This is a **vp (Vite+) based project** — always drive it with the `vp` CLI, not
`npm run`. The `devEngines` pin in `package.json` targets the npm version
bundled with Vite+; running `npm test` / `npm run eval` with a system npm fails
the devEngines check before any test executes.

```bash
vp test --run                  # deterministic unit tests (L0 lint, corpus, schema)
vp run eval                    # live L1 eval, smoke profile
vp run eval:full               # live L1 eval, all triplets
vp run lock:update             # re-approve intentional skill edits into the lock
vp build                       # type-check and bundle the Vite shell
```

Live evaluation requires `FLOW_SKILLS_EVAL_API_BASE_URL` and
`FLOW_SKILLS_EVAL_API_KEY` in `.env`; `FLOW_SKILLS_EVAL_MODEL` and
`FLOW_SKILLS_EVAL_PROFILE` are optional. Results can be written with Vieval's
`--report-out` option, for example:

```bash
vp exec vieval run --config ./vieval.config.ts --report-out .vieval/reports
```
