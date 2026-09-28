# Companion-driven document verification - CLOSED-GREEN (2026-09-24)

## Goal

Make the adjacent Markdown/YAML convention drive selective automated document
verification from Prek through section-scoped JEV and deterministic Prolog,
while treating a missing companion as a visible warning rather than a failing
repository condition.

## User requirements - frozen root

### R1 - Companion YAML is the document control plane

> So we had the convention a md file is accompanied by a yaml file, part of it
> is plain file metdata, and we have the room to design the rubrics and rubrics
> based complex verification strategies there.

Each key Markdown file may use a same-name YAML companion for ordinary metadata,
dependencies, rubric composition, and bounded verification strategy selection.
Markdown remains authoritative for document meaning.

### R2 - Automate from changed files through Prek

> 1. prek configured to call us with glob style inclusion filtering of changes
> 2. those doc changed can be deteced for per doc verification config in yaml
> 3. and automated with our jev + prolog + md segementation verification pass

Prek performs coarse inclusion filtering. The verifier captures staged files,
loads each affected document's YAML configuration, segments Markdown, evaluates
the selected rubric with bounded JEV facts and deterministic Prolog rules, and
prints actionable diagnostics.

### R3 - Missing companions warn

> we can warn instead of fail the whole

Missing companion YAML produces a visible warning and repository-default
fallback. It does not produce a failing verdict or exit code by itself.

### R4 - One strict strategy contract per configured subtree

> So by learning we mean it's a standardization process, we should not
> complicate our code, we can just change target repo's organization.
>
> And use things like typed discriminators to better organize our code
>
> and a uniformed yaml schema for that subtree, and reject invalid directly
> instead of trying to accept it

Repository adoption migrates one configured subtree to the strict
`document-contract` verification schema. The verifier does not carry parsers
for historical verification shapes; explicit `kind` discriminators select the
current contract, and malformed verifier-owned fields are rejected.

### R5 - Verification is the inherited entry

> The verification and rubrics.inherits: ../.doc-verify/rubrics/design.yaml#rubrics
>
> do we lost the same inherits for verification, is verification the entrance for us?
>
> In principle, a set of docs should inherits the single criteria with say
> minimal overrides addition per doc yaml

`verification` is the executable entry. Documents in one class inherit a
single shared JEV/Prolog strategy; each companion carries only document
metadata, evidence commands, and genuine local rubric additions or profile
overrides.

### R6 - Commit-time verification is a feedback mechanism

> It should not be this one line summary. So it's intended as a major feedback
> mechanism for agnetic coding, so at least we should provide --verbose as an
> important path to give details directly on commit.

The CLI has an explicit verbose text mode. The installed Prek hook requests it,
and consuming hook configuration keeps successful output visible. A commit-time
run reports affected documents, each artifact's profile and verdict, the
project-defined impact path from a changed root, resolved rubric chain,
question-to-section scope, and any JEV/Prolog decision trace rather than only
an aggregate pass line.

### R7 - Universal schema stops at verifier ownership

> So as the process to enforce universality we need to define our schema of
> yaml (only the fields we care, so leave other fields under project's control)

Dedicated verifier configuration and strategy files are closed schemas. A
document companion is open at its project-owned top level and inside its
`document` metadata, while the `verification` subtree, profiles, and rubric
blocks are closed and rejected on unknown or invalid fields. The verifier
validates and retains only document identity, status, dependencies, and its own
verification policy; commands, evidence records, freshness, and other metadata
remain project-controlled fields outside `verification`.

## Additions to the root

None.

## Design files

- `design/03-companion-driven-document-verification.md` - covers R1-R7 - admin source: this goal

## Dependencies

- Design 03 builds on landed Design 02 and commit `0fa6dea`.
- No other workstream depends on this increment.

## Workstreams

- **Companion-driven verification** - `design/03` - `landed` - covers R1-R7

## Workflows

### design/03-companion-driven-document-verification.md - landed

- **Admin source:** `goals/02-companion-driven-document-verification.md`
- **Covers:** R1-R7
- **Scope:** companion schema, affected selection, Prek trigger, verifier execution and reports
- **Depends on:** landed design/02
- **Loop:** `flow-grill-review` -> implementation gate -> `flow-retro`
- **Gate:** missing-companion warning, profile precedence, shared-rubric closure, remote hook, deterministic suite, and live promotion evidence pass

## AC coverage

| Row | Evidence required |
| --- | --- |
| R1 | A companion profile changes rubric, section, or cache selection through the public CLI path |
| R2 | A staged consumer run selects affected documents and executes the existing segmentation/JEV/Prolog path |
| R3 | Missing companion emits `WARN`, uses defaults, and exits zero when no other finding exists |
| R4 | Unknown verifier-owned fields and mismatched path/kind discriminators are rejected; a migrated sandbox subtree passes |
| R5 | Six sandbox design companions inherit one strategy and may add local rubric/profile fields without copying the base |
| R6 | `--verbose` prints stable per-artifact rubric, section, and decision details; the installed sandbox hook exposes successful output during commit |
| R7 | Project metadata fields are accepted outside verifier-owned namespaces, while unknown fields inside `verification`, profiles, and rubrics fail |

## Rulings in force

- 2026-09-24 - The companion is a declarative verification control plane; Markdown remains meaning authority -> `design/03` §Companion contract
- 2026-09-24 - Missing companion is advisory; malformed present policy is an error -> `design/03` §Companion contract
- 2026-09-24 - Prek filtering is coarse; staged closure remains verifier-owned -> `design/03` §Trigger and snapshot contract
- 2026-09-24 - `verification` is the strategy entry; configured subtrees use one strict discriminated schema -> `design/03` §Companion contract
- 2026-09-24 - Verbose verification is the commit-time feedback path, not only a CI summary -> `design/03` §Report contract
- 2026-09-24 - Universality closes verifier-owned namespaces and leaves the surrounding companion metadata open to each project -> `design/03` §Companion contract

## Open threads

None.

## Worklog

`worklog/03-companion-driven-document-verification.md`
