# Design 00: the design-file guide

## Status

reviewed

## Goal

This file is the guide designs are measured against: every `design/NN-*.md` follows the
shape described here (the project skeleton).

## Problem statement

Decisions need a fixed home with a fixed shape, or they scatter across chat, memory and
code comments and die there.

## Scope — what we touch

This guide and the design files. Not the goals, not the worklog.

## Rationale

A design is a forward decision record: the problem, the scope, the chosen shape and the
verification plan, fixed before implementation. It carries the three heads — problem
statement, scope, rationale — and a Status section whose first line is one word of the
lifecycle vocabulary. After landing, its decision folds into `docs/` and the design stays
frozen.

## Verification

- `doc-verify check --all` passes on every design file, which enforces the heads, the
  status vocabulary and claim-level falsification; a design whose verification section
  names no witness fails.
- The rule-quality harness (`tools/rule_quality`) proves each constraint fails on a bad
  design, so the check above is not decoration.

## Review

worklog/verification.md holds the grill record for this guide.

## Goal

goals/00-goal-file-guide.md
