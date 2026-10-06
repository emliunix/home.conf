#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
revision="${DOC_VERIFY_HOOK_REV:-$(git -C "$root" rev-parse HEAD)}"

if ! git -C "$root" cat-file -e "$revision:package.json" 2>/dev/null; then
  echo "remote-hook test requires a committed verifier revision" >&2
  exit 3
fi

tmp="$(mktemp -d "${TMPDIR:-/tmp}/doc-verify-hook.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

git -C "$tmp" init -q
git -C "$tmp" config user.email test@example.invalid
git -C "$tmp" config user.name "Doc Verify Test"

mkdir -p "$tmp/design" "$tmp/modules"
printf '%s\n' \
  'schema_version: 1' \
  'kind: document-verification' \
  'documents:' \
  '  - pattern: design/*.md' \
  '    artifact_kind: design' \
  '    modules: [modules/design.yaml]' \
  '    required_sections: [problem-statement, rationale, review, status]' \
  'invalidation_patterns: [.doc-verify.yaml, modules/**]' \
  'judge:' \
  '  kind: jev' \
  '  model: jev-1.13.0' \
  '  client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb' \
  '  attestation_max_age_seconds: 86400' \
  'policy:' \
  '  kind: semantic-boundary' \
  '  version: 1' \
  '  max_evidence_bytes: 12000' \
  '  forbidden_literals: []' > "$tmp/.doc-verify.yaml"
printf '%s\n' \
  'schema_version: 2' \
  'kind: verification-module' \
  'module: hook.design' \
  'oracles:' \
  '  problem_stated(D, S):' \
  '    ask: The section states a concrete problem.' \
  '    evidence: core.body(D, S)' \
  '    threshold: 0' \
  'rules:' \
  "  problem_section(D, S): core.section(D, S, _), core.heading(D, S, 'Problem statement')" \
  'constraints:' \
  '  has-problem:' \
  '    forall: core.meta(D, kind, design)' \
  '    require: problem_section(D, S)' \
  '    severity: error' \
  '    message: "{D} has no Problem statement"' \
  '  problem-is-stated:' \
  '    forall: problem_section(D, S)' \
  '    require: problem_stated(D, S)' \
  '    severity: error' \
  '    profiles: [promotion]' \
  '    message: "{S} in {D} states no concrete problem"' > "$tmp/modules/design.yaml"
printf '%s\n' \
  '# Fixture' \
  '## Problem statement' \
  'A concrete problem.' \
  '## Rationale' \
  'A mechanism.' \
  '## Review' \
  'worklog.md' \
  '## Status' \
  'draft' > "$tmp/design/01-fixture.md"
printf '%s\n' \
  'repos:' \
  "  - repo: file://$root" \
  "    rev: $revision" \
  '    hooks:' \
  '      - id: document-contracts' \
  '        verbose: true' > "$tmp/.pre-commit-config.yaml"

git -C "$tmp" add .
git -C "$tmp" commit -qm base

printf '%s\n' 'not a verifier input' > "$tmp/notes.txt"
git -C "$tmp" add notes.txt
# A draft builds the judge client but asks nothing, so a placeholder key is never sent. The live
# arm below replaces it with the caller's real key.
live_key="${TYPESAFE_API_KEY:-}"
export TYPESAFE_API_KEY=placeholder-never-sent
skip_output="$(cd "$tmp" && PREK_COLOR=never uvx prek run 2>&1)"
if [[ "$skip_output" != *"Skipped"* ]]; then
  echo "remote hook did not skip an unrelated staged file" >&2
  printf '%s\n' "$skip_output" >&2
  exit 1
fi
git -C "$tmp" commit -qm unrelated

printf '%s\n' 'valid edit' >> "$tmp/design/01-fixture.md"
git -C "$tmp" add design/01-fixture.md
valid_output="$(cd "$tmp" && PREK_COLOR=never uvx prek run 2>&1)"
for expected in 'verification invocation=staged' 'artifact design/01-fixture.md' 'impact: design/01-fixture.md' 'required sections (4): problem-statement,rationale,review,status' 'modules: modules/design.yaml' 'has-problem' 'metadata.missing-companion WARN' 'PASS:'; do
  if [[ "$valid_output" != *"$expected"* ]]; then
    echo "remote hook valid diagnostic is missing: $expected" >&2
    exit 1
  fi
done

if [[ "${DOC_VERIFY_LIVE:-0}" == "1" ]]; then
  sed -i.bak 's/^draft$/reviewed/' "$tmp/design/01-fixture.md"
  rm -f "$tmp/design/01-fixture.md.bak"
  git -C "$tmp" add design/01-fixture.md
  set +e
  live_output="$(cd "$tmp" && TYPESAFE_API_KEY="$live_key" PREK_COLOR=never uvx prek run 2>&1)"
  live_status=$?
  set -e
  if [[ $live_status -ne 0 ]]; then
    echo "remote hook live run failed" >&2
    printf '%s\n' "$live_output" >&2
    exit 1
  fi
  if [[ "$live_output" != *"1 semantic call(s)"* ]]; then
    echo "remote hook live run did not make exactly one semantic call" >&2
    exit 1
  fi
  if [[ "$live_output" != *"problem-is-stated"* || "$live_output" != *"satisfied"* ]]; then
    echo "remote hook live run did not print the module's constraint result" >&2
    exit 1
  fi
fi

sed -i.bak '/## Rationale/,+1d' "$tmp/design/01-fixture.md"
rm -f "$tmp/design/01-fixture.md.bak"
git -C "$tmp" add design/01-fixture.md
set +e
output="$(cd "$tmp" && PREK_COLOR=never uvx prek run 2>&1)"
status=$?
set -e
if [[ $status -eq 0 ]]; then
  echo "remote hook accepted an invalid fixture" >&2
  exit 1
fi
for expected in 'design/01-fixture.md:' '[fixture]' 'structure.required-section' 'NO-GO'; do
  if [[ "$output" != *"$expected"* ]]; then
    echo "remote hook diagnostic is missing: $expected" >&2
    exit 1
  fi
done

printf '%s\n' "remote hook PASS ($revision)"
