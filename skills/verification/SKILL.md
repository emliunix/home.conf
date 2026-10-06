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

Commands (v2):

- `doc-verify check --all` — every configured document; exit 0 pass, 1 no-go, 3 blocked.
- `doc-verify check FILE [FILE...]` — named documents; a bare file works (`--paths` is the explicit form).
- `doc-verify check --staged` / `--range A..B` — the staged or ranged closure; the `prek` hook runs `--staged`.
- `--section ID` restricts to a section; `--profile draft|promotion|auto` chooses which constraints run (default `auto`).
- `--verbose` adds the proof tree and snapshot to the text report; `--format json` writes the record.
- `doc-verify segments FILE` — the stable section ids and their line ranges.

Do not treat `auto` as proof that a draft was reviewed. Treat `NO-GO`, `BLOCKED` and
`NEEDS-REVIEW` as distinct outcomes, and never turn model confidence into `PASS`.

### Type library

A document rule names a default `modules` list and may declare named `types:`. A
companion's `document.type` selects exactly one type, replacing the default; with no
`type` the default modules apply; an unknown type is refused, naming the declared
ones. The engine ships a type library (`doc-verify/lib/`), each type a module plus a
worked example (`doc-verify/lib/examples/`) to copy:

| Type | What it checks | Use it for |
|---|---|---|
| `doc-verify:references` | every link resolves (error); every backtick path resolves (warning) | any document; the base every type extends |
| `doc-verify:design` | a status word, a `## Goal`, a verification section whose claims name falsifiers, and altitude | a design / change contract |
| `doc-verify:goal` | the same shape for a goal file (status from the title) | an epic / goal file |
| `doc-verify:module-contract` | a `Public surface` section; current law, not history | a package's contract |
| `doc-verify:module-model` | content, as current law rather than history | a package's model |
| `doc-verify:module-properties` | properties stated as checkable claims | a package's properties |
| `doc-verify:module-verification` | every claimed property paired with its witnessing check and that check's limit | a package's verification |
| `doc-verify:worklog-record` | a dated record, not a standing rule (opt-in) | a worklog that must not become law |
| `doc-verify:runbook` | a `Commands` section, as current instructions | a project runbook |

Worklogs are opt-in. The `worklog/**` rule defaults to `doc-verify:references`; a
worklog whose companion sets `type: record` runs `doc-verify:worklog-record`. An
untyped worklog whose links resolve is decided without the judge key; the other types
ask the judge on `promotion`.

### Bringing a repository under contract

Setup, not invocation, is where adoption fails. Do these in order; details and
failure signs are in [doc-verify setup](references/doc-verify-setup.md).

1. Credential: link the protected local judge-key file as the gitignored
   `.env.doc-verify` at the repository root. The tool reads `API_KEY` from it,
   and an exported key takes precedence. With neither, every non-draft
   document reports `BLOCKED`. Never commit the file or copy the key.
2. Configuration: pin the provider hook to a revision that is published on its
   remote. Convert each companion of a configured document to the current
   `document-contract` shape first, because one old-shape companion aborts the
   whole run.
3. Baseline: run `check --all`, structure-only first, then with the judge.
   Get a ruling on every failure before installing the hook. Otherwise the
   setup commit, which touches the invalidation files, blocks itself.
4. Hook: install it with a persistently installed `prek`, then confirm that
   `.git/hooks/pre-commit` exists and runs. A `.pre-commit-config.yaml` alone
   runs nothing.

Verification modules are reusable policy, named by the `.doc-verify.yaml`
rule (`modules:`). Artifact Markdown owns artifact-specific decisions. Adjacent
metadata names the document and records commands or freshness; it does not
duplicate the document.

## Stop condition

Stop when each claimed outcome has fresh evidence at the required level, each
relied-on gate has a failure witness, and unresolved items are reported with
their actual verdict. Do not add checks for hypothetical risks.
