---
name: spine-orient
description: >-
  Spine-first onboarding and precedence in a repository that keeps a constitution, a README and
  owning documents: read the spine in order, one statement per fact, the owning document decides,
  environment facts verified by running them. Use when entering such a repository, or when two of its
  documents disagree about what governs; not when the owning document is already named.
---

# Orient

Read in this order, and do not act on a diff before the owning document is read:

1. **The constitution** (or the repository's founding document) — read first: the proposition, the commitment, the roots that do work, the falsifiers.
2. **The README** — the status table of what is current, the reading order it owns, and the pointer to the open list.
3. **The method document, where it has one** — how work is done here (records, rounds, gates, delegation) and the precedence order between documents.
4. **The document that owns the claim** — the one the status table names for the subject at hand. A file that restates the claim is not its owner.
5. **The machine-local environment note, if present** — ports, servers, model routes. Absence is normal.

## When two documents disagree

1. Apply the precedence order the method document (or the README) states. Where none is stated, the owning document named by the status table wins over any file that restates it.
2. **One statement per fact** — a fact stated in two places is a defect even while the copies agree: name the owner and point the other copy at it.
3. Record the disagreement as a finding (see `finding-triage`) rather than reconciling it silently.

## Environment facts

Verify environment facts empirically: run the command, read the port, list the process. Never carry a prior session's runtime assumptions forward — a port, a server or a model route that held yesterday is a hypothesis today.

## Worked instances (visflow)

- The reading order was once stated in three files; a blinded reader measured three contradictory orders. The order now lives once, in the README, and everything else points at it — the reason step 2 owns it.
- A later reader found a clause above the reading order telling them to start with the method instead: a second statement of one fact, in the same file, drifting from the first.

## Project binding

The repository's AGENTS.md (or its equivalent) names the concrete files this skill refers to by role: the spine order, the method document, the open list, the machine-local environment note, and the status table that names each owning document. Where one of these roles has no file, that absence is a finding to record, not a reason to invent one.
