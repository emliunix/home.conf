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
fact), `--format text|json`, `--verbose`, `--no-cache` and `--output PATH`. Exit codes: 0 PASS, 1 NO-GO,
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

Judge answers are cached per oracle atom in `.doc-verify-cache/atoms/<key>.json` at the repository
root (files mode 0600), keyed by model, question, labels, evidence hash and policy version, so an
unchanged section is never asked twice. Add `.doc-verify-cache/` to the consuming repository's
`.gitignore`. The cache is honoured by default, also on a keyless run; `--no-cache` neither reads
nor writes it, and a profile setting in `.doc-verify.yaml` asks every atom again and rewrites
its entry:

```yaml
profiles:
  promotion: {cache: refresh}   # default: reuse
```

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

### Candidate sets: `core.present/3`

`core.present(D, Candidates, Present)` binds `Present` to the ids in the literal `Candidates` list
that the document `D` **has**, in **document order**. Missing candidates are omitted, not fatal, so
one oracle can judge the union of whichever sections exist — a v1 `scope: combined` item over a list
of alternative sections:

```yaml
oracles:
  problem_scope_rationale(D, L):
    ask: Does the design state one material problem, its scope, and the authority it acts under?
    evidence: core.union(D, L)
    threshold: 0
    max_bytes: 16000
constraints:
  problem-scope-rationale:
    forall: core.meta(D, kind, design), present(D, ['problem-statement', 'scope--what-we-touch', 'rationale'], P)
    require: problem_scope_rationale(D, P)
    severity: error
    population: nonempty
    message: "{D} states no problem, scope or rationale"
```

`Candidates` must be a literal non-empty list of section ids, with no duplicates; a malformed list is
refused before evaluation. Candidate order is irrelevant — document order decides the bound list. The
primitive reads only the named document's sections, so it cannot enumerate another document's
sections or a rule's solutions. **Zero present members** derives nothing, so the constraint does not
bind; with `population: nonempty` that is the missing-coverage failure at the constraint's severity,
and **no question is asked of the judge** (an empty evidence set is not a question). Without
`population: nonempty` a zero-member candidate list is silently vacuous, which is almost never what
a presence rule wants.

`core.union(D, L)` itself requires every id in `L` to exist and returns no evidence otherwise; use
that form when the sections are jointly required, and `core.present/3` when they are alternatives.

### Engine libraries

Shipped in `doc-verify/lib/`, versioned with the engine and read from its install:

| Reference | What it checks |
| --- | --- |
| `doc-verify:references` | `references-resolve` (error): every Markdown link that is not a URL resolves; `paths-resolve` (warning): every backtick repository path resolves. No judge |
| `doc-verify:artifact` | extends references: a status word in `$statuses` and a `## Goal` section; defines the `purpose` oracle |
| `doc-verify:design` | extends artifact: `## Status` holding one of draft, reviewed, pending-retro, landed; on promotion, a verification section whose claims name a failing check, a decision section, and an altitude warning |
| `doc-verify:goal` | extends artifact: OPEN, BLOCKED or CLOSED-GREEN; the anchored root, Design files, Workstreams, AC coverage and Worklog sections; on promotion, coverage of every root requirement |

Reference facts (added 2026-10-05; path rules revised the same day). For each document
`doc-verify:core` also provides `core.ref(D, S, Target, Kind)`, where `S` is the innermost section
(or `@preamble`) and `Target` is as written:

- `Kind = link`: every Markdown link, image or definition target that is not a URL (no `scheme:`
  and no `//`).
- `Kind = path`: an inline code span that names a repository path, by the rules below.
- `Kind = name`: a bare file name (no `/`, a known extension) that names no one file: it resolves
  beside neither the document nor the root, and the tracked files hold it zero times or several
  times (`local-env.md`, or `ir.py` in two packages). `paths-resolve` reads only `path`, so a name
  is never a finding; it resolves when some tracked file has it.
- `Kind = line`: an inline code span naming a position by line number (`path.ts:123`,
  `path.ts:123-456`). A line is a position that rots on the next edit above it, so it is never a
  reference; a repository that wants no line locators in its prose ranges over this kind
  (`line_cite(D, S, T): core.ref(D, S, T, line)`). Its stem must look like a file, so `node:18`,
  `12:30` and `utf-8:3` are not locators. `paths-resolve` reads only `path`, so a line is never a
  finding by itself.

A code span is a candidate only when it is made of `[A-Za-z0-9_./-]` and is not a predicate
indicator (`child/3`, `design/02`) or a placeholder (`path/X.md`, `task/N`). Then, in order:

0. A span that is a line locator is a `line`, before any path rule runs. The tail is one or more
   line numbers or ranges, separated by `,` or `/`, so `impl/x/queue.ts:312`, `path.ts:10-20`,
   `schema.sql:11,16`, `claim-loop.ts:280-289,393-400` and `facade.ts:119/154` are all locators of
   one file each. The stem must look like a file: a path with a `/`
   (`impl/environment/Dockerfile:38`), a bare name ending in a known extension (`types.d.ts:286`,
   `foo.test.ts:48`), a dotfile (`.gitignore:3`), a **bare name with no extension that the
   repository actually holds** (`Dockerfile:16`, `Makefile:12` — a fixed extension list cannot
   cover every real filename, so the inventory decides), or a **short form naming a real document**
   (`design/103:55`). The last two are resolved from the reference context: with no context, or when
   no such file exists, they stay out. Resolving the stem does not prove the value, so the span
   must still be exactly the stem, a colon and a line tail -- with `Dockerfile` present,
   `Dockerfile:16` is a locator while `Dockerfile:`, `Dockerfile:foo` and `Dockerfile:16abc` are not. A colon that is none of those is no reference at
   all, so `localhost:8080`, `127.0.0.1:5432`, `node:18`, `12:30` and `utf-8:3` fall through to the
   rules below and produce nothing; nor is a stem the rules below refuse — a placeholder
   (`path/X.md:123`, `task/N:5`) or a signature (`child/3:1`) — since the guards are applied to the
   stem. `PATH_SPAN` is unchanged: this test runs first. A line locator **inside a link's label** is
   also a `line` (rule 1 below does not suppress it), so `[`src/run.ts:312`](src/run.ts)` yields the
   `link` and the `line`. A tail with no stem at all (`:178,184`) is deliberately NOT a locator: it
   cannot be told from a port or a ratio sequence, so it is out of this rule's scope.

1. A span inside the text of a link that resolves (or of a URL link) is the link's label, not a
   second reference: ``[`x.py`](x.py)`` gives one `link` ref. Inside a broken link the span counts.
   A line locator is exempt (rule 0): it is a `line` whether or not it labels a link, because it
   is a position that rots wherever it is written.
2. A span that is only extensions (`.md`, `.md/.yaml`) is not a path.
3. A span starting with `/` is a URL route (`/api/build`, `/step`), not a repository path;
   repository paths are written relative.
4. A Git ref is not a path: a span equal to a branch, tag or remote-branch name from
   `git for-each-ref` (empty when Git cannot list them), or one starting `origin/`, `archive/`,
   `exp/` or `refs/` whose first segment is not an existing directory.
5. A span with a `/` is a path when it ends in a known file extension, starts `./` or `../`, or
   its first segment is an existing directory at the repository root or beside the document.
   Slash-joined words (`lane/site/visit`) are not paths.
6. A span with no `/` is a path only when it ends in a known file extension and resolves beside
   the document or at the root, or exactly one tracked file has that name (which is where it
   resolves). Otherwise it is a `name`.

The extension list is fixed (`md`, `yaml`, `json`, `py`, `ts`, ... in `facts.ts`), because
`core.body` or `document.path` is a dotted name, not a file. YAML front matter (a first line
`---`, a YAML mapping, a closing `---`) is metadata: it belongs to `@preamble`, is not a section,
and is not read for references. Code blocks (fenced or indented) are not read either.

What the rules do not try to tell apart is the author's to reword: a file kind rather than a file
("each package's `verification.md`" is a `path` when one such file exists at the root), or a
retired name cited on purpose with a `/` (write it as the archive link it is, or without
backticks).

`core.resolves(D, Target)` holds when the target, without its `#fragment`, names a file or
directory relative to the document's directory or to the repository root, in the candidate's
tracked files or (for `--paths`, `--all`, `--staged`) the working tree; a bare fragment resolves to
the document. `core.dangling(D, S, Target, Kind)` is a ref that does not resolve. A violated
warning constraint such as `paths-resolve` prints `WARN` and leaves the verdict alone;
`NEEDS-REVIEW` is for a binding the engine could not decide. A module requires that what a
document names exists with, for example:

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
