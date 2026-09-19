# visflow-evaluate — changelog

One row per change: date, what changed, the finding that caused it, and the record that showed it.

| date | version | change | finding | record |
|---|---|---|---|---|
| 2026-09-19 | v0 | created: the six-step evaluation workflow, the cases table, the trigger triplets | — | — |
| 2026-09-19 | v1 | coverage table rewritten to say what each cited artifact **is**; the round-verdict row deleted; the read-only rule marked newer than every exemplar; the Agreement Map, the no-unbacked-attribution rule and the follow-up verification round added; the author-seat tension flagged in step 2; cites, trap count and `distractor_set` fixed | the skill was evaluated by three seats (`v4-pro`, `kimi-k3`, `glm-5.3`) on one prompt: **three of five coverage rows were overstated**, `R-SET` is red on two of the four interrogation records, and the committed-instrument rule is violated by every exemplar it cites | `worklog/evaluate-skill-1.md` |

**Queued, with the reason** (entry-surface change → needs a trigger run, not a reading): add the two missing case kinds (a tree record, a round verdict) to the `description`.

**Shipped without case files, deliberately:** `procedure`, `coverage` and `record` name arms but ship no cases, so those arms will invent theirs. The first experiment that produces them is ranked in the verdict (`worklog/evaluate-skill-1.md`).
