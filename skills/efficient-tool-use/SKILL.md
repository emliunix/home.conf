---
name: efficient-tool-use
description: >-
  Apply evidence-based rules when composing tool calls, parsing their output,
  interpreting non-zero exits, or turning repeated operations into durable
  routines. Use before or during tool-heavy work when a result will drive a
  decision, especially for transcripts, logs, structured output, guards, or
  service checks. Topics live under this one handle. Do not use for auditing a
  whole transcript corpus; use audit-agent-tooling for that procedure.
---

# Efficient tool use

One trigger, topic-grouped rules. Read only the topic that matches the moment;
the topic files are the durable rulebook, not this routing surface.

## Topics

- **`efficient-tool-use/output-shape`** -
  [output-shape.md](references/output-shape.md): ask the owning surface for
  structure, search before reading, parse records rather than words, and make
  required arguments explicit.
- **`efficient-tool-use/result-interpretation`** -
  [result-interpretation.md](references/result-interpretation.md): put the
  discriminating field in the test, bucket non-zero exits by code, keep crash
  rate separate from correctness, and split by command before blaming syntax.
- **`efficient-tool-use/call-composition`** -
  [call-composition.md](references/call-composition.md): keep payloads out of
  command strings and block on a condition instead of polling.
- **`efficient-tool-use/reuse-and-protection`** -
  [reuse-and-protection.md](references/reuse-and-protection.md): save repeated
  operations, measure a guard's reach and activation, require identity rather
  than liveness, and record the read time for live evidence.

Open the matching topic immediately when a result will be counted, parsed,
compared, or used as evidence. Do not rely on remembering a rule.

## Evidence

Source case: **Tool-Pattern Mining and CLM Hands-On - 2026-10-02**, artifact
`pt_ef39716d-e324-49a8-a1fc-685c7e078ca6`, revision 5, based on 17,551 tool
calls across six transcripts.

The source report and its parsers remain the first case study. Add a rule to a
topic only when it changes a future decision and its evidence is reproducible.
Replace superseded rules in place rather than keeping contradictory versions.
