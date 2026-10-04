# orient — design philosophy and dimensions

**What it is.** The method for entering a repository that keeps a spine — a constitution, a README with a status table, a method document, and owning design documents — and for deciding what governs when two of its documents disagree. `SKILL.md` is the artifact; this package is its instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

1. **Spine first.** The constitution, the README, the method document, then the document that owns the claim. Acting on a diff before the owner is read is acting on a paraphrase.
2. **One statement per fact.** A fact with two homes drifts; the second copy is a defect even while it agrees.
3. **The owner decides.** Precedence is the one the method states; absent that, the status table's owner wins over any restatement.
4. **Environment facts are measured, not remembered.** A prior session's port, server or route is a hypothesis.
5. **Roles, not paths.** The skill names roles; the repository's AGENTS.md binds them to files, and a missing binding is a finding.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the entry surface fire on entering a spine-kept repository or on a precedence dispute, and stay silent when the owner is already named? | trigger pass over `tests/cases/trigger.yaml` triplets |
| **procedure** | does an agent read the spine in order, find the owner, apply the stated precedence and verify environment facts by running them? | entry-only vs full arm on the same request; the trajectory is checked for order, owner, precedence and an environment command |
| **production** | does the answer cite the owning document, and does a disagreement land as a finding? | review of the produced answer and record |
| **ablation** | does each step earn its place? | full vs full-minus-one-step on the same request |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`.

## What it refuses

Work whose owning document is already named; reconciling two disagreeing documents silently; carrying a prior session's runtime facts forward; inventing a spine file the repository does not have.
