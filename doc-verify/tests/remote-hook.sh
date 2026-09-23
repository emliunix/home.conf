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

mkdir -p "$tmp/design" "$tmp/rubrics"
printf '%s\n' \
  'schema_version: 1' \
  'documents:' \
  '  - pattern: design/*.md' \
  '    artifact_kind: design' \
  '    rubric: rubrics/design.yaml#rubrics' \
  '    required_sections: [problem-statement, rationale, review, status]' \
  '    semantic_profile: draft' \
  'invalidation_patterns: [.doc-verify.yaml, rubrics/**]' \
  'judge:' \
  '  model: jev-1.13.0' \
  '  client_sha256: ce983f8de97d5b30d527a7116f0c49ad3d17e098d2c3f17c9600041260c65dcb' \
  '  attestation_max_age_seconds: 86400' \
  'policy:' \
  '  version: 1' \
  '  max_evidence_bytes: 12000' \
  '  forbidden_literals: []' > "$tmp/.doc-verify.yaml"
printf '%s\n' \
  'schema_version: 1' \
  'rubrics:' \
  '  threshold: 1' \
  '  items:' \
  '    - id: design.problem' \
  '      artifact_kinds: [design]' \
  '      applies_to: {sections: [problem-statement], scope: combined}' \
  '      evidence: {source: section_body, max_bytes: 1000}' \
  '      question:' \
  '        kind: choose' \
  '        instruction: Is the problem stated?' \
  '        options: [supported, refuted, unknown]' \
  '      critical: true' \
  '      weight: 1' \
  '      scores: {supported: 1, refuted: 0, unknown: 0}' > "$tmp/rubrics/design.yaml"
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
  '      - id: document-contracts' > "$tmp/.pre-commit-config.yaml"

git -C "$tmp" add .
git -C "$tmp" commit -qm base

printf '%s\n' 'valid edit' >> "$tmp/design/01-fixture.md"
git -C "$tmp" add design/01-fixture.md
(cd "$tmp" && uvx prek run document-contracts)

sed -i.bak '/## Rationale/,+1d' "$tmp/design/01-fixture.md"
rm -f "$tmp/design/01-fixture.md.bak"
git -C "$tmp" add design/01-fixture.md
set +e
output="$(cd "$tmp" && uvx prek run document-contracts 2>&1)"
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
