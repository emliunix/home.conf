# Design 00: the design-file guide

## Status

reviewed

## Goal

This file is the guide designs are measured against: every `design/NN-*.md` follows the
shape described here (the project skeleton).

Source: the project-skeleton skill in home.conf (skills/project-skeleton/SKILL.md), which
this guide is installed from.

## Problem statement

Decisions need a fixed home with a fixed shape, or they scatter across chat, memory and
code comments and die there.

## Scope — what we touch

This guide and the design files. Not the goals, not the worklog.

## Rationale

A design is a forward decision record: the problem, the scope, the chosen shape and the
verification plan, fixed before implementation. It carries a Goal that names where the
requirement came from, the three heads — problem statement, scope, rationale — and a Status
section whose first line is one word of the lifecycle vocabulary. A section that describes
how running code behaves today names the commit or version it was read at, or says the
statement is inferred. Its Scope names the module documents it changes; the decision
updates `docs/modules` before the code that implements it lands, and the design stays
frozen after landing.

## Verification

- `doc-verify check --all` passes on every design file. On a draft it enforces the Status
  section, the status vocabulary and the Goal section. From `reviewed` on it also enforces:
  a problem section and a scope section (`design-has-problem`, `design-has-scope`); a
  decision and a verification section; claim-level falsification (a verification item
  that names no witness fails); a Goal that cites its source (`artifact-goal-cites-source`);
  and, as a warning, a pinned base for every statement about today's code
  (`design-today-claims-pinned`). A `landed` design is a frozen record: checks added after
  it landed do not judge it.
- The rule-quality harness (`tools/rule_quality`) proves each constraint fails on a bad
  design, so the check above is not decoration.

## Review

worklog/verification.md holds the grill record for this guide.

## Goal file

goals/00-goal-file-guide.md
