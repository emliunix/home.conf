# 02 - Programmatic document contract verification

## User inputs

The owner identified the confidential source repository and asked that this
work be carried as an explicit goal while its design and worklog remain outside
the earlier skills commit:

> then keep design and worklog un commited,  and that project is ~/Documents/task-svc, find that file and work on the design (arm as a goal to work on it)

After the source-side manifest was found, the owner refined the required
outcome. These points jointly define the verifier and its adoption path. The
article is a reference for the requested JEV and Prolog direction, not an
instruction to copy its implementation uncritically:

> So I think we need:
>
> * fold lessons into the skills, the refined rules, the library pattern
> * actively use jev-prompts (nemem)
> * and prob prolog based jev calling
> * and tools to segment markdown to segments for finer grained evaluation.
> * and the cli be able to specify which section of the markdown, and what rubric yaml (w/ redirection following)
> * the practice how to use prek to print detailed diagnostics with per project setup jev based check flow (for changed files only to save cost)
>
> ref: https://deepclause.substack.com/p/jev-prolog-pi-and-the-dream-of-probabilistic?utm_campaign=post&utm_medium=web

The owner confirmed that this is an execution goal and authorized use of the
existing local JEV credential for verification when required:

> arm a goal to complete it

> and check notes vault (nmem) if you need the key to call and test

## Problem statement

High-level requirements and design semantics live in documents because code
cannot encode them all. The current skills can review those documents, but they
cannot run one repeatable contract from an agent, a Git hook, and CI. They also
lack stable Markdown section selection and rubric reference resolution. Whole
document model calls spend money on unchanged text and make findings harder to
locate. This leaves document quality dependent on a reviewer's memory and makes
semantic checks too expensive for a changed-file commit loop.

## Scope - what we touch

- Implement one shared document verifier for `goal-file`, `flow-common`,
  `flow-grill-review`, `flow-retro`, `flow-supervise`, and repository
  automation.
- Parse Markdown into stable selectable sections and resolve explicit or
  metadata-selected rubric YAML through recursive references.
- Convert deterministic document facts and one bounded batch of typed JEV
  judgments into explained outcomes through ordered Prolog clauses.
- Add a shared verification-practice skill. The flow skills select and invoke
  its practices instead of repeating them.
- Add per-project configuration, changed-file `prek` checks, CI wiring,
  diagnostics, fixtures, and a deny-by-default outbound-data boundary.

Non-goals are replacing human design review, importing private project facts,
managing the source-side practice-transfer lifecycle, allowing arbitrary DML,
performing general probabilistic inference, using model confidence as acceptance
authority, falling back to another model when JEV is required, or retrofitting
unrelated skills.

## Rationale

Markdown stays authoritative. Code verifies a projection of its structure and
meaning. Deterministic checks run first. The evaluator sends only selected,
allowed evidence to one batched DeepClause `judge/2` call. Typed answers become
facts, then ordered Prolog clauses produce the verdict and explanation. This
keeps model output away from lifecycle authority while giving every consumer
the same executable contract.

The referenced article contributes three useful ideas: explicit state, batched
typed JEV questions, and deterministic clauses after judgment. It does not
demonstrate general probabilistic inference. This design therefore does not
multiply confidence values or let a probability produce `PASS`. A probability
may only prioritize an unresolved finding for review.

## Assumptions and evidence

**Observed facts**

- `home.conf` has document contracts in `goal-file` and the `flow-*` skills, but
  no root verifier, root commit hook, or CI gate for those contracts.
- The external practice manifest keeps its source references and provenance in
  its owning repository. Its confidentiality rule permits only reviewed,
  generalized statements to cross the boundary.
- The local `jev-prompts` client already proves typed choices, scores, and
  probabilities against the live JEV endpoint. It keeps its credential outside
  this repository.
- `deepclause-sdk` exposes the DML runtime, SWI-Prolog WebAssembly,
  `judge/2`, typed `choose`, `rate`, `verify`, and `probability` questions, and a
  JEV backend.

**Inferences tested by implementation**

- One snapshot abstraction can serve explicit working-tree paths, the Git
  index, and committed CI ranges without changing evaluation semantics.
- Markdown AST sections, resolved YAML rubrics, a bounded judgment batch, and
  ordered clauses can express the first goal and design contracts.
- Section-level affected closure reduces live semantic calls without reusing
  evidence after any input that could change the answer has changed.

## Implementation ownership

The verifier is a Node 18+ TypeScript package owned at the repository root. Its
implementation lives in `doc-verify/`; root `package.json` and
`package-lock.json` own its dependencies, scripts, build, and executable. It
does not belong to `tskill` or `flow-skills-eval`. The package exposes one
executable named `doc-verify`:

```text
npm exec doc-verify -- <command> [options]
```

`doc-verify/src/` owns boundary schemas, snapshot capture, Markdown and YAML
parsing, section and rubric resolution, fact extraction, judgment policy, DML
compilation, rule evaluation, and reports. `doc-verify/contracts/` owns
versioned reusable rubric and judge-policy YAML. `doc-verify/tests/` owns
fixtures and expected reports.

The lockfile pins `deepclause-sdk@0.0.89`, `github-slugger@2.0.0`, and the
Markdown and YAML parser versions. DeepClause supplies the DML runtime,
SWI-Prolog WebAssembly, and JEV backend. The verifier uses a Markdown AST parser,
a YAML parser, and runtime schemas at every external boundary. It does not infer
headings or YAML structure with regular expressions.

Rubric YAML compiles to a restricted DML program. A deterministic emitter turns
a schema-validated rubric AST into escaped Prolog terms. It accepts named facts,
conjunction, disjunction, equality, membership, numeric thresholds, and ordered
verdict clauses. `DeepClauseSDK.compile` and every other model-written DML path
are forbidden. Generated DML may call one `judge/2` batch and format the final
explanation. It may not accept caller-supplied DML or use `task/N`, `exec/2`,
filesystem access, network access, or a model fallback. Before execution, the
verifier rejects any predicate or runtime capability outside the generated
allowlist.

Production evaluation requires the DeepClause JEV backend with the capabilities
named by the selected rubric. It sets `maxRetries: 0`. Tests use the SDK mock JEV
backend or a scripted adapter. A parity test sends the same allowlisted request
through the external `jev-prompts/jev.py` client and the DeepClause backend,
then compares normalized typed answers. `.doc-verify.yaml` pins the allowed
client SHA-256. `JEV_PROMPTS_CLIENT` supplies its path and
`TYPESAFE_API_KEY` supplies the credential at runtime. `verify:jev` returns
`BLOCKED` before a request if either variable is unavailable or the client
hash differs. Reports record the hash, never the path or key. This actively uses
the existing work without copying its credential or implementation into this
repository.

## Authority model

| Artifact | Authority |
| --- | --- |
| Markdown document | Intent, decisions, properties, and current semantics |
| Metadata companion | Document kind, rubric references, verification commands, and freshness data |
| Shared rubric YAML | Reusable dimensions, typed questions, criticality, and deterministic mappings |
| Shared verification skill | Practice selection and evidence-level definitions |
| Worklog or attestation | Commands, observations, evidence, and the rule trace for one evaluation |
| Verifier code | Parsing, resolution, fact extraction, evaluation, and reporting; never new project policy |

An adjacent metadata file references shared rubrics. It does not repeat the
document or carry document-specific acceptance criteria. A repository may add a
reusable overlay for one artifact kind, but an individual document cannot
replace a critical shared dimension or lower a shared threshold.

## Verification pipeline

`doc-verify` evaluates one captured snapshot:

```text
Markdown AST + metadata + baseline/candidate graph
  -> selected Markdown segments + recursively resolved rubric
  -> deterministic structural facts
  -> one allowlisted DML judge/2 batch
  -> typed semantic facts
  -> deterministic ordered Prolog clauses
  -> explained verdict, diagnostics, and attestation
```

### Markdown segments

`doc-verify segments DOCUMENT --format json` exposes the segmenter directly.
The preamble before the first heading is `@preamble`. Every heading uses the
pinned `github-slugger@2.0.0` algorithm, with one slugger instance per parent,
and joins its slug to the ancestor path with `/`. This defines punctuation,
case, Unicode, and duplicate handling. A section owns
its heading and descendants through the line before the next heading of equal or
lower depth.

Each segment records its section ID, heading path, source line and byte bounds,
and content hash. Durable configuration uses the section ID. Diagnostics also
carry the current line range. Fenced heading-like text never creates a section.

`--section ID` is repeatable. The evaluator coalesces overlapping selections so
it never sends duplicate text. An unknown or ambiguous selector is a usage
error that lists valid IDs. With no selector, the rubric's `applies_to`
selectors determine the evaluated segments.

### Rubric library and reference resolution

`--rubric PATH#FRAGMENT` selects the root rubric explicitly. Otherwise the
document's adjacent YAML `rubrics.inherits` wins, followed by the artifact-kind
default in `.doc-verify.yaml`. Absence at all three levels is a configuration
error. For example:

```yaml
rubrics:
  inherits: ../doc-verify/contracts/design.yaml#rubrics
```

The fragment is a YAML mapping path. `#rubrics` is the single-key form and
`#/rubrics/items` is the slash-separated form; `~0` and `~1` use JSON
Pointer escaping. Arrays and empty path components are not addressable. The
resolver interprets a reference relative to the file that declares it and
follows `inherits` depth first, parent before child. It records every
repository-relative path, fragment, and blob hash in that order. It rejects
absolute paths, repository escapes, symlink escapes, missing files or
fragments, type mismatches, and cycles.

After resolution, items concatenate parent first. Duplicate item IDs are an
error, even when their content matches. A child may add a new item and may raise
the inherited noncritical threshold. It cannot lower that threshold or change
an inherited item. Command-line selection chooses the root only; it does not
skip that root's inherited chain.

Each reusable rubric item has a stable ID, artifact kinds, section selectors, a
typed JEV question, an evidence selector, criticality, weight, and a
deterministic mapping from each answer to a score in `[0, 1]`. Every critical
item must map to score `1` for `PASS`; a critical `refuted` answer is
`NO-GO` and a critical `unknown` answer is `NEEDS-REVIEW`. Noncritical
items produce `sum(weight * answer_score) / sum(weight)`, or `1` when no
noncritical item exists. A ratio below the resolved threshold is
`NEEDS-REVIEW`. Weights can aggregate noncritical evidence but cannot override
a critical result.

The canonical item shape is:

```yaml
- id: design.problem_resolved
  artifact_kinds: [design]
  applies_to:
    sections: [problem-statement, rationale]
    scope: combined
  evidence:
    source: section_body
    max_bytes: 12000
  question:
    kind: choose
    instruction: Does the proposed mechanism resolve the stated problem?
    options: [supported, refuted, unknown]
  critical: true
  weight: 1
  scores: {supported: 1, refuted: 0, unknown: 0}
```

Section selectors are exact section IDs or the reserved `@selected` value.
`scope: each` emits one question per matched section. `scope: combined` emits
one question over matched sections in document order. Evidence is the selected
section body, including its heading subtree, and never includes front matter or
other sections. Exceeding `max_bytes` is `BLOCKED`; the verifier never truncates
evidence silently.

Selection proceeds in this order: parse the document, resolve explicit CLI
sections when present, filter rubric items by artifact kind, then intersect each
item's exact section IDs with that set. `@selected` means the complete explicit
set, or every document section when the CLI gave no selector. With an explicit
selection, items outside the intersection are out of scope and do not enter the
score. Without an explicit selection, a missing section for a critical item is
a structural `NO-GO`; an optional item is skipped. A selection that leaves no
applicable item is a usage error, never an empty `PASS`.

### Structural and semantic facts

The deterministic layer owns facts that parsers and repository queries can
prove: required section order, metadata shape, status vocabulary, stable and
unique identifiers, reference validity, frozen requirements, live additions,
coverage, dependency acyclicity, document relationships, evidence fields, and
the changed section and dependent closure.

The semantic layer receives only selected segments and named criteria. The
first implementation uses `choose` with the explicit labels `supported`,
`refuted`, and `unknown`. It does not use DeepClause `verify` because the
current JEV backend maps the midpoint to yes or no and cannot preserve unknown.
`rate` and `probability` are allowed only for review priority or an explicitly
unresolved risk. They cannot satisfy an acceptance fact.

One request contains all questions for the affected segments. Before sending,
the adapter compares question, option, and level counts with the backend
capabilities. It uses the UTF-8 byte length of canonical state JSON as a
conservative upper bound for `stateTokenBudget`. An over-budget batch returns
`BLOCKED`; it is never split. The adapter validates returned IDs, types,
labels, and cardinality before it constructs facts. Answers from one context
are correlated. The evaluator never multiplies their confidence values.

### Rules and verdicts

The compiler turns the resolved rubric into DML facts and ordered clauses. The
rule trace records every input fact and the first deciding clause. The generated
DML and its hash are part of the local attestation.

```text
NO-GO        a deterministic invariant fails, a critical fact is refuted,
             or prohibited data reaches the outbound boundary
BLOCKED      a required rubric, policy, evidence source, or JEV service is unavailable
NEEDS-REVIEW an available judgment is unknown or below its review threshold
PASS         all critical facts are supported, the threshold passes, and no
             blocking finding remains
```

Precedence is `NO-GO`, `BLOCKED`, `NEEDS-REVIEW`, then `PASS`. These are
verifier outcomes, not document lifecycle states. A skill or person decides
whether the evidence is enough for a lifecycle transition.

## Snapshots and affected closure

The verifier compares a baseline snapshot with a candidate snapshot. It builds
the reverse dependency closure over the union of both document graphs. This
keeps deletions, renames, retargeted references, and baseline-only edges in the
affected set. Surviving artifacts use candidate bytes. Deleted artifacts produce
tombstone facts for reference and ownership rules.

Each provider captures every input blob once before parsing. The snapshot ID is
the SHA-256 of canonical sorted tuples containing repository-relative path,
blob hash, and deletion marker.

| Mode | Baseline | Candidate | Changed roots and graph universe |
| --- | --- | --- | --- |
| `--paths P...` | `HEAD` tree | One in-memory working-tree capture; a named missing path is a deletion | Named changes; union of `HEAD` and captured working tree |
| `--staged` | `HEAD` tree | Git index blobs only | `git diff --cached`; union of `HEAD` and index |
| `--range BASE...HEAD` | Merge base tree | Resolved head commit tree | Tree diff; union of merge base and head |

The modes are mutually exclusive. Paths outside the repository and symlink
escapes are usage errors. If a working-tree file changes during capture, the
invocation returns `BLOCKED` instead of evaluating mixed bytes.

The repository configuration lives in `.doc-verify.yaml`. It declares document
patterns, artifact kinds, companion rules, default rubric references, default
section selectors, profiles, judge model, and outbound policy. A semantic call
runs only when a selected changed segment changed, or when a dependent's
selected evidence, resolved rubric, question, model, or policy changed. Every
other result requires an exact attestation-key match.

`documents` is an ordered selector list. An include entry is the existing rule
shape and carries the artifact kind, verification reference, and structural
requirements. An exclude entry is `{pattern, exclude: true}`. Matching proceeds
in order and the last matching entry decides, so include then exclude removes a
path and exclude then include restores it. The selected include rule also
supplies that path's rule metadata. The verifier records every matching selector
in order as the artifact's `selector_trace`; verbose text shows the same trace,
and JSON exposes it for a caller. A later exclusion therefore changes both the
document inventory and the affected-closure graph through the same decision.

Profiles are `draft`, `promotion`, and `auto`. `draft` runs deterministic
checks only. `promotion` requires current semantic evidence. `auto` chooses
promotion when either snapshot has a lifecycle state later than `draft`; for
document kinds without lifecycle state it uses the required profile declared in
`.doc-verify.yaml`. Otherwise it chooses draft. `flow-grill-review` and every
promotion decision invoke `--profile promotion` explicitly while the design is
still `draft`. A normal commit hook may use `auto`; it does not prove review.

## Attestation and confidentiality

The semantic request identity includes the ordered allowed evidence paths and
blob hashes, selected section IDs and content hashes, minimized excerpts,
resolved rubric path and blob chain, generated DML hash, ordered question IDs
and criteria, context-builder and adapter versions, judge model, judge policy,
and confidentiality-policy version. Its canonical JSON SHA-256 is the
attestation key. Only an exact match permits reuse.

Outbound construction is deny by default. The judge policy allowlists artifact
kinds, fields, excerpt sizes, and question templates. It rejects external
practice manifests, repository or organization identifiers, machine-local
values, endpoints, credentials, local-only evidence, and unselected surrounding
text. The same scrubber runs before logs, caches, reports, and error persistence.
Provider bodies and echoes become typed error classes and request IDs only. A
policy violation is `NO-GO`; unavailable required policy or JEV is `BLOCKED`.

The production adapter reads `TYPESAFE_API_KEY` from the environment. No key,
credential path, or value belongs in repository files, commands recorded in the
worklog, reports, or test artifacts.

## Shared verification practices

`skills/verification/SKILL.md` owns the reusable practice library. It defines
four evidence levels:

| Level | Evidence |
| --- | --- |
| E0 | Static structure, parse, schema, or type proof |
| E1 | Bounded behavior through the public function or command |
| E2 | A running local boundary with real serialization, process, or persistence |
| E3 | A live or deployed boundary with externally observable evidence |

A design selects only practices that can falsify its load-bearing claims. The
library includes real-path checks, property examples, refusal cases, semantic
mutation, replay and idempotency, concurrency, persistence, migration rehearsal
and recovery, public API or CLI contracts, diagnostic traces, visual
interaction, and an independent oracle. An evidence claim names its level and
cannot claim a higher boundary than the command exercised.

`flow-grill-review` selects practices while reviewing the verification design.
`flow-common` runs the selected checks at implementation. `flow-retro` verifies
freshness and the evidence claim ceiling. `goal-file` keeps coverage to frozen
requirements. `flow-supervise` uses the affected report to find stale or
unresolved work. These skills reference the library and do not duplicate it.

The external manifest contains 19 generalized candidates. This design accepts
the 12 practices that fit its document and verification owners. The source
manifest remains the disposition ledger. It marks accepted entries
`accepted_for_transfer` during implementation and `transferred` only after the
target edits pass verification:

| Manifest IDs | Target owner in this change |
| --- | --- |
| `authority-layering`, `frozen-root-and-coverage`, `worklog-evidence-separation`, `stable-document-references` | `goal-file`, `flow-common`, and the verification library's authority practices |
| `design-plus-verification`, `shared-rubric-metadata`, `evidence-claim-ceiling`, `risk-selected-verification`, `semantic-mutation-gate` | Verification library, selected by `flow-grill-review` and checked by `flow-retro` |
| `migration-rehearsal-and-recovery`, `boundary-first-observability`, `public-contract-hygiene` | Verification library's stateful-boundary and public-contract practices |

This transfer rejects `release-triggered-migrations`, `owned-local-environment`,
`compatibility-needs-real-history`, `lightweight-domain-modeling`,
`name-versus-identity`, `vocabulary-before-policy`, and
`immutable-release-artifact`. They require specialist design or operational
owners outside this verifier and must not broaden the flow skills indirectly.

## Command, report, and diagnostics

The CLI is:

```text
doc-verify segments DOCUMENT [--format text|json]
doc-verify check (--paths P... | --staged | --range BASE...HEAD | --all)
                 [--section ID ...] [--rubric PATH#FRAGMENT]
                 [--profile draft|promotion|auto]
                 [--format text|json] [--output PATH] [--refresh]
```

Text diagnostics use one stable form:

```text
path/to/file.md:12 [section-id] rule-id VERDICT message (evidence: source-id)
```

The summary prints artifact and section counts, semantic calls, exact cache
hits, and the final verdict. JSON contains schema version, invocation and
profile, baseline/candidate/policy identities, changed roots, affected
artifacts and sections, resolved rubric chains, typed facts with blob sources,
redacted semantic request identities, fired rules, unresolved prerequisites,
findings, verdict, and timing. Human-readable stderr carries no extra evidence.
`--refresh` bypasses reuse when a gate needs a fresh live judgment. Otherwise
an attestation must match the exact request identity and remain within the
configured maximum age.

Exit codes are `0` for `PASS`, `1` for `NO-GO`, `2` for `NEEDS-REVIEW`, `3` for
`BLOCKED`, `64` for invalid invocation or configuration, and `70` for an
internal error. Hooks and CI block on every nonzero code.

## Project setup and consumers

The root `.pre-commit-config.yaml` has one local `prek` hook:

```yaml
- id: document-contracts
  name: document contracts
  language: system
  entry: npm exec doc-verify -- check --staged --profile auto --format text
  pass_filenames: false
  require_serial: true
```

Root `.pre-commit-hooks.yaml` publishes `document-contracts` as a Node hook from
this repository package. An adopting project pins an immutable `home.conf`
commit in its `repo` and `rev` fields and selects that hook. Prek installs that
exact package revision, including its compiled executable. During development,
this repository's local hook runs the same built entrypoint. No adopting project
needs a `doc-verify/` directory or a global install.

The published hook manifest is literal:

```yaml
- id: document-contracts
  name: document contracts
  language: node
  entry: doc-verify check --staged --profile auto --format text
  pass_filenames: false
  always_run: true
  require_serial: true
```

The hook runs for every staged change and lets `--staged` inspect the index.
This catches changes to configuration, policies, shared rubrics, skills, and any
configured document root that can invalidate a dependent attestation. The
verifier, not a hook regex, computes the affected document and section closure.

Each adopting project also adds `.doc-verify.yaml` and a companion YAML for
each checked document. `prek validate-config` verifies hook syntax. The
explicit setup proof checks every configured document rather than reusing the
staged mode:

```text
npm exec doc-verify -- check --all --profile draft --format text
```

`npm run test:remote-hook` creates a temporary consumer repository, pins the
current committed `home.conf` revision through a local `file://` Git URL, stages
a valid and an invalid fixture in turn, and runs `uvx prek run
document-contracts`. The test fails unless Prek installs the Node hook from that
immutable revision, the valid fixture passes, and the invalid fixture prints
its path, section ID, rule ID, and non-pass verdict. The separate `check --all`
setup proof covers the full configured document set.

Normal commits use the staged changed-section closure and print the detailed
diagnostics above. CI runs:

```text
npm exec doc-verify -- check \
  --range "$BASE_SHA...$HEAD_SHA" --profile auto --format json \
  --output doc-verify-report.json
```

The agent loop uses `check --paths ... --profile draft`. Grill review uses the
same path mode with `--profile promotion`. `--all` captures every configured
candidate document against the empty baseline and is valid only for setup or a
full local audit. All consumers call the same executable and report schema.
Mode provenance differs, but normalized facts, rule traces, and verdicts must
agree for equivalent snapshots.

## Verification design

Run `npm --registry https://registry.npmmirror.com install` at the repository
root before the gate. Fixture outputs live under `doc-verify/tests/expected/`.
Executed commands, mutation receipts, and the redacted live parity result live
in this design's worklog.

| Property | Observable failure witness | Command |
| --- | --- | --- |
| Markdown uses AST section boundaries | Fenced headings, duplicate headings, preamble, nested sections, or overlap produce a wrong segment ID or byte range | `npm test -- segments` |
| Rubric redirects are safe and deterministic | Relative chains, fragments, overlay rules, cycles, escapes, missing targets, or changed blob order resolve incorrectly | `npm test -- rubrics` |
| Snapshots and affected closure are correct | Staged bytes read unstaged edits, or deletion, rename, retarget, and baseline-only edges omit a dependent | `npm test -- snapshots graph` |
| Ordered document selection is correct | Last-match include/exclude differs from CLI selection, a working-tree path bypasses exclusion, or `selector_trace` omits the matching order | `npm test -- cli` |
| DML clauses are deterministic and restricted | A generated program uses a prohibited predicate, or a fact set changes verdict without changing the deciding trace | `npm test -- rules` |
| Semantic uncertainty and reuse are bounded | Unknown passes, unavailable JEV is not `BLOCKED`, retries occur, or changed evidence, question, model, rubric, DML, or policy reuses an attestation | `npm test -- semantic` |
| Private sources stay private | A unique local-only canary appears in a request, cache, report, error, log, fixture, or `git diff` | `npm test -- confidentiality` |
| Hook, agent, and CI agree | Equivalent snapshots disagree after removal of documented provenance and timing fields | `npm test -- cli` |
| Important gates can fail | A seeded defect in each critical rule family does not turn a known pass into its declared non-pass verdict | `npm test -- mutations` |
| Local client and DeepClause agree on typed JEV answers | The same live allowlisted batch yields different normalized IDs, types, or labels | `npm run verify:jev` |
| The actual repository contract passes | Root configuration, companions, skills, hook, or CI fail their selected rules | `npm run check` |

The complete deterministic gate is `npm test && npm run typecheck && npm run
lint`. The live
JEV parity test is explicit and never runs during ordinary unit tests. Every
critical rule family has one semantic or structural mutation that proves the
gate turns red.

## Goal

goals/01-document-verification-and-skill-transfer.md

## Review

worklog/02-programmatic-document-contract-verification.md

## Status

landed
