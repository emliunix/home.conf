---
name: failure-pattern-library
description: >-
  Consult and extend a process failure-pattern library: the admission criteria, the evidence each entry
  must preserve, and the fields that make a criterion evaluable rather than aspirational. Use when a
  process or communication failure is found and must be captured, when deciding whether an observation
  qualifies as a pattern, or when checking whether a recorded pattern has recurred.
---

# Failure-pattern library

A library of process and communication failures, kept as **raw material for continuous improvement** of docs,
prompts, skills, and project setup. Use it two ways: **capture** a failure you just found, and **consult** what
is already recorded before adding a near-duplicate.

## The one path rule, and it governs this whole skill

> **This guide names NO specific project, repository, or PC path — only the general library root
> `~/Documents/process-failure-patterns/<project>/`.**

**Why it is first, and why it is a rule rather than a style note:** a skill is loaded into every session on
every host that links it, and a skill in a shared repository is public. **A literal path makes the guide true
on exactly one machine and stale on all others.** A dated capture about *this* project may name it; **guidance
about how to keep the library may not.**

⚠ **Apply the rule to the rule.** If this file, or a criteria list, names a path that is not the general root,
that is the defect the rule exists to prevent — including when the path looks familiar.

## Capture

1. **Preserve the smallest reproducible source.** A quoted fragment, a command and its output, a message id —
   not a paraphrase and not the whole transcript.
2. **Write the entry** against `references/entry-template.md`. **Fields are not decoration: a criterion you
   cannot evaluate is not a criterion.** If a field's data does not exist, record `not captured` rather than
   guessing it.
3. **Correct the process.** *A capture without the correction is a museum.* Name what changed — a doc, a
   prompt, a skill, a check — or record why no correction is warranted.
4. **Check for a near-duplicate before adding.** Search by **mechanism**, not by the rule's name; a rule is
   often carried as a citation rather than as a statement. If a sibling entry already states it, **link it
   rather than re-entering it** — a library that grows by re-entry stops being an index.

## Consult

- **Before asserting a rule**, check whether it is already recorded — and whether it was **retracted**.
  A retraction that reached only the artifact that prompted it leaves the false rule live in every sibling.
- **When counting the library**, state the predicate with the count. `grep -c` over an index counts prose
  *about* the entries as well as the entries.

## Criteria

See `references/criteria.md` for the admission and classification criteria, and
`references/entry-template.md` for the fields each entry carries. **Read both together**: a criterion in the
list whose field is absent from the template is unenforceable, and the template is where a new criterion
starts being real.
