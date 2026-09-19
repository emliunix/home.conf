---
name: visflow-findings
description: >-
  Project specific method on triage to root cause in visflow: reproduce before accepting, five
  whys, fix or record with the evaluating file, subtract before adding, regression check. Use
  in visflow when a defect, a review or an interrogation lands; not when the task is to log a
  finding without fixing it or recording its disposition.
---

# Findings

1. **Reproduce** the claim against the tree before accepting it (reviews are evidence-based; cite file and symbol).
2. **Triage**: fix it, or record it as a canon limitation **with the evaluate that shows it**. Recording it and moving on leaves the next reader to rediscover it.
3. **Root cause** — ask why the enabling rule allowed the defect (five whys); prefer deleting the mechanism to adding a guard.
4. **Regression check** — the fix lands with the check that would catch it again (see `visflow-gate`); if that check flips for a wrong reason, it is a new finding.
5. **Disposition row** — the finding and its disposition go where the next round will look (`worklog/next.md`, the tree’s `decisions.tsv`).

A property measured from one sample is not a property: repeat it or label it a sample.

## References
`method.md` · *Rules that are ours*; `worklog/next.md` (the open list where dispositions live).
