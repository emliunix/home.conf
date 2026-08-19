---
name: goal-file
description: Write and maintain compact project sprint goal files that reference design tasks and worklog ledgers, distinguish open execution from closed work, and state the next project-driving action.
---

# Goal file

Use for a project goal/sprint file: `goals/*.md`.

## Purpose

A goal file is a compact execution plan. It answers:

- What is the project trying to finish?
- Which recorded tasks are in scope?
- What is complete, open, or blocked?
- What should happen next to drive execution?

## Required shape

Keep sections small and factual:

1. **Title / status** — current sprint and overall state.
2. **Direction** — what the project is driving toward; state what the file is and is not when useful.
3. **Open tasks** — concise numbered items, each referencing its design file or named task source.
4. **Next action** — prioritize the recorded tasks, plan execution, and dispatch the next wave.
5. **Worklog link** — link the accompanying ledger for receipts and history.
6. **Carried decisions / constraints** — only decisions that change execution.

## Status rules

- A design, probe, discovery pass, or starting assessment does not complete its named task.
- Do not call an epic complete until implementation, deployment, live verification, and acceptance are complete.
- State closed work briefly; do not repeat its history.
- Keep open tasks visible even when no wave is currently dispatched.
- If work is not active, say the next action is prioritization → execution planning → dispatch. Do not imply that a heartbeat is progress.

## Compactness rules

- Prefer one status paragraph and a short task list.
- Do not add role definitions, process manuals, review transcripts, detailed receipts, or historical narrative.
- Do not define workflow terminology such as parked/candidate unless it changes the immediate plan.
- Put detailed evidence and history in the linked worklog, not the goal file.
- Use design-file links as the task source of truth; do not duplicate design contents.
- Make direction explicit: what the project **is** driving toward and what it **is not**.

## Completion language

Use direct states:

- `CLOSED-GREEN` — implementation, deployment, live verification, and acceptance are complete.
- `OPEN` — work remains.
- `BLOCKED` — name the concrete dependency.
- `PARKED` — optional shorthand for not dispatched; do not treat it as complete.

## Accompanying ledger

Every substantial goal file should link its worklog ledger, for example:

`[worklog ledger](../worklog/rulings-YYYY-MM-DD.md)`

The ledger carries receipts, decisions, findings, dispatches, and detailed history. The goal file carries only the execution summary and pointers.
