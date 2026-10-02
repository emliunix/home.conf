---
name: tool-calling-cookbook
description: >-
  Apply evidence-based rules when composing tool calls, parsing their output,
  interpreting non-zero exits, or turning repeated operations into durable
  routines. Use before or during tool-heavy work when a result will drive a
  decision, especially for transcripts, logs, structured output, guards, or
  service checks. Do not use for auditing a whole transcript corpus; use
  audit-agent-tooling for that procedure and this cookbook for its rules.
---

# Tool-calling cookbook

Read [`references/cookbook.md`](references/cookbook.md) when a tool result
will be counted, parsed, compared, or used as evidence. The reference is the
durable rulebook; this file exists to make the moment of use explicit.

Open it immediately when any of these conditions appears:

- a result will be parsed into a number, set, status, or decision;
- a command exits non-zero and the next action depends on why;
- the same query or pipeline is being composed again;
- a guard, wrapper, or gate is being credited with protection;
- a source is live and its count may change between reads.

Do not rely on remembering a rule. Read the relevant cookbook entry and apply
its discriminator to the actual output.
