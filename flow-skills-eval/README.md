# flow-skills-eval

A Vite+ + Vieval evaluation project for the three `flow-*` skills in the parent
`home.conf/skills` directory:

- `flow-common` — lifecycle, roles, and implementation gate
- `flow-grill-review` — independent review gate
- `flow-retro` — evidence-backed loop closing

## Design

Each Vieval case has two context tiers:

1. **Tier 1 — frozen shared context**: role, task, and the full skill bodies
   inlined in stable order.
2. **Tier 2 — case context**: an inline fixture plus a question.

The agent answers by calling `submit_decision`. Grading is field-by-field
`compareDecision`. There is no free-text concept list.

`createFrozenPrompt()` builds Tier 1 and hashes it. `frozen-prefix.lock.json`
fails closed if skill text or the prefix drifts. After an intentional skill
edit, re-approve with `vp run lock:update`.

Unit tests cover skill loading, L0 contract lint, Decision parse/compare, and
corpus well-formedness. Live L1 cases are the Vieval task.

## Setup

```bash
cp .env.example .env
# set FLOW_SKILLS_EVAL_API_BASE_URL, FLOW_SKILLS_EVAL_API_KEY, FLOW_SKILLS_EVAL_MODEL
vp install
```

The runner reads exactly those three keys. Missing any is a refuse.

## Commands

Drive this project with the `vp` CLI, not `npm run`.

```bash
vp test --run                  # L0 + Decision + corpus unit tests
vp run eval                    # live L1 cases
vp exec vieval run --config ./vieval.config.ts
vp build                       # type-check and bundle the Vite shell
```

Live evaluation requires all three `FLOW_SKILLS_EVAL_*` keys in `.env`.
Results can be written with Vieval's `--report-out` option:

```bash
vp exec vieval run --config ./vieval.config.ts --report-out .vieval/reports
```
