---
name: visflow-dispatch
description: >-
  Project specific method on handing work to children in visflow: fan-out with shared levers,
  one output file per child, adversarial red team, blinding, freeze while they measure, reuse
  keyed by topic and task kind. Use in visflow when a task is split across subagents, or a
  child that did the same kind of work on the same subject is reused.
---

# Dispatch

1. **Route per role** — take the model and effort from `pstack/pstack-models.md`, not from habit.
2. **Hand the spine, not a paraphrase** — the prompt names the reading order (constitution → README → method → the owning doc) and the repository’s own files; a summary measures the parent’s paraphrase, not the repo.
3. **One output file per child** — the child writes only that file; the tree is otherwise read-only.
4. **Reuse keyed by topic and task kind** — the same work on the same subject goes back to the child that holds the context. A fresh child is earned by blinding, independence, or a new topic — never convenience.
5. **Freeze while it measures** — edit nothing and commit nothing until the last child returns.
6. **Fan out with a shared lever** — write the recipe once as the artifact every delegate reads, and keep it outside their write scope.

## References
`method.md` · *Delegating work, and reusing a child*; `AGENTS.md` grounding rules; `pstack/pstack-models.md`.
