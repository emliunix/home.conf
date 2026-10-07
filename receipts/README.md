# Receipts

`receipts/` is the centralized surface for dated intermediate work: commands,
measurements, decisions, review handoffs, and other evidence that a successor
needs but that is not standing law.

One receipt per topic:

```text
receipts/<topic>/<report>.md
```

The receipt is governed by `.doc-verify.yaml` as `artifact_kind: receipt`. Its
links and repository paths must resolve, and on promotion it must record
evidence rather than introduce a new standing rule.

The implementer-to-reviewer section uses the heading
`## Review handoff — <topic>` and carries the mechanical fields named by
`skills/flow-common/SKILL.md`: object, artifact, identity, evidence class,
selected check, reviewer action, residual/decision needed, and correction class.

This file is guidance, not a receipt. It is explicitly excluded from the
`receipts/**/*.md` document rule.
