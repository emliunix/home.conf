---
name: privacy-review
description: Automated privacy review for git repositories. Scans for sensitive data exposure including API keys, passwords, database credentials, and tokens. Use before pushing to public repositories or sharing code. Trigger by running 'python privacy_scan.py' on a git repository.
---

# Privacy Review

## Overview

Automated privacy security review for git repositories. Detects sensitive data exposure in committed files and repository configuration.

**When to use:**
- Before pushing code to public repositories (GitHub, GitLab)
- When sharing code with external parties
- Before opening pull requests
- Periodic security audits

## Checks Performed

### 1. Sensitive Files Tracked in Git
Scans tracked files (including staged additions) for sensitive extensions:
- `.env`, `.env.local` - Environment configuration
- `.pem`, `.p12` - Private keys and certificates
- `*_secrets.*` - Secret configuration
- `*_credentials.*` - API credentials

### 2. Secrets in Committed Code
Pattern-based scanning for sensitive patterns in source files:
- Database URLs with credentials (`postgresql://user:pass@host`)
- API keys (`sk-`, `AKIA`, `Bearer`)
- Secret tokens and assignments
- Authorization headers

### 3. .gitignore Protection
Verifies that `.env` and other sensitive files are properly ignored.

### 4. Local .env File
Checks if local `.env` exists with real credentials (not committed).

## Quick Start

Stage the files you intend to commit first (`git add`): the scanner reads the
git index, so staged additions are checked before they enter history.

```bash
# Scan current directory
python scripts/privacy_scan.py

# Scan specific repository
python scripts/privacy_scan.py --repo-path /path/to/repo

# Quiet mode (show only issues; exits non-zero when findings exist)
python scripts/privacy_scan.py --quiet
```

## Report Format

The tool generates a structured report with:

```
======================================================================
PRIVACY REVIEW REPORT
======================================================================

📁 CHECK 1: Sensitive Files in Git
----------------------------------------------------------------------
✅ No sensitive files committed

🔍 CHECK 2: Secrets in Committed Code
----------------------------------------------------------------------
❌ FOUND potential secrets:
   - API key assignment: OPENAI_API_KEY="sk-abc123xyz..." (line 42)

🛡️  CHECK 3: .gitignore Protection
----------------------------------------------------------------------
✅ .env is protected by .gitignore

📄 CHECK 4: Local .env File
----------------------------------------------------------------------
⚠️  WARNING: .env exists with real credentials
   Status: .env file exists locally but is NOT committed

======================================================================
SUMMARY
======================================================================
❌ Found 2 privacy concern(s)

Recommendations:
  - Replace secrets with environment variable references
  - Rotate any exposed credentials
  - Ensure .env remains in .gitignore

======================================================================
```

## Remediation Guide

### Removing Secrets from History

If secrets are found in committed files:

```bash
# Remove specific file from all branches
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch file-with-secrets.py' HEAD

# Push cleaned history (requires force)
git push origin --force
```

### Replacing Secrets with Environment Variables

Before:
```python
DATABASE_URL="postgresql://user:password@host:5432/db"
API_KEY="sk-abc123xyz..."
```

After:
```python
import os

DATABASE_URL = os.getenv("DATABASE_URL")
API_KEY = os.getenv("API_KEY")
```

Create `.env.example`:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/db
API_KEY=your-api-key-here
```

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

See [references/patterns.md](references/patterns.md) for the complete list of sensitive patterns:
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
- Already committed files (use `git filter-branch` for historical scans)

## Advanced Usage

### CI/CD Integration

Add to GitHub Actions:
```yaml
- name: Privacy Scan
  run: |
    python scripts/privacy_scan.py --quiet
```

### Custom Patterns

Extend `privacy_scan.py` with additional patterns:
```python
# Add to patterns list in check_sensitive_patterns_in_content()
(r"custom_pattern", "Custom sensitive data"),
```

### Ignore Specific Patterns

For files with known safe patterns (like test data):
```python
# Modify scan_commit_for_secrets() to skip files
if "test_" in file_path.lower():
    continue
```
