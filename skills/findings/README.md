# findings — design philosophy and dimensions

**What it is.** Two procedures with one root: a finding is accepted only once reproduced and is closed only by a fix or a recorded disposition, and canon — the text the spine marks current — moves only when an evaluating file selects the change. `SKILL.md` is the artifact; this package is its instrument (`flow-skills-eval/design/03-skill-package-format.md`).

## Philosophy

1. **Reproduce before accepting.** A review is evidence-based; the claim is checked against the tree, by file and symbol.
2. **Root cause, then subtract.** Ask why the enabling rule allowed the defect; prefer deleting the mechanism to adding a guard.
3. **Every finding is dispositioned** — fixed, or recorded with the evaluating file that shows it, and the row lands where the next round will look.
4. **Record first, then move canon.** Canon moves when an evaluating file selects the change, the new sentence cites it, and the check that would catch its drift is ratcheted.
5. **The evidence is never corrected to fit the document.** A document that contradicts the evidence is the defect.

## Dimensions

| dimension | the question | how it is measured |
|---|---|---|
| **trigger** | does the entry surface fire when a defect, review or interrogation lands, or canon must move, and stay silent on log-and-move-on and on canon moved by a bare commit? | trigger pass over `tests/cases/trigger.yaml` triplets |
| **procedure** | does an agent reproduce, find the root cause, fix or record, add the regression check and write the disposition row; and for canon, enumerate the record, cite the selecting file, correct in place and ratchet? | entry-only vs full arm on the same request; the commit and the rows are checked |
| **production** | does the fix land with a check that goes red on the defect, and does amended canon cite a file that actually selects it? | the regression check is mutation-tested; the citation is followed |
| **ablation** | does each step earn its place? | full vs full-minus-one-step on the same request |

Rubrics per dimension, each item naming the defect that must flip it, are in `tests/rubric.yaml`.

## What it refuses

Logging a finding without a fix or a disposition; accepting a claim nobody reproduced; adding a guard where deleting the mechanism would do; canon moved by a review, a plan or a commit on its own; evidence edited to fit the document.
