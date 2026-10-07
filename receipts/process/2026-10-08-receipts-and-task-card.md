# Receipt — governed receipts and task-card template

## Review handoff — receipts and task-card template

- **Object:** base `a0ce20e8` -> engine commit `0657666`; branch tip and tree are returned with the review handoff
- **Artifact:** `receipts/process/2026-10-08-receipts-and-task-card.md`
- **Identity:** `doc-verify/lib/receipt.yaml` resolves at the branch tip
- **Evidence class:** established
- **Selected check:** `npm test` -> 24 files / 201 tests; `receipts/**/*.md` draft check -> PASS
- **Reviewer action:** inspect
- **Residual / decision needed:** none
- **Correction class:** behavior

The receipt surface is defined by [`.doc-verify.yaml`](../../.doc-verify.yaml) and
documented in [`receipts/README.md`](../README.md). The reusable task card is
[`skills/raft-group-chat/templates/task-card.md`](../../skills/raft-group-chat/templates/task-card.md).
