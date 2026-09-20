# report-style — changelog

One row per change: date, what changed, the finding that caused it, and the record that showed it. Records
live in `visflow/worklog/report-style-review/` and, for the trials, `visflow/worklog/report-style-trials/`.

| date | version | change | finding | record |
|---|---|---|---|---|
| 2026-09-19 | v0 | created: the two shapes, the one warrant rule, Variant A's order and legend, Variant B's nine elements | — | — |
| 2026-09-20 | v1 | − the *"durable artifact"* premise from the description; − the Order section and the Checklist section (each restated material already present); the two variants stated under one rule | the premise made the **brief** read as a fallback for the record, when the brief is the common case in chat; the cut sections were the skill's own subtraction rule applied to itself | commit `5e6e296` |
| 2026-09-20 | v1 + furniture | tests added: `DESIGN.md` (r2), `rubric.yaml`, `cases/trigger.yaml`, `cases/production.yaml`, `frozen.lock.json`; this file and `README.md` | round-1 design review (two seats, ten findings, all reproduced): the oracle was unscoreable as specified and the pinned source set was overstated | `worklog/report-style-review/round-1-adjudication.md` |

**Open at v1:** whether `report-style` should carry `disable-model-invocation` — the trigger trial decides,
and the row lands here either way. Whether `T-PARA` generalises without its vocabulary is the trial's
second open question.
