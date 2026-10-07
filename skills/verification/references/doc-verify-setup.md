# doc-verify setup

Steps for bringing an existing repository under `doc-verify` document
contracts, in order. Each step says what failure looks like when it is skipped.

## 1. Credential

- The judge key comes from `API_KEY` in a gitignored `.env.doc-verify` at the
  repository root. Make it a symlink to the protected local credential file,
  not a copy. Check that `git check-ignore -v .env.doc-verify` matches.
- An exported, non-empty `TYPESAFE_API_KEY` takes precedence over the file.
- Symptom when missing: `semantic.prerequisite BLOCKED ... is unavailable` on
  every document that reaches the judge. A clean clone without the file cannot
  run the promotion profile, whatever the config says.
- The pinned hook revision must include the `.env.doc-verify` loader. Older
  revisions read only the exported variable.

## 2. Configuration

- Pin the provider hook `rev` to a commit that is on the provider's remote.
  prek clones the remote, so a local-only commit does not resolve.
- `judge.client_sha256` names the JEV client the tool uses.
- `documents` is ordered and uses last-match-wins selection. An include entry is
  the normal rule with `artifact_kind`, `modules`, and optional
  `required_sections`; an exclusion is only
  `{pattern: ..., exclude: true}`. Include then exclude removes matching paths;
  exclude then include re-adds them and supplies the selected rule metadata.
  Verbose output prints the matching `selector trace`, and JSON exposes it as
  `selectorTrace`, so a test can assert the decision rather than infer it from
  the final file list.
- Every companion (`X.yaml` beside a configured `X.md`) must use the current
  shape: `schema_version: 1`, `kind: document-contract`,
  `document.{path, kind, status?, depends_on?}`. Project fields may stay
  alongside, because the schema accepts extra keys; a leftover v1
  `verification` block is ignored with a `metadata.legacy-verification`
  warning. An old-shape companion aborts the entire run, not just its own
  document.
  `document.path` must name the adjacent Markdown file, and `document.kind`
  must equal the rule's `artifact_kind`.
- A rule that still names a v1 `verification:` strategy is a configuration
  error for the whole run; migrate it to `modules:` (README, "Migrating from
  v1 rubrics").
- Before writing a module rule over `core.heading`, run `doc-verify segments`
  across the corpus and list every heading variant. A heading rule that
  matches no section leaves its constraint's population empty.
- Commit bulk companion conversions as their own commit right away, staging
  explicit paths. In a shared worktree, uncommitted mechanical rewrites get
  swept into someone else's commit.

## 3. Baseline before the hook

- Run `doc-verify check --all` without the credential first. A document that
  clears its rule's `required_sections` reports `BLOCKED` before its module
  constraints run, so any `NO-GO` there is a real `required_sections` failure.
  Then rerun with the credential for the module and semantic baseline.
- Rule on each failure before installing the hook: fix it, change the module,
  or accept it explicitly. The setup commit touches the invalidation patterns,
  so it re-judges every configured document. Any existing failure blocks it.
- After the hook is installed, an edit re-judges its whole reverse
  `depends_on` closure, so an old failure several links away can block an
  unrelated commit.

## 3a. When a rule and a document disagree

Do not decide the defect from the authored constraint message alone. Read the
proof tree and the engine report first: a generic message can describe only one
branch of a rule, while the deciding path may be the populated oracle path.
Classify the mismatch as:

- the document is missing or contradicts the intended contract;
- the rule's predicate, selected sections, or required shape describes an older
  structure;
- both moved, or the intended contract itself is unresolved.

One common shape is a rule that requires at least one named section and then
hands the present sections to an oracle. An empty population emits the engine's
own empty-population message; an authored message that says the sections are
missing can therefore print only on the path where at least one section is
present and the oracle refuted it. Restating that message is a rule-surface
change; making the engine choose a cause-appropriate message is an engine change;
removing the authored message is another rule-surface change. Diagnose which
surface owns the mismatch before deciding whether a consumer pin move is needed.

If the document is wrong, repair the document. If the rule is wrong, amend the
rule and the document in one reviewed object, record the old intent and the
smallest changed predicate or shape, and add a case for each path the rule can
take: empty or missing population, and populated or oracle-decided. If the rule
needs new engine behavior, land a separate reviewed engine object first, then
move the consumer pin in its own object. Never weaken a rule merely to pass a
document, and never force a document to imitate a rule that no longer states the
intended structure.

## 4. Hook

- `.pre-commit-config.yaml` declares the hook but does not run it. Something
  must call `prek` from `.git/hooks/pre-commit`.
- Install `prek` persistently (for example `uv tool install prek`), then run
  `prek install`. With a global `core.hooksPath` that delegates to
  `.git/hooks/`, use `prek install --git-dir .git`. Do not install through an
  ephemeral runner such as `uvx`: the generated hook stores the `prek` path.
- Prove it: a staged edit that removes a required section must be refused, and
  a code-only commit must be skipped.
