# home.conf

## doc-verify

`doc-verify` checks Markdown documents against verification modules (design 04,
`design/04-modular-verification-language.md`). A module is a YAML program of facts over the
document's section tree, judge-backed oracles, rules and constraints; the engine evaluates it in
three-valued logic and reports each constraint's population, bindings, proof and repair hint.

```sh
npm ci && npm run build
node doc-verify/dist/cli.js segments FILE              # stable section ids
node doc-verify/dist/cli.js check --paths FILE --profile draft
node doc-verify/dist/cli.js check --all                # every configured document
```

`check` takes exactly one of `--paths`, `--staged`, `--range BASE...HEAD` or `--all`, plus
`--profile draft|promotion|auto`, `--section ID` (repeatable; restricts the `selected(D, S)`
fact), `--format text|json`, `--verbose` and `--output PATH`. Exit codes: 0 PASS, 1 NO-GO,
2 NEEDS-REVIEW, 3 BLOCKED, 64 usage or configuration error, 65 config not in the Git index
(`--staged`), 66 config missing.

The text report prints one line per finding, `path:line [section] rule VERDICT status: message
(sections: ...)`, then for a module constraint its repair hint and what decided it: one
`answered <label> (p=<value> <|>= threshold <t>) over <sections>` line per oracle answer, or
`structural: missing <literal>` / `structural: <facts found>` for a constraint decided from facts.
Engine failures (no judge, an over-budget round, an outbound-policy violation) are findings too.
`--verbose` adds the snapshot and selector detail, each finding's evidence hash and proof tree,
and the engine's full report (populations, every oracle question). `--format json` carries every
finding field and, per artifact, the engine's full report under `engine.report`. The last line is
always the summary, `VERDICT: N artifact(s), ...`.

The judge key comes from `TYPESAFE_API_KEY`, or from `API_KEY` in a gitignored
`.env.doc-verify` at the repository root. Without it the engine still runs: every constraint
whose goal reads no oracle (a heading, a status word, a reference) is decided, and only the
constraints that need the judge are undetermined, reported as `semantic.prerequisite BLOCKED
TYPESAFE_API_KEY is unavailable`. A violated structural `error` constraint is `NO-GO` (exit 1)
with or without a key; otherwise a document that needed the judge is `BLOCKED` (exit 3), and one
that did not is decided outright. A keyless pre-commit run therefore still refuses a document
with a missing required heading.

### Configuration

`.doc-verify.yaml` lists ordered, last-match-wins document rules. An include rule names the
modules that verify its documents:

```yaml
documents:
  - pattern: design/{0[1-9],[1-9][0-9]}-*.md
    artifact_kind: design
    modules: [doc-verify:artifact, doc-verify/modules/design.yaml]
  - pattern: goals/[0-9][0-9]-*.md
    artifact_kind: goal
    modules: [doc-verify:goal]
    status_from: title          # the status word is the title suffix, not a '## Status' section
  - pattern: goals/drafts/**
    exclude: true
```

A module reference is a repository path or an engine library `doc-verify:NAME`. The modules of
one rule (and their `extends`) compose into one program; a name defined twice is refused.

A constraint whose `forall` binds nothing is vacuously satisfied and reports nothing; the count
(`population 0`) appears only in `--verbose`. When an empty population is itself a defect, say so
with `population: nonempty` on the constraint: then a `forall` that binds nothing violates it,
at the constraint's severity, with the message "<id>: the population is empty".

### Engine libraries

Shipped in `doc-verify/lib/`, versioned with the engine and read from its install:

| Reference | What it checks |
| --- | --- |
| `doc-verify:references` | `references-resolve` (error): every Markdown link that is not a URL resolves; `paths-resolve` (warning): every backtick repository path resolves. No judge |
| `doc-verify:artifact` | extends references: a status word in `$statuses` and a `## Goal` section; defines the `purpose` oracle |
| `doc-verify:design` | extends artifact: `## Status` holding one of draft, reviewed, pending-retro, landed; on promotion, a verification section whose claims name a failing check, a decision section, and an altitude warning |
| `doc-verify:goal` | extends artifact: OPEN, BLOCKED or CLOSED-GREEN; the anchored root, Design files, Workstreams, AC coverage and Worklog sections; on promotion, coverage of every root requirement |

Reference facts (added 2026-10-05). For each document `doc-verify:core` also provides
`core.ref(D, S, Target, Kind)`: `Kind = link` for every Markdown link, image or definition target
that is not a URL (no `scheme:` and no `//`), `Kind = path` for every inline code span made only of
`[A-Za-z0-9_./-]` that contains `/` or ends in a known file extension (not a predicate indicator
such as `child/3`, nor a placeholder such as `path/X.md`); `S` is the innermost section (or
`@preamble`) and `Target` is as written. `core.resolves(D, Target)` holds when the target, without
its `#fragment`, names a file or directory relative to the document's directory or to the
repository root, in the candidate's tracked files or (for `--paths`, `--all`, `--staged`) the
working tree; a bare fragment resolves to the document. `core.dangling(D, S, Target, Kind)` is
a ref that does not resolve. Fenced code is not read. A module requires that what a document
names exists with, for example:

```yaml
extends: [doc-verify:references]   # or write the constraint yourself:
constraints:
  references-resolve:
    forall: core.ref(D, S, T, link)
    forbid: core.dangling(D, S, T, link)
    severity: error
```

The first libraries were first authored as visflow's modules. Project-specific modules stay in the project.
home.conf itself runs `doc-verify:goal` for goals, and `doc-verify:artifact` plus its own
`doc-verify/modules/design.yaml` for designs.

### Companions

A companion `X.yaml` beside a configured `X.md` has `schema_version: 1`,
`kind: document-contract` and `document: {path, kind, status?, depends_on?}`; other project
fields are kept. A v1 `verification:` block in a companion is **ignored**: the rule's `modules`
alone verify the document, and the check reports a `metadata.legacy-verification` warning so the
block can be deleted.

### Migrating from v1 rubrics

The v1 rubric reader (`verification:` strategies, `rubrics:` items, `--rubric`, `--refresh`,
`verify:jev`) was removed. A config rule that still names `verification:` is refused before
anything runs:

```text
doc-verify: invalid .doc-verify.yaml: documents[3] (pattern "docs/**/*.md") names a v1
`verification:` strategy; the v1 rubric reader was removed; replace `verification:` with
`modules: [...]` naming design-04 verification modules (repository paths or engine libraries
such as doc-verify:design); see "Migrating from v1 rubrics" in the doc-verify README
```

To migrate a rule (design 04 §Migration):

1. Replace `verification: PATH#verification` with `modules: [...]`: an engine library, a module
   of your own, or both.
2. For each v1 rubric item write one oracle and one constraint. `scope: each` is an `ask` oracle
   over `core.body(D, S)`; `scope: combined` is one over `core.union(D, [S1, ...])`; a section
   id becomes a rule over `core.heading` facts. `critical: true` is `severity: error`; a
   noncritical item is `severity: warning` with its `weight`, and the rubric threshold becomes
   `warning_threshold`. Give a migrated oracle `threshold: 0`, so the argmax label stands as it
   did in v1, and `profiles: [promotion]` if v1 judged it only on promotion.
3. A v1 `required_sections` entry may stay on the rule, or become a constraint over heading
   facts, which reports the module's message and repair.
4. A companion's own `rubrics:` items become a module named by a later, narrower rule for that
   document; then delete the companion's `verification:` block.

`doc-verify/modules/design.yaml` and `doc-verify/modules/design-03.yaml` are home.conf's own
migrations of its v1 design contract and of design/03's companion item.
