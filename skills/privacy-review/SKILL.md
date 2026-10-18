---
name: privacy-review
description: Automated privacy review for git repositories. Scans for sensitive data exposure including API keys, passwords, database credentials, and tokens. Use before pushing to public repositories or sharing code. Trigger by running the packaged gate, `privacy_gate`, which is also the pre-commit hook.
---

# Privacy Review

## Overview

Automated privacy security review for git repositories. Detects sensitive data exposure in committed files and repository configuration.

**When to use:**
- Before pushing code to public repositories (GitHub, GitLab)
- When sharing code with external parties
- Before opening pull requests
- Periodic security audits

## What the gate does, and what it does not

**It is a pre-commit gate over the STAGED set. It rejects; it never rewrites.**

| property | value |
|---|---|
| population | **staged files only** — `git diff --cached`. Never the working tree, never history. |
| detector | Gitleaks, pinned to one exact release; home.conf rules extend its defaults |
| disposition | **reject** — the commit stops and the author fixes the source |
| content | **never modified.** No `--fix`, no rewrite, no autostage |
| output | **redacted** — rule class, path, line, and a one-way fingerprint; never the matched value |

⚠ **This is not a history audit.** It does not scan commits, `.gitignore`, or a local `.env`. Those were
the retired `privacy_scan.py`'s behaviours, and it is gone.

## How a consumer wires it

```text
repos:
  - repo: <this repository>
    rev: <pinned ref>
    hooks:
      - id: privacy-scan
```

The hook needs the pinned Gitleaks binary. If it is absent the gate **fails by name (exit 2)** rather
than borrowing one from `PATH`.

## Exit codes

| code | meaning |
|---|---|
| 0 | clean — the configured detectors matched nothing |
| 1 | **refused** — a finding; fix the source |
| 2 | cannot run — Gitleaks absent, config invalid or empty of rules |
| 3 | nothing examined — no staged files, or all excluded |
| 4 | bad repository config (`.privacy-scan.json`) |
| 64 | unsupported argument — this gate takes none |

## Per-repository configuration

`.privacy-scan.json` at the repository root. **Paths only, never rules** — a rule-wide exclusion
disables a detector everywhere:

```json
{ "exclude_paths": ["fixtures/"], "deny_terms": ["<your private term>"] }
```

An exclusion names **one path**; `*`, `**`, `.`, `..` and anything rule-shaped are refused with exit 4.
`deny_terms` must be a list of non-empty strings. **The gate prints how many exclusions it loaded** — a
silent exclusion is indistinguishable from a silent pass.

## Quick Start

```bash
# Scan current directory
home-conf-privacy-scan

# Scan specific repository
# from inside the repository you are committing in
sh skills/privacy-review/scripts/privacy_gate
```
⚠ **The gate takes no options and always scans the INVOKING repository's staged set.** `--repo-path` and
`--quiet` are refused with exit 64 rather than silently ignored — an accepted-but-ignored flag makes the
invocation not mean what it says.

```

## Report Format

The tool generates a structured report with:

```text
======================================================================
PRIVACY REVIEW - STAGED SET (reject-only; findings redacted)
======================================================================

privacy-gate: staged=2 scanned=2 excluded=0 exclusions_loaded=0

1 finding(s). VALUES ARE NOT PRINTED.

  src/config.ts:42  generic-api-key  fp=0fe51f9302b4

The commit is refused. Fix the source; this gate never rewrites content.
```
### What to do when the gate refuses

**Fix the source and commit the intended content.** That is the whole procedure:

```bash
# 1. the gate names the path and line; open it and remove the literal
# 2. if the value is a real credential, ROTATE IT -- removing it from a file does not un-expose it
# 3. re-stage and commit
git add <file>
git commit
```

The gate **never rewrites staged content**, because a redaction that changes content without notice is
unacceptable: the commit would proceed with bytes nobody chose. If the value is already in committed
history, that is a separate, deliberate decision — not something a pre-commit hook does.

### Reading values from the environment

```python
import os

DATABASE_URL = os.getenv("DATABASE_URL")
API_KEY = os.getenv("API_KEY")
```

A documentation example that LOOKS like a credential is exactly what the detector matches — a provider
key prefix followed by random-looking characters, or a connection string with an inline password. A
placeholder must be obviously not one (`your-api-key-here`). This package's own reference material is
allowlisted by exact path for that reason.


## Common Mistakes

### ❌ Don't Commit
- `.env` files with real credentials
- API keys in configuration files
- Database URLs with passwords
- Private keys (`.pem`, `.key`)
- Hardcoded secrets in code

### ✅ Do Instead
- Use `os.getenv()` for configuration
- Commit `.env.example` with placeholders
- Reference secrets from environment
- Use secret management services
- Document required variables in README

## Patterns Detected

See [PATTERNS.md](PATTERNS.md) for complete list of sensitive patterns:
- Database URLs with credentials
- API keys (OpenAI, AWS, etc.)
- Authentication tokens
- Configuration files with extensions

## Best Practices

### Code Level
- All secrets use environment variables
- Validation at startup (fail if secrets missing)
- No secrets in logs or print statements

### Repository Level
- `.env` always in `.gitignore`
- Enable secret scanning in CI/CD
- Require review for sensitive changes
- Audit git history periodically

### Workflow Level
- Automate pre-commit hooks for secret detection
- Fail builds on secret detection
- Rotate credentials regularly
- Use short-lived tokens when possible

## Troubleshooting

### False Positives

The tool may flag:
- Example values in `.env.example` (safe)
- Test URLs with `localhost` or `127.0.0.1` (usually safe)
- Documentation mentioning patterns (not actual secrets)

Review these manually before taking action.

### Files Not Scanned

Binary files and large assets are skipped:
- Images (`.png`, `.jpg`, `.gif`)
- PDFs
- Zip files
- Already committed files (this gate scans the staged set only; history is a separate decision)

## Advanced Usage

### CI/CD integration

The gate takes **no options** — it always scans the invoking repository's staged set and exits by code:

```yaml
- name: Privacy scan
  run: |
    sh skills/privacy-review/scripts/privacy_gate
```

**Do not pass `--quiet`, `--repo-path` or any other flag.** They are refused with **exit 64** rather than
silently ignored: an option that is accepted and does nothing makes the invocation not mean what it says.

### Custom rules — extending the detector

Rules live in `.gitleaks.toml`, and a repository's file **must extend the defaults** or it replaces
them. A config that does not extend **reports clean on every commit**:

```toml
[extend]
useDefault = true

[[rules]]
id = "our-internal-marker"
description = "a term that must not appear in this repository"
regex = '<your term>'
```

### Excluding a known-safe file

```json
{ "exclude_paths": ["fixtures/"] }

**Paths only — never a rule and never a glob.** `*`, `**`, `.`, `..` and anything rule-shaped are refused
with exit 4, because an exclusion that disables a detector is how a gate is quietly defeated. The gate
prints how many exclusions it loaded, so a silent one is visible.
