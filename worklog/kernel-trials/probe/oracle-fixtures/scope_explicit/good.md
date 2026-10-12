# 03 - Companion-driven document verification

## User inputs

The owner clarified the adjacent-file convention and its role:

> So we had the convention a md file is accompanied by a yaml file, part of it
> is plain file metdata, and we have the room to design the rubrics and rubrics
> based complex verification strategies there.

The owner then identified the automation path:

> 1. prek configured to call us with glob style inclusion filtering of changes
> 2. those doc changed can be deteced for per doc verification config in yaml
> 3. and automated with our jev + prolog + md segementation verification pass

The pairing remains advisory rather than a repository-wide hard gate:

> we can warn instead of fail the whole

The committed project config stays general. The local override points at the
protected env file:

> what about local config override points to that env file yet the project
> commited to repo stays general

The owner selected the dotenv name for that pointer:

> why not just .env.doc-verify

## Problem statement

The verifier can discover an adjacent YAML file, but it currently consumes only
its rubric pointer and dependency list. Prek either starts the verifier for
every staged change or risks hiding shared-policy invalidation behind an
incomplete filename filter. Authors therefore cannot yet express a complete
per-document verification profile in the established companion file, and a
missing companion has no visible but non-blocking diagnostic.

## Scope - what we touch

- Make the same-name YAML companion a typed, machine-readable verification
  manifest while Markdown remains authoritative for document meaning.
- Add a warning-only diagnostic channel for missing companions, with fallback
  to repository document defaults.
- Add inherited `verification` strategies with `draft` and `promotion`
  profiles, a shared rubric root, default section selection, and cache policy;
  allow only bounded per-document additions and overrides.
- Let a broad Prek file filter avoid irrelevant invocations while
  `doc-verify --staged` remains authoritative for the exact changed and
  dependent closure.
- Add rubric and companion references to the baseline-plus-candidate dependency
  graph so shared YAML changes select their actual consumers.
- Preserve the existing Markdown segmentation, bounded JEV batch, restricted
  DML, ordered Prolog verdicts, report identities, and CLI modes.

Non-goals are arbitrary commands from YAML, arbitrary DML, a general workflow
language, making the companion authoritative for prose decisions, treating a
warning as a failing verdict, or relying on Prek's filename list as the Git
snapshot.

## Rationale

The automation has three selectors with different authority. Prek performs a
cheap coarse activation. The verifier captures the Git index and computes the
affected graph. Each affected document's companion then selects the bounded
verification profile. This keeps normal commits cheap without allowing hook
filtering, deleted links, or shared rubric changes to hide affected documents.

The companion is a declarative control plane rather than executable code. It
may choose among verifier capabilities and compose rubric references, but the
TypeScript implementation owns allowed stages and the deterministic verdict
rules. A missing companion is useful adoption feedback, not proof that the
Markdown is invalid, so it emits `WARN` and uses repository defaults.

## Trigger and snapshot contract

Prek uses a broad regular expression covering Markdown and YAML. The local hook
also covers verifier implementation and package changes. `pass_filenames` stays
false: Prek decides only whether to start the process, while `--staged` reads
`git diff --cached` and index blobs itself.

The verifier classifies changed paths after capture:

| Changed path | Affected root |
| --- | --- |
| Configured `X.md` | `X.md` |
| Adjacent `X.yaml` | `X.md` |
| Shared rubric YAML | Every document whose resolved reference graph reaches it |
| Configured global invalidator | Every configured document |
| Unrelated file admitted by the coarse filter | Empty closure and zero semantic calls |

The reverse closure is computed over the union of baseline and candidate
graphs. Document nodes link to their companion, Markdown dependencies, declared
`depends_on` documents, and the applicable repository verification strategy.
YAML strategy nodes link through `verification.inherits`, local rubric
inheritance, and profile rubric references. All
declared roots enter the graph, not only the root active in this invocation.
This preserves consumers of deleted or retargeted references, keeps
companion-less fallback consumers attached to their governing rubric, and
prevents a dormant promotion policy from becoming invisible to changed-file
selection.

## Companion contract

For `path/X.md`, the verifier looks for `path/X.yaml`. Absence emits one warning:

```text
path/X.md:1 [@document] metadata.missing-companion WARN no adjacent companion; using repository defaults
```

The warning is present in text and JSON reports, increments `warningCount`, and
does not affect the artifact or repository verdict. The repository document
rule supplies the fallback rubric and semantic profile.

Configured subtrees use one strict verification schema inside an open
project-owned companion. `verification` is the executable entrance; it inherits
a complete shared strategy and may add a document-local rubric block or profile
override:

```yaml
schema_version: 1
kind: document-contract
document:
  path: design/03-companion-driven-document-verification.md
  kind: design
  status: landed
  depends_on: [goals/02-companion-driven-document-verification.md]
verification:
  kind: jev-prolog
  inherits: ../doc-verify/contracts/design-strategy.yaml#verification
  rubrics:
    kind: jev
    threshold: 0.9
    items: [] # optional document-specific additions
commands:
  - npm test
evidence_level: E2
```

The inherited file has `kind: verification-strategy` and a
`verification.kind: jev-prolog` block containing the shared rubric,
`default_profile`, and `draft`/`promotion` profiles. Resolution walks that
single inheritance chain base-first. A companion may only add or tighten its
local rubric and override named profile fields. Duplicate rubric item ids,
lowered thresholds, cycles, wrong discriminators, unknown verifier-owned fields,
document-path mismatches, and artifact-kind mismatches are usage errors.

The schema boundary follows ownership. Dedicated `.doc-verify.yaml` and
`verification-strategy` files are closed. In a companion, the verifier consumes
`schema_version`, `kind`, `document.path`, `document.kind`, optional status and
dependencies, and the closed `verification` subtree. Other top-level and
`document` fields are project-owned and ignored. Commands, evidence,
`evidence_level`, freshness, and domain metadata therefore sit outside
`verification`; the verifier neither validates nor executes them. Complex
verification stays in one typed strategy tree rather than distributing related
rubric and profile inheritance across separate entry points.

Resolution is field-specific:

| Field | Precedence | Reference base or fallback |
| --- | --- | --- |
| Verification strategy | companion `verification.inherits`, repository document rule | Inheritance is relative to the declaring YAML; the companion is the executable entry when present |
| Rubric root | CLI `--rubric`, active profile `rubric`, resolved strategy rubric chain | CLI and profile references are repository-relative; rubric `inherits` is relative to its declaring YAML |
| Sections | repeated CLI `--section`, active profile `sections`, rubric applicability | No explicit selection means the rubric selects from all sections |
| Cache | CLI `--refresh`, active profile `cache`, `reuse` | `refresh` bypasses reads but writes the new attestation |

`auto` first resolves to `draft` or `promotion` from the existing lifecycle
rule, then applies that companion profile. An explicit CLI profile applies to
every artifact in the computed closure; it is intentionally a repository-check
override rather than a named-root-only override. Artifact-level evidence may be
reported separately from the aggregate verdict when reviewing one design.

An invalid companion or strategy is a usage error. A missing companion is only a warning.
This distinction prevents malformed policy from silently degrading to defaults
while allowing gradual companion adoption.

## Local credential

Committed `.doc-verify.yaml`, shared strategies, and the hook contain no
machine path and no secret. At the repository root, a gitignored
`.env.doc-verify` is the local pointer to the protected credential file. The
established shape is a symlink to that file. The shared file stores `API_KEY`.
`doc-verify` copies that value into `TYPESAFE_API_KEY` for the current process.
An already-set `TYPESAFE_API_KEY` wins. A process-wide `API_KEY` is ignored.
A missing file leaves structural checks unchanged. A semantic call without a
key stays `BLOCKED`. An unreadable file is `BLOCKED` and the error names only
the file and the system error code.

## Verification execution

For every affected document:

```text
candidate Markdown + companion/default profile
  -> Markdown AST and stable section IDs
  -> selected rubric chain and selected sections
  -> deterministic structural findings
  -> exact semantic request identity
  -> cache hit or one typed JEV batch
  -> restricted generated DML
  -> ordered Prolog verdict and trace
  -> findings, warnings, counts, and exit code
```

Section selection changes the semantic evidence, not document-level structural
requirements. An explicit selection with no applicable rubric item remains a
usage error. A missing critical section remains `NO-GO`. Evidence or provider
unavailability remains `BLOCKED`.

One JEV batch is allowed per affected artifact. Unchanged selected evidence may
reuse a fresh exact attestation. A companion or rubric change alters the
request identity or affected graph as appropriate. No confidence score grants
`PASS`.

## Report contract

Warnings are separate from findings:

```ts
interface WarningDiagnostic {
  path: RepoPath;
  line: number;
  sectionId: SectionId;
  ruleId: string;
  message: string;
}
```

Each artifact has `warnings`; the top-level report has `warningCount`. Text
prints `WARN` records before failing findings. JSON contains neither Markdown
bodies nor provider response bodies. Existing verdict precedence and exit codes
do not change.

Concise text remains the default for scripts. `check --verbose --format text`
is the operator and agent feedback path. It prints the invocation scope and,
for every affected artifact, its kind, profile, verdict, resolved rubric chain,
the shortest project-defined impact path from a changed root, and each expanded
rubric question with the exact Markdown section ids it uses. A promotion result
also prints the typed answer for every question, semantic request id, call/cache
counts, and the deciding Prolog rule. Draft output marks the same expanded
questions as planned rather than implying that JEV ran.

The provider hook invokes `--verbose`. A consuming Prek entry also sets
`verbose: true`, because Prek otherwise captures successful hook output. The
combination makes detailed verification visible directly during commit while
retaining the same machine-readable JSON report and verdict exits.

## Verification design

| Property | Failure witness | Command |
| --- | --- | --- |
| Missing companion is advisory | A Markdown file without `X.yaml` exits nonzero or lacks a stable warning | `npm test -- companion` |
| Invalid companion is not ignored | Malformed strategy YAML silently falls back | `npm test -- companion` |
| Precedence and safety | CLI overrides, profile values, companion rubric blocks, reference bases, and defaults resolve in the wrong order | `npm test -- strategy` |
| Shared rubric changes select consumers | A changed inherited rubric omits a referencing document or evaluates unrelated documents | `npm test -- snapshots` |
| Prek is only a coarse trigger | An unrelated file invokes the hook, or a Markdown/YAML policy change bypasses it | `npm run test:remote-hook` |
| Commit feedback is inspectable | A passing hook emits only an aggregate line, hides rubric/section scope, or omits the Prolog decision after promotion | `npm test -- cli && npm run test:remote-hook` |
| Staged semantic path composes end to end | A staged promotion fixture does not produce exactly one real JEV call and a Prolog `PASS`, or its artifact result is hidden by another closure member | `DOC_VERIFY_LIVE=1 npm run test:remote-hook` with the external credential loaded by reference |
| Existing trust boundary holds | Multiple JEV calls, fallback LLM use, unsafe evidence, or confidence-driven PASS becomes reachable | `npm test -- semantic rules confidentiality` |
| Current artifacts pass | Companion profiles cannot drive the existing design and goal checks | `npm run check` |

The deterministic gate is `npm test && npm run typecheck && npm run lint`.
Promotion evidence includes an uncached live check of this design after the
implementation is final. The design artifact must pass even if another
dependent artifact produces an aggregate non-pass. The staged-consumer live
witness uses a temporary repository with one reviewed fixture, inherits the
external credential by reference, requires one semantic call, and requires the
deciding Prolog rule `all.required.facts`.

## Goal

goals/02-companion-driven-document-verification.md

## Review

worklog/03-companion-driven-document-verification.md

## Status

landed
