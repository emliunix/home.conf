# Constitution

## 1. Purpose

> Replace with the one proposition this project tests. It should be falsifiable by the
> project's own artifacts, not a mission statement.

## 2. The commitment, in one sentence

> Replace: one sentence a newcomer can repeat.

## 3. What follows from the commitment

> Replace: three to five consequences, each checkable in the artifacts.

## 4. The roots we stand on, and the work each does

- **The spine (this file and `docs/`).** Orients a newcomer and routes every question to
  its owning file; a root that routes nothing is deleted.
- **Designs (`design/NN-*.md`).** Decision records: the model, the decision, the
  verification plan, fixed before implementation.
- **Goals (`goals/NN-*.md`).** Bookkeeping: anchored requirements, workstreams, coverage.
- **Worklog (`worklog/`).** Dated process evidence; never law.
- **The gates (`tests/`, `tools/rule_quality/`).** The checks that fail loudly when a
  claim above stops being true.

## 5. How we treat the project

> Replace: the working rules (peer review, claim-before-work, verify-don't-trust).

## 6. What would falsify the commitment

- A freshly bootstrapped project whose `doc-verify check --all` or `pytest -q` is red
  out of the box, with no local edits.
- A gate that stays green when its seeded defect is planted (observed in the
  rule-quality harness output).

## 7. Division of labour

> Replace: who implements, who reviews, who owns rulings.
