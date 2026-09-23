---
name: verification
description: >-
  Select and report evidence that can falsify a design or implementation claim.
  Use when writing a verification design, choosing test depth, reviewing whether
  evidence supports a claim, or configuring document-contract checks.
---

# Verification

Use the smallest set of checks that can disprove the load-bearing claims. Do
not turn this library into a checklist that every change must satisfy.

## Evidence levels

Name the level of every completion claim:

| Level | What was observed |
| --- | --- |
| E0 | Static structure, parsing, schema, or type behavior |
| E1 | Bounded behavior through a public function or command |
| E2 | A running local boundary with real serialization, process, or persistence |
| E3 | A live or deployed boundary observed from outside that boundary |

Evidence cannot support a claim above the boundary it exercised. A mocked
adapter may prove caller behavior at E1. It cannot prove provider availability
or protocol compatibility. A live call may prove that one request worked. It
does not prove unrelated semantics.

## Working method

1. Map each user requirement and material design property to one observable
   claim. Keep intent, technical decisions, and execution evidence in their
   declared canonical files.
2. Select only the relevant practices from
   [the practice library](references/practices.md). State why each selected
   check can falsify the claim.
3. Name the subject, input, observable, expected result, and failure witness.
   Use stable section names or program symbols for durable references. Add line
   numbers only as a current navigation aid.
4. Run the real boundary required by the claim. Record the exact command,
   artifact identity, and result in the worklog or attestation.
5. Mutate or supply one relevant defect for every gate relied on for acceptance.
   A gate that cannot turn red is not evidence.
6. Report the lowest proved evidence level and unresolved prerequisites. Keep
   review history and command output out of the current design body.

## Document contracts

When the repository has `.doc-verify.yaml`, use its `doc-verify` executable.

- Use `doc-verify segments FILE` to inspect stable Markdown section IDs.
- Use `doc-verify check --paths FILE --section ID --rubric PATH#FRAGMENT
  --profile draft` while authoring.
- Use `--profile promotion` for a review or lifecycle decision that depends on
  semantic evidence. Do not treat `auto` as proof that a draft was reviewed.
- Use the repository's `prek` hook for the staged changed-file closure. CI must
  repeat the committed range check.
- Treat `NO-GO`, `BLOCKED`, and `NEEDS-REVIEW` as distinct outcomes. Never turn
  model confidence into `PASS`.

Rubric YAML is reusable policy. Artifact Markdown owns artifact-specific
decisions. Adjacent metadata references a rubric and records commands or
freshness; it does not duplicate the document.

## Stop condition

Stop when each claimed outcome has fresh evidence at the required level, each
relied-on gate has a failure witness, and unresolved items are reported with
their actual verdict. Do not add checks for hypothetical risks.
