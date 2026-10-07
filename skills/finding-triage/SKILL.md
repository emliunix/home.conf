---
name: finding-triage
description: >-
  Triage to root cause, and moving canon on evidence: reproduce before accepting, five whys, subtract
  before adding, fix or record with the evaluating file, a regression check, a disposition row; canon
  text moves record-first, only when an evaluating file selects the change, and the amended sentence
  cites it. Use when a defect, a review or an interrogation lands, or when canon text must move; not
  when the task is to log a finding without fixing it or recording its disposition, or when a review, a
  plan or a commit would move canon on its own.
---

# Findings

## Triage a finding

1. **Reproduce** the claim against the tree before accepting it, citing file and symbol. Reviews are evidence-based; a finding nobody reproduced is a report, not a fact.
2. **Root cause** — ask why the enabling rule allowed the defect (five whys). Subtract before adding: prefer deleting the mechanism to adding a guard.
3. **Fix or record** — fix it, or record it as a known limitation **with the evaluating file that shows it**. Recording it without that file leaves the next reader to rediscover it.
4. **Regression check** — the fix lands with the check that would catch it again (see `seeded-defect-gate`); if that check flips for a wrong reason, that is a new finding.
5. **Disposition row** — the finding and its disposition go where the next round will look: the project's open list, named by its spine, and the tree's decision rows (see `record-conventions`).

A property measured from one sample is not a property: repeat it, or label it a sample.

## Move canon

Canon is whatever the spine's status table marks current. It moves only on evidence:

1. **Record-first** — enumerate what has already been run about the sentence (the programme's evaluating files, its gate ledger) before amending it or relying on it.
2. **An evaluating file selects** — write the file that selects the change; canon moves only when such a file selects it, never because a review, a plan or a commit moved it.
3. **Amend and cite** — the new sentence cites that evaluating file.
4. **Correct in place** — a prediction the run contradicted is corrected where it stands, and the record says so.
5. **Ratchet the check** — the amended sentence gains or tightens the cell that would go red if it drifted (see `seeded-defect-gate`).

A document that contradicts the evidence is a defect. When an evaluation reverses a canon decision, amend the canon and cite the evaluation — never correct the evidence to fit the document.

## Worked instances

- In one project, canon was what an owning document's status line marked current (its model, architecture and theory documents); the evaluating files that could select a change were each programme's evaluation records.
- The trigger trials for this skill used an open-list item of exactly this shape: a reserved-budget counter to be either fixed or recorded as a canon limitation, against a trap that asked to mark a recurring bug done and move on.

## Project binding

The repository's AGENTS.md (or its equivalent) names the concrete files this skill refers to by role: the open list, the decision-row file per tree, the evaluating-file convention, the owning documents whose status lines define canon, and the gate ledger. Where one of these roles has no file, that absence is a finding to record, not a reason to invent one.
