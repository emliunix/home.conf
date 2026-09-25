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
- Every companion (`X.yaml` beside a configured `X.md`) must use the current
  shape: `schema_version: 1`, `kind: document-contract`,
  `document.{path, kind, status?, depends_on?}`, and `verification`. Project
  fields may stay alongside, because the schema accepts extra keys. An
  old-shape companion aborts the entire run, not just its own document.
  `document.path` must name the adjacent Markdown file, and `document.kind`
  must equal the rule's `artifact_kind`.
- Before writing rubric `applies_to`, run `doc-verify segments` across the
  corpus and list every heading variant. A critical item that matches no
  section is a NO-GO.
- Commit bulk companion conversions as their own commit right away, staging
  explicit paths. In a shared worktree, uncommitted mechanical rewrites get
  swept into someone else's commit.

## 3. Baseline before the hook

- Run `doc-verify check --all` without the credential first. Every document
  that clears structure reports `BLOCKED`, so any `NO-GO` is a real structural
  or policy failure. Then rerun with the credential for the semantic baseline.
- Rule on each failure before installing the hook: fix it, change the rubric,
  or accept it explicitly. The setup commit touches the invalidation patterns,
  so it re-judges every configured document. Any existing failure blocks it.
- After the hook is installed, an edit re-judges its whole reverse
  `depends_on` closure, so an old failure several links away can block an
  unrelated commit.

## 4. Hook

- `.pre-commit-config.yaml` declares the hook but does not run it. Something
  must call `prek` from `.git/hooks/pre-commit`.
- Install `prek` persistently (for example `uv tool install prek`), then run
  `prek install`. With a global `core.hooksPath` that delegates to
  `.git/hooks/`, use `prek install --git-dir .git`. Do not install through an
  ephemeral runner such as `uvx`: the generated hook stores the `prek` path.
- Prove it: a staged edit that removes a required section must be refused, and
  a code-only commit must be skipped.
